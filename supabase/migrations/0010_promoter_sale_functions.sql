-- 0010_promoter_sale_functions.sql — Promoter-Verkauf: Berechnung, Reservierung,
-- Zahlungsstatus (Etappe E5.4, Auftrag Marco 03.10.2026)
--
-- Marco: „Der Promoter kann im /promoter-Portal für einen Kunden Tickets
-- verkaufen: verfügbare Events wählen (auch interne), Ticketzahl; Vollzahler
-- ODER Anzahlung (volle Freiheit) …; 10+1-Gruppenregel automatisch;
-- Anzahlungsbasis-Variante wählbar (Standard: nur zahlende Köpfe);
-- Zahlungsstatus startet auf ‚Anzahlung erhalten', 3-stufig änderbar, jede
-- Änderung ins Audit-Log; Provision als Snapshot zum Verkaufszeitpunkt;
-- Kundendaten minimal (Name + Handynummer, E-Mail optional); atomar gegen
-- Event-Kontingent (reserve-Funktion, kein Überbuchen) — 8-parallel-Test."
--
-- Entscheidungen Marco 03.10.2026 (DECISIONS):
--   F24  Vollzahlung startet als fully_paid, Anzahlung als deposit_received.
--   F18  10+1 pro vollem Block: Gratisplätze = floor(Personen / Schwelle) × Gratis.
--   F16  „Freier Gesamtbetrag" über (oder gleich) dem Gesamtpreis → ablehnen.
--   F22  Promoter-Verkauf = bookings.status 'confirmed'.
--   F8   Kunden-E-Mail optional (Name + Handynummer Pflicht).
--
-- Alles additiv (Hard Rule 1). 0001–0009 bleiben unberührt. Einzige
-- Korrektur an bestehendem Schema: der Check payment_status_matches_amounts
-- aus 0006 wird (gleicher Name) durch eine Fassung mit der dritten Stufe
-- ersetzt — Korrektur = neue Migration, 0006 selbst wird nicht editiert.
--
-- Hard Rule 4: Die Handover-Funktion reserve_departure_seats() aus 0002 bleibt
-- byteidentisch (Option B, F12). reserve_promoter_seats() steht DANEBEN und
-- enthält das atomare UPDATE WÖRTLICH (Prüfung + Erhöhung in einem Statement,
-- kein SELECT-dann-UPDATE, kein Anwendungs-Locking). Nachweis:
-- tests/promoter-sale.test.ts (Identität des Blocks + 8 parallel auf 1 Platz).
--
-- Enthält:
--   * Enum deposit_basis + Spalten bookings.deposit_basis / deposit_total_cents
--   * customer_email nullable (F8)
--   * Checks: Zahlungsstatus 3-stufig, Anzahlungs-Bedingungen, Handynummer,
--     Beträge = bezahlte Plätze × Snapshot
--   * promoter_sale_amounts()   — reine Berechnung (eine Wahrheit für Quote + Verkauf)
--   * quote_promoter_sale()     — Angebot für den Bestätigungsschritt, schreibt nichts
--   * reserve_promoter_seats()  — Verkauf: Idempotenz, atomares UPDATE, Buchung, Audit
--   * set_booking_payment_status() — 3-stufig, Promoter eigene / Gabo alle, Audit
--
-- Bewusst NICHT hier (Marco: „NUR den Verkaufs-Kern"): Storno-Funktion,
-- Nachrichten-Auslöser (E5.6), Dashboard (E5.5). Storno-Provision bleibt F10.

-- ---------------------------------------------------------------------------
-- Anzahlungsbasis (F11/F18, Marco 02.10.2026): drei Varianten, pro Verkauf wählbar
-- ---------------------------------------------------------------------------

create type deposit_basis as enum ('paying_persons', 'all_persons', 'custom_total');

comment on type deposit_basis is
  'Grundlage der Anzahlung pro Verkauf: paying_persons = Anzahlung pro Person nur für zahlende Köpfe (Standard); all_persons = für alle Köpfe inkl. Gratisplätze; custom_total = freier Gesamtbetrag, vom Promoter eingegeben (muss unter dem Gesamtpreis liegen, F16).';

alter table bookings
  add column deposit_basis deposit_basis,
  -- Vereinbarte Anzahlung dieser Buchung in Cent (Hard Rule 7). Bleibt stehen,
  -- auch wenn der Status später auf „noch nichts kassiert" oder „voll bezahlt"
  -- wechselt — damit „Anzahlung erhalten" wieder genau diesen Betrag setzt.
  add column deposit_total_cents integer check (deposit_total_cents >= 0);

comment on column bookings.deposit_basis is
  'Anzahlungsbasis, die der Promoter beim Verkauf gewählt hat (nur bei payment_type = deposit).';
comment on column bookings.deposit_total_cents is
  'Vereinbarte Anzahlung dieser Buchung in Cent (nur bei payment_type = deposit). Status deposit_received ⇔ amount_paid_cents = dieser Betrag.';
comment on column bookings.deposit_amount_cents_snapshot is
  'Anzahlung pro Person laut Regel zum Verkaufszeitpunkt (effective_price_cents deposit). Pflicht bei payment_type = deposit; der vereinbarte Gesamtbetrag steht in deposit_total_cents.';

-- F8 (Marco 03.10.2026): E-Mail optional. Die Handover-Funktion übergibt
-- weiterhin eine E-Mail — sie ist davon nicht betroffen.
alter table bookings alter column customer_email drop not null;

-- ---------------------------------------------------------------------------
-- Checks (Namen bewusst so gewählt, dass bestehende Prüfungen zuerst greifen —
-- Postgres prüft CHECKs in alphabetischer Reihenfolge)
-- ---------------------------------------------------------------------------

alter table bookings drop constraint payment_status_matches_amounts;

alter table bookings
  -- Drei Stufen (F22/F23):
  --   not_collected    ⇔ nichts kassiert
  --   deposit_received ⇒ Zahlart Anzahlung, kassiert = vereinbarte Anzahlung, 0 < kassiert < Gesamt
  --   fully_paid       ⇔ kassiert = Gesamt
  add constraint payment_status_matches_amounts
    check (
      payment_status is null
      or (payment_status = 'not_collected' and amount_paid_cents = 0)
      or (payment_status = 'fully_paid' and amount_paid_cents = total_amount_cents)
      or (
        payment_status = 'deposit_received'
        and payment_type = 'deposit'
        and amount_paid_cents > 0
        and amount_paid_cents < total_amount_cents
        and amount_paid_cents = deposit_total_cents
      )
    ),
  -- Anzahlung gewählt → Basis + vereinbarter Betrag (0 < Betrag < Gesamt, F16).
  -- Vollzahlung → keine Anzahlungsangaben.
  add constraint promoter_deposit_terms_consistent
    check (
      channel <> 'promoter'
      or (
        payment_type = 'deposit'
        and deposit_basis is not null
        and deposit_total_cents is not null
        and deposit_total_cents > 0
        and deposit_total_cents < total_amount_cents
      )
      or (
        payment_type = 'full'
        and deposit_basis is null
        and deposit_total_cents is null
      )
    ),
  -- Kundendaten minimal (Marco 03.10.2026): Name (0001: not null) + Handynummer.
  add constraint promoter_customer_phone_present
    check (channel <> 'promoter' or length(btrim(coalesce(customer_phone, ''))) > 0),
  -- Beträge folgen aus den Snapshots — die Auswertung kann sie nachrechnen.
  add constraint snapshot_amounts_consistent
    check (
      channel <> 'promoter'
      or (
        total_amount_cents = paid_seats * ticket_price_cents_snapshot
        and commission_total_cents = paid_seats * commission_per_ticket_cents_snapshot
      )
    );

-- ---------------------------------------------------------------------------
-- Reine Berechnung — EINE Stelle für Quote und Verkauf
-- ---------------------------------------------------------------------------

create function promoter_sale_amounts(
  p_seats integer,
  p_payment_type payment_type,
  p_deposit_basis deposit_basis,
  p_custom_deposit_cents integer,
  p_ticket_price_cents integer,
  p_deposit_per_person_cents integer,
  p_commission_per_ticket_cents integer,
  p_group_threshold integer,
  p_group_free integer
) returns table (
  paid_seats integer,
  free_persons integer,
  total_amount_cents integer,
  deposit_basis deposit_basis,
  deposit_total_cents integer,
  amount_paid_cents integer,
  commission_total_cents integer,
  payment_status payment_status
)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_free integer;
  v_paid integer;
  v_total integer;
  v_deposit integer;
begin
  if p_seats is null or p_seats < 1 then
    raise exception 'INVALID_SEATS' using errcode = '22023';
  end if;
  if p_payment_type is null then
    raise exception 'PAYMENT_TYPE_REQUIRED' using errcode = '22023';
  end if;
  -- F15: ohne gültigen Ticketpreis wird nicht verkauft.
  if p_ticket_price_cents is null then
    raise exception 'NO_TICKET_PRICE' using errcode = 'P0001';
  end if;
  if p_commission_per_ticket_cents is null then
    raise exception 'NO_COMMISSION_RULE' using errcode = 'P0001';
  end if;
  if p_group_threshold is null or p_group_free is null then
    raise exception 'NO_GROUP_RULE' using errcode = 'P0001';
  end if;

  -- 10+1 pro vollem Block (F18): 11 → 1 gratis, 22 → 2 gratis (bei 11/1).
  -- Gratisplätze belegen Kontingent (seats), kosten nichts und bringen keine
  -- Provision (RISKS Nr. 22). Nie mehr Gratisplätze als Personen.
  v_free := least(p_seats, (p_seats / p_group_threshold) * p_group_free);
  v_paid := p_seats - v_free;
  v_total := v_paid * p_ticket_price_cents;

  paid_seats := v_paid;
  free_persons := v_free;
  total_amount_cents := v_total;
  commission_total_cents := v_paid * p_commission_per_ticket_cents;

  if p_payment_type = 'full' then
    -- F24: Vollzahlung startet als „voll bezahlt".
    deposit_basis := null;
    deposit_total_cents := null;
    amount_paid_cents := v_total;
    payment_status := 'fully_paid';
    return next;
    return;
  end if;

  -- Anzahlung: Basis wählbar, Standard = zahlende Köpfe (Marco 02.10.2026).
  if p_deposit_basis is null then
    raise exception 'DEPOSIT_BASIS_REQUIRED' using errcode = '22023';
  end if;
  if p_deposit_per_person_cents is null then
    raise exception 'NO_DEPOSIT_RULE' using errcode = 'P0001';
  end if;

  if p_deposit_basis = 'paying_persons' then
    v_deposit := v_paid * p_deposit_per_person_cents;
  elsif p_deposit_basis = 'all_persons' then
    v_deposit := p_seats * p_deposit_per_person_cents;
  else
    if p_custom_deposit_cents is null then
      raise exception 'CUSTOM_DEPOSIT_REQUIRED' using errcode = '22023';
    end if;
    v_deposit := p_custom_deposit_cents;
  end if;

  if v_deposit <= 0 then
    raise exception 'DEPOSIT_NOT_POSITIVE' using errcode = 'P0001';
  end if;
  -- F16: Anzahlung, die den Gesamtpreis erreicht oder übersteigt → ablehnen
  -- (dann ist es eine Vollzahlung; kein stilles Kappen).
  if v_deposit >= v_total then
    raise exception 'DEPOSIT_NOT_BELOW_TOTAL' using errcode = 'P0001';
  end if;

  deposit_basis := p_deposit_basis;
  deposit_total_cents := v_deposit;
  amount_paid_cents := v_deposit;
  -- F23: ein neuer Verkauf mit Anzahlung startet als „Anzahlung erhalten".
  payment_status := 'deposit_received';
  return next;
end
$$;

comment on function promoter_sale_amounts(integer, payment_type, deposit_basis, integer, integer, integer, integer, integer, integer) is
  'Reine Berechnung eines Promoter-Verkaufs aus Personen, Zahlart, Anzahlungsbasis und den Regelwerten: bezahlte/gratis Plätze (10+1 pro vollem Block), Gesamt, Anzahlung, kassiert, Provision, Startstatus. Wirft NO_TICKET_PRICE, DEPOSIT_NOT_BELOW_TOTAL usw. Wird von quote_promoter_sale() und reserve_promoter_seats() benutzt.';

revoke all on function promoter_sale_amounts(integer, payment_type, deposit_basis, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function promoter_sale_amounts(integer, payment_type, deposit_basis, integer, integer, integer, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Quote: was der Bestätigungsschritt zeigt — schreibt nichts
-- ---------------------------------------------------------------------------

create function quote_promoter_sale(
  p_departure_id uuid,
  p_seats integer,
  p_payment_type payment_type,
  p_deposit_basis deposit_basis default 'paying_persons',
  p_custom_deposit_cents integer default null
) returns table (
  departure_id uuid,
  seats integer,
  paid_seats integer,
  free_persons integer,
  ticket_price_cents integer,
  deposit_per_person_cents integer,
  commission_per_ticket_cents integer,
  group_threshold integer,
  group_free integer,
  total_amount_cents integer,
  deposit_basis deposit_basis,
  deposit_total_cents integer,
  amount_paid_cents integer,
  amount_due_cents integer,
  commission_total_cents integer,
  payment_status payment_status,
  seats_available integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_now timestamptz := now();
  v_dep tour_departures%rowtype;
  v_price integer;
  v_deposit_pp integer;
  v_commission integer;
  v_threshold integer;
  v_free integer;
  r record;
begin
  -- Nur aktive Profile (Promoter oder Gabo). Deaktiviert/anon → NOT_ALLOWED.
  if not is_active_profile() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into v_dep from tour_departures t where t.id = p_departure_id;
  if not found then
    raise exception 'DEPARTURE_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_price := effective_price_cents('ticket_price', p_departure_id, v_now);
  v_deposit_pp := effective_price_cents('deposit', p_departure_id, v_now);
  v_commission := effective_commission_cents(p_departure_id, v_now);
  select g.threshold_persons, g.free_persons into v_threshold, v_free
  from effective_group_rule(v_now) g;

  select * into r from promoter_sale_amounts(
    p_seats, p_payment_type, p_deposit_basis, p_custom_deposit_cents,
    v_price, v_deposit_pp, v_commission, v_threshold, v_free
  );

  departure_id := p_departure_id;
  seats := p_seats;
  paid_seats := r.paid_seats;
  free_persons := r.free_persons;
  ticket_price_cents := v_price;
  deposit_per_person_cents := v_deposit_pp;
  commission_per_ticket_cents := v_commission;
  group_threshold := v_threshold;
  group_free := v_free;
  total_amount_cents := r.total_amount_cents;
  deposit_basis := r.deposit_basis;
  deposit_total_cents := r.deposit_total_cents;
  amount_paid_cents := r.amount_paid_cents;
  amount_due_cents := r.total_amount_cents - r.amount_paid_cents;
  commission_total_cents := r.commission_total_cents;
  payment_status := r.payment_status;
  -- Nur Information für die Anzeige; die Grenze setzt allein das atomare UPDATE.
  seats_available := case when v_dep.status = 'open'
                          then greatest(v_dep.capacity_total - v_dep.seats_booked_total, 0)
                          else 0 end;
  return next;
end
$$;

comment on function quote_promoter_sale(uuid, integer, payment_type, deposit_basis, integer) is
  'Angebot für den Bestätigungsschritt: Regeln zum aktuellen Zeitpunkt + promoter_sale_amounts(). Schreibt nichts, reserviert nichts. Nur aktive Profile.';

revoke all on function quote_promoter_sale(uuid, integer, payment_type, deposit_basis, integer) from public, anon;
grant execute on function quote_promoter_sale(uuid, integer, payment_type, deposit_basis, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verkauf (Option B, F12): neben der Handover-Funktion, UPDATE-Block wörtlich
-- ---------------------------------------------------------------------------

create function reserve_promoter_seats(
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
  -- Nur aktive Promoter verkaufen (F13: Gabo verkauft nicht im Promoter-Bereich).
  -- Die Rolle kommt aus profiles, nie aus dem Token (DECISIONS 29.09.).
  if v_uid is null or current_profile_role() is distinct from 'promoter' then
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
    v_booking_id, 'sold', v_uid, 'promoter', null,
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
  'Promoter-Verkauf: prüft Rolle (aktiver Promoter), Idempotenz-Schlüssel und Kundendaten, berechnet Beträge aus den Regeln zum Verkaufszeitpunkt (Snapshots), reserviert p_seats Personen mit dem WÖRTLICHEN atomaren UPDATE der Handover-Funktion (SOLD_OUT statt Überbuchung), legt die Buchung (confirmed) an und schreibt die Audit-Zeile sold. Liefert die Buchungs-ID.';

revoke all on function reserve_promoter_seats(uuid, integer, payment_type, deposit_basis, integer, text, text, text, uuid, integer, integer) from public, anon;
grant execute on function reserve_promoter_seats(uuid, integer, payment_type, deposit_basis, integer, text, text, text, uuid, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Zahlungsstatus ändern (3-stufig), jede Änderung ins Audit-Log
-- ---------------------------------------------------------------------------

create function set_booking_payment_status(
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
  -- Promoter: nur eigene Buchungen; network_operator (Gabo): alle. Deaktiviert/anon: nichts.
  if v_uid is null or v_role is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_payment_status is null then
    raise exception 'PAYMENT_STATUS_REQUIRED' using errcode = '22023';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found or (v_role = 'promoter' and v_booking.promoter_id is distinct from v_uid) then
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
  'Zahlungsstatus einer Promoter-Buchung setzen (not_collected → 0, deposit_received → vereinbarte Anzahlung, fully_paid → Gesamt). Promoter nur eigene Buchungen, network_operator alle; storniert → BOOKING_CANCELLED. Jede Änderung = Audit-Zeile payment_status_set mit Vorher/Nachher.';

revoke all on function set_booking_payment_status(uuid, payment_status) from public, anon;
grant execute on function set_booking_payment_status(uuid, payment_status) to authenticated, service_role;
