-- 0013_guide_role_accounts.sql — Guide verkauft wie ein Promoter, Gabo pflegt
-- Promoter- und Guide-Konten (Teil 2 nach der Diagnose E5.5, Auftrag Marco 03.10.2026)
--
-- Marco: „Rolle "guide" einführen (zusätzlich zu network_operator, promoter),
-- RLS deny-by-default, Rollenprüfung serverseitig. Guide kann ALLES wie ein
-- Promoter (verkaufen, eigenes Dashboard mit eigenen Zahlen). Gabo kann im
-- Admin Promoter- UND Guide-Profile anlegen/aktivieren/deaktivieren/Passwort
-- setzen (getrennt). … jede Rolle nur Eigenes."
--
-- Enthält (alles additiv, Hard Rule 1 — 0001–0012 unverändert):
--   * is_selling_profile()        — aktiver Promoter ODER Guide (Rolle aus profiles)
--   * reserve_promoter_seats()    — create or replace, GLEICHE Signatur. Geändert
--                                   sind nur Rollenprüfung (promoter|guide) und
--                                   actor_role der Audit-Zeile (= echte Rolle).
--                                   Das atomare UPDATE ist WÖRTLICH unverändert
--                                   (Hard Rule 4; Identitäts- + 8-parallel-Test).
--   * set_booking_payment_status() — create or replace, gleiche Signatur.
--                                   LÜCKE GESCHLOSSEN: 0010 prüfte „fremde Buchung"
--                                   nur für role = 'promoter'. Ein Guide wäre wie
--                                   Gabo behandelt worden und hätte JEDE Buchung
--                                   ändern dürfen. Jetzt: nur network_operator darf
--                                   fremde Buchungen, alle anderen nur eigene.
--   * profiles: Konto-Pflege durch Gabo (DECISIONS 03.10.2026, Teil 2)
--       - INSERT nur network_operator, nur Rolle promoter|guide (kein zweiter
--         Operator über die App), Spalten id, role, display_name, active
--       - UPDATE nur network_operator, nur Spalten active + display_name, nur
--         Zeilen mit Rolle promoter|guide (das eigene Operator-Profil kann Gabo
--         nicht deaktivieren). Die Rolle selbst ist NICHT änderbar (kein
--         Spalten-Grant; F29: ob ein Konto zugleich Promoter und Guide sein
--         kann, ist offen).
--       - kein DELETE (deaktivieren statt löschen, wie Vorlagen/Termine)
--       - updated_at per Trigger (nur auf profiles)
--   Auth-Konten (auth.users, Passwörter) legt die App über die GoTrue-Admin-API
--   mit dem service_role-Schlüssel an — die einzige Stelle, an der die App
--   service_role benutzt (DECISIONS 03.10.2026, Teil 2, Punkt c). Das Profil
--   selbst schreibt Gabo über seinen RLS-Client und diese Policies.
--
-- Bestehende Lese-Policies passen ohne Änderung: bookings/booking_audit_log/
-- notifications prüfen promoter_id = auth.uid() bzw. is_network_operator(),
-- tour_departures/pricing_rules is_active_profile() — ein Guide sieht also
-- genau seine eigenen Verkäufe und alle Events, wie ein Promoter. Die
-- Auswertungs-Sichten aus 0011 sind security_invoker und folgen dem.

-- ---------------------------------------------------------------------------
-- Helfer: darf verkaufen (Promoter oder Guide, aktiv)
-- ---------------------------------------------------------------------------

create function is_selling_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_profile_role() in ('promoter', 'guide'), false)
$$;

comment on function is_selling_profile() is
  'true = eingeloggter Nutzer ist aktiver Promoter oder Guide (Rolle aus profiles, nie aus dem Token).';

revoke all on function is_selling_profile() from public, anon;
grant execute on function is_selling_profile() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verkauf: Guide zulassen. Body = 0010 bis auf Rollenprüfung + actor_role.
-- ---------------------------------------------------------------------------

create or replace function reserve_promoter_seats(
  p_departure_id uuid,
  p_seats integer,
  p_payment_type payment_type,
  p_deposit_basis deposit_basis,
  p_custom_deposit_cents integer,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_idempotency_key uuid,
  p_expected_total_cents integer default null,
  p_expected_amount_paid_cents integer default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departure_id uuid;
  v_booking_id uuid;
  v_existing_promoter uuid;
  v_now timestamptz := now();
  v_uid uuid := auth.uid();
  v_role user_role := current_profile_role();
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_email text := nullif(btrim(coalesce(p_customer_email, '')), '');
  v_price integer;
  v_deposit_pp integer;
  v_commission integer;
  v_threshold integer;
  v_free integer;
  r record;
begin
  -- Nur aktive Promoter und Guides verkaufen (0013, Teil 2: der Guide kann alles,
  -- was ein Promoter kann; F13: Gabo verkauft nicht im Promoter-Bereich).
  -- Die Rolle kommt aus profiles, nie aus dem Token (DECISIONS 29.09.).
  if v_uid is null or v_role is null or v_role not in ('promoter', 'guide') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;

  -- Idempotenz (RISKS Nr. 11): derselbe Schlüssel → dieselbe Buchung, kein
  -- zweiter Verkauf. Kommen zwei Aufrufe gleichzeitig an, scheitert der zweite
  -- am eindeutigen Index bookings_idempotency_key_key (23505) und rollt samt
  -- Zähler-Erhöhung zurück; die App liest dann die bestehende Buchung.
  select b.id, b.promoter_id into v_booking_id, v_existing_promoter
  from bookings b
  where b.idempotency_key = p_idempotency_key;
  if v_booking_id is not null then
    if v_existing_promoter is distinct from v_uid then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '42501';
    end if;
    return v_booking_id;
  end if;

  -- Kundendaten minimal (F8): Name + Handynummer Pflicht, E-Mail optional.
  if length(v_name) = 0 or length(v_name) > 200 then
    raise exception 'CUSTOMER_NAME_REQUIRED' using errcode = '22023';
  end if;
  if length(v_phone) > 40 or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 6 then
    raise exception 'CUSTOMER_PHONE_REQUIRED' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'CUSTOMER_EMAIL_INVALID' using errcode = '22023';
  end if;

  if not exists (select 1 from tour_departures t where t.id = p_departure_id) then
    raise exception 'DEPARTURE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Snapshots: Regeln zum Verkaufszeitpunkt (Hard Rule 7, RISKS Nr. 21).
  v_price := effective_price_cents('ticket_price', p_departure_id, v_now);
  v_deposit_pp := effective_price_cents('deposit', p_departure_id, v_now);
  v_commission := effective_commission_cents(p_departure_id, v_now);
  select g.threshold_persons, g.free_persons into v_threshold, v_free
  from effective_group_rule(v_now) g;

  select * into r from promoter_sale_amounts(
    p_seats, p_payment_type, p_deposit_basis, p_custom_deposit_cents,
    v_price, v_deposit_pp, v_commission, v_threshold, v_free
  );

  -- Was der Promoter im Bestätigungsschritt gesehen hat, muss gelten — hat
  -- Gabo inzwischen eine Regel geändert, wird nicht still anders verkauft.
  if (p_expected_total_cents is not null and p_expected_total_cents <> r.total_amount_cents)
     or (p_expected_amount_paid_cents is not null and p_expected_amount_paid_cents <> r.amount_paid_cents) then
    raise exception 'QUOTE_CHANGED' using errcode = 'P0001';
  end if;

  -- Ein einziges Statement: Kapazitaetspruefung und Erhoehung des Zaehlers.
  -- WOERTLICH aus docs/handover/reserve-function-final.sql (Hard Rule 4).
  -- p_seats = Personen inkl. Gratisplaetze (RISKS Nr. 22).
  update tour_departures
  set seats_booked_total = seats_booked_total + p_seats
  where id = p_departure_id
    and status = 'open'
    and seats_booked_total + p_seats <= capacity_total
  returning id into v_departure_id;

  if v_departure_id is null then
    raise exception 'SOLD_OUT' using errcode = 'P0001';
  end if;

  insert into bookings (
    departure_id, channel, payment_type,
    seats, paid_seats, free_persons,
    total_amount_cents, amount_paid_cents, status,
    customer_name, customer_phone, customer_email,
    promoter_id, idempotency_key, sold_at,
    ticket_price_cents_snapshot, deposit_amount_cents_snapshot,
    commission_per_ticket_cents_snapshot, group_threshold_snapshot, group_free_snapshot,
    commission_total_cents, payment_status, deposit_basis, deposit_total_cents
  ) values (
    p_departure_id, 'promoter'::booking_channel, p_payment_type,
    p_seats, r.paid_seats, r.free_persons,
    r.total_amount_cents, r.amount_paid_cents, 'confirmed'::booking_status,
    v_name, v_phone, v_email,
    v_uid, p_idempotency_key, v_now,
    v_price, case when p_payment_type = 'deposit' then v_deposit_pp end,
    v_commission, v_threshold, v_free,
    r.commission_total_cents, r.payment_status, r.deposit_basis, r.deposit_total_cents
  )
  returning id into v_booking_id;

  insert into booking_audit_log (booking_id, action, actor_id, actor_role, old_values, new_values)
  values (
    v_booking_id, 'sold', v_uid, v_role, null,
    jsonb_build_object(
      'status', 'confirmed',
      'seats', p_seats,
      'paid_seats', r.paid_seats,
      'free_persons', r.free_persons,
      'payment_type', p_payment_type,
      'deposit_basis', r.deposit_basis,
      'total_amount_cents', r.total_amount_cents,
      'deposit_total_cents', r.deposit_total_cents,
      'amount_paid_cents', r.amount_paid_cents,
      'payment_status', r.payment_status,
      'commission_total_cents', r.commission_total_cents
    )
  );

  return v_booking_id;
end
$$;


comment on function reserve_promoter_seats(uuid, integer, payment_type, deposit_basis, integer, text, text, text, uuid, integer, integer) is
  'Promoter-/Guide-Verkauf: prüft Rolle (aktiver Promoter oder Guide, 0013), Idempotenz-Schlüssel und Kundendaten, berechnet Beträge aus den Regeln zum Verkaufszeitpunkt (Snapshots), reserviert p_seats Personen mit dem WÖRTLICHEN atomaren UPDATE der Handover-Funktion (SOLD_OUT statt Überbuchung), legt die Buchung (confirmed, promoter_id = Verkäufer) an und schreibt die Audit-Zeile sold mit der echten Rolle. Liefert die Buchungs-ID.';

-- Rechte unverändert (create or replace behält sie; hier zur Sicherheit erneut).
revoke all on function reserve_promoter_seats(uuid, integer, payment_type, deposit_basis, integer, text, text, text, uuid, integer, integer) from public, anon;
grant execute on function reserve_promoter_seats(uuid, integer, payment_type, deposit_basis, integer, text, text, text, uuid, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Zahlungsstatus: nur Gabo darf fremde Buchungen (Lücke aus 0010 geschlossen)
-- ---------------------------------------------------------------------------

create or replace function set_booking_payment_status(
  p_booking_id uuid,
  p_payment_status payment_status
) returns payment_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role := current_profile_role();
  v_booking bookings%rowtype;
  v_new_paid integer;
begin
  -- Promoter und Guide: nur eigene Buchungen; network_operator (Gabo): alle.
  -- Deaktiviert/anon: nichts.
  if v_uid is null or v_role is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_payment_status is null then
    raise exception 'PAYMENT_STATUS_REQUIRED' using errcode = '22023';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  -- 0013: Positivliste statt „nur promoter einschränken" — jede neue Rolle ist
  -- automatisch auf eigene Buchungen begrenzt.
  if not found or (v_role <> 'network_operator' and v_booking.promoter_id is distinct from v_uid) then
    -- Fremde Buchung verrät nicht, dass es sie gibt.
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_booking.channel <> 'promoter' then
    raise exception 'NOT_A_PROMOTER_BOOKING' using errcode = 'P0001';
  end if;
  if v_booking.status in ('cancelled', 'refunded') then
    raise exception 'BOOKING_CANCELLED' using errcode = 'P0001';
  end if;

  if v_booking.payment_status = p_payment_status then
    return p_payment_status;  -- nichts geändert → keine Audit-Zeile
  end if;

  if p_payment_status = 'not_collected' then
    v_new_paid := 0;
  elsif p_payment_status = 'fully_paid' then
    v_new_paid := v_booking.total_amount_cents;
  else
    -- deposit_received: nur bei Zahlart Anzahlung, Betrag = vereinbarte Anzahlung.
    if v_booking.payment_type <> 'deposit' or v_booking.deposit_total_cents is null then
      raise exception 'NOT_A_DEPOSIT_BOOKING' using errcode = 'P0001';
    end if;
    v_new_paid := v_booking.deposit_total_cents;
  end if;

  update bookings
  set payment_status = p_payment_status,
      amount_paid_cents = v_new_paid
  where id = p_booking_id;

  insert into booking_audit_log (booking_id, action, actor_id, actor_role, old_values, new_values)
  values (
    p_booking_id, 'payment_status_set', v_uid, v_role,
    jsonb_build_object('payment_status', v_booking.payment_status, 'amount_paid_cents', v_booking.amount_paid_cents),
    jsonb_build_object('payment_status', p_payment_status, 'amount_paid_cents', v_new_paid)
  );

  return p_payment_status;
end
$$;

comment on function set_booking_payment_status(uuid, payment_status) is
  'Zahlungsstatus einer Promoter-Buchung setzen (not_collected → 0, deposit_received → vereinbarte Anzahlung, fully_paid → Gesamt). Promoter und Guide nur eigene Buchungen, network_operator alle (0013); storniert → BOOKING_CANCELLED. Jede Änderung = Audit-Zeile payment_status_set mit Vorher/Nachher.';

revoke all on function set_booking_payment_status(uuid, payment_status) from public, anon;
grant execute on function set_booking_payment_status(uuid, payment_status) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles: Konto-Pflege durch Gabo (nur Promoter- und Guide-Konten)
-- ---------------------------------------------------------------------------

-- updated_at automatisch — Trigger NUR auf profiles.
create function profiles_touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function profiles_touch_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function profiles_touch_updated_at();

-- Spalten-Grants: anlegen mit genau diesen Spalten, ändern nur Aktiv-Flag + Name.
-- Die Rolle ist nach dem Anlegen unveränderlich (kein UPDATE-Grant auf role).
grant insert (id, role, display_name, active) on profiles to authenticated;
grant update (active, display_name) on profiles to authenticated;

create policy profiles_insert_network_operator
  on profiles for insert to authenticated
  with check (is_network_operator() and role in ('promoter', 'guide'));

create policy profiles_update_network_operator
  on profiles for update to authenticated
  using (is_network_operator() and role in ('promoter', 'guide'))
  with check (is_network_operator() and role in ('promoter', 'guide'));
