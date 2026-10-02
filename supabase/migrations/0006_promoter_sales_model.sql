-- 0006_promoter_sales_model.sql — Datenmodell Promoter-Verkauf (Etappe E5.1)
--
-- Auftrag Marco 02.10.2026 (Plan Etappe 5 freigegeben, vier Entscheidungen —
-- docs/DECISIONS.md 02.10.2026). Alles additiv (Hard Rule 1); 0001–0005 bleiben
-- unberührt; die Reserve-Funktion aus 0002 wird NICHT angefasst (Hard Rule 4).
-- Diese Migration legt NUR Daten-Strukturen an — keine Verkaufs-, Storno- oder
-- Nachrichten-Funktion. Die kommen in E5.3 (quote_promoter_sale,
-- reserve_promoter_seats, Zahlungsstatus setzen, Storno, enqueue).
--
-- Ein Promoter-Verkauf IST eine Zeile in `bookings` mit channel = 'promoter'
-- (Plan D5): dieselbe Tabelle, in die die Handover-Funktion schreibt, damit
-- Kontingent, Buchung und Beträge an einem Ort liegen. Es gibt keine zweite
-- Verkaufstabelle, die vom Zähler in tour_departures abweichen könnte.
--
-- Enthält:
--   * Enum payment_status — 'deposit_received' | 'fully_paid' (Entscheidung 2:
--     der Promoter markiert selbst; kein Zahlungssystem; Änderung = Audit-Log)
--   * bookings: Promoter-Spalten + Snapshots (Hard Rule 7, RISKS Nr. 21/22) +
--     Storno-Felder (Entscheidung 4) + amount_due_cents (generiert = Rest im Bus)
--     + Idempotenz-Schlüssel (RISKS Nr. 11). Checks erzwingen für
--     channel = 'promoter', dass alle Snapshots gesetzt sind.
--   * booking_audit_log — append-only: wer hat wann was an einer Buchung getan
--     (Verkauf, Zahlungsstatus, Storno). Keine Schreibrechte aus der App.
--   * notifications — Nachrichten-Queue als Daten (Bestätigung, Erinnerung 4 h / 1 h),
--     Status 'pending' = ausstehend; KEIN Versand (eigener Schritt nach F20).
--   * RLS deny-by-default: Promoter liest nur eigene Buchungen (+ deren Audit/
--     Nachrichten), network_operator liest alles, deaktiviert/anon nichts.
--     authenticated hat auf keiner der drei Tabellen INSERT/UPDATE/DELETE —
--     geschrieben wird ausschließlich über SECURITY-DEFINER-Funktionen (E5.3).
--
-- Bewusst NICHT hier (offen, Hard Rule 5):
--   * customer_email bleibt NOT NULL (F8: Kundendaten am Strand — Pflicht/optional?)
--   * Anzahlungsbasis pro Buchung / Gesamtbetrag (F16), 10+1-Option (F11/F18) → E5.2
--   * Buchungsstatus bei Bar-Anzahlung (F22) → entscheidet die Funktion in E5.3

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type payment_status as enum ('deposit_received', 'fully_paid');

comment on type payment_status is
  'Was der Promoter kassiert hat (manuell markiert, Entscheidung Marco 02.10.2026): deposit_received = Anzahlung erhalten, Rest offen; fully_paid = voll bezahlt.';

create type booking_audit_action as enum ('sold', 'payment_status_set', 'cancelled');

comment on type booking_audit_action is
  'Ereignis im Audit-Log einer Buchung: sold = Verkauf angelegt, payment_status_set = Zahlungsstatus gesetzt, cancelled = storniert (Sitze ans Kontingent zurück).';

create type notification_kind as enum ('booking_confirmation', 'reminder_4h', 'reminder_1h');
-- Welcher Kanal tatsächlich benutzt wird, entscheidet F20 — bis dahin bleibt
-- notifications.channel NULL. Die Werte stehen hier, damit kein ALTER TYPE nötig wird.
create type notification_channel as enum ('email', 'sms', 'whatsapp');
create type notification_status as enum ('pending', 'sent', 'failed', 'cancelled', 'skipped');

comment on type notification_status is
  'pending = ausstehend (noch kein Versand); sent/failed setzt der spätere Versand-Prozess; cancelled = Buchung storniert; skipped = Zeitpunkt lag beim Anlegen schon in der Vergangenheit.';

-- ---------------------------------------------------------------------------
-- bookings: Promoter-Spalten, Snapshots, Zahlungsstatus, Storno
-- ---------------------------------------------------------------------------

alter table bookings
  -- Wer hat verkauft (NULL bei Online-Buchungen der Handover-Funktion).
  -- Kein ON DELETE: ein Promoter mit Buchungen wird deaktiviert, nie gelöscht.
  add column promoter_id uuid references profiles (id),
  -- Idempotenz gegen Doppelklick/Netzwerk-Wiederholung (RISKS Nr. 11, Plan D4):
  -- derselbe Schlüssel darf nur eine Buchung erzeugen.
  add column idempotency_key uuid,

  -- Sitze vs. bezahlte Plätze (RISKS Nr. 22): `seats` = Personen = belegtes
  -- Kontingent. paid_seats + free_persons = seats.
  add column paid_seats integer check (paid_seats >= 0),
  add column free_persons integer check (free_persons >= 0),

  -- Snapshots: was zum Verkaufszeitpunkt galt (Hard Rule 7, RISKS Nr. 21).
  -- Auswertung rechnet nur hiermit, nie mit der aktuellen Regel.
  add column ticket_price_cents_snapshot integer check (ticket_price_cents_snapshot >= 0),
  add column deposit_amount_cents_snapshot integer check (deposit_amount_cents_snapshot >= 0),
  add column commission_per_ticket_cents_snapshot integer check (commission_per_ticket_cents_snapshot >= 0),
  add column group_threshold_snapshot integer check (group_threshold_snapshot >= 2),
  add column group_free_snapshot integer check (group_free_snapshot >= 0),
  add column commission_total_cents integer check (commission_total_cents >= 0),

  -- Rest im Bus = Gesamt − kassiert. Generiert, damit er nie abweichen kann.
  add column amount_due_cents integer generated always as (total_amount_cents - amount_paid_cents) stored,

  -- Zahlungsstatus (Entscheidung 2): manuell durch den Promoter, jede Änderung
  -- im Audit-Log. NULL bei Online-Buchungen (dort regelt es Stripe im Boots-Projekt).
  add column payment_status payment_status,

  -- Zeitpunkt der Quote/des Verkaufs (created_at bleibt der technische Zeitstempel).
  add column sold_at timestamptz,

  -- Storno (Entscheidung 4): nur network_operator, Sitze gehen ans Kontingent
  -- zurück, Audit-Log-Zeile. Keine Rückerstattung außer bei Absage des Events
  -- (dann status 'refunded' aus 0001).
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references profiles (id),
  add column cancellation_reason text;

comment on column bookings.promoter_id is
  'Promoter, der diese Buchung verkauft hat (auth.uid() zum Verkaufszeitpunkt). NULL = kein Promoter-Verkauf.';
comment on column bookings.idempotency_key is
  'Schlüssel des Bestätigungsschritts; eindeutig → ein Doppelklick erzeugt keine zweite Buchung (RISKS Nr. 11).';
comment on column bookings.seats is
  'Personen = belegte Sitze im Kontingent. Bei 10+1 sind das 11, bezahlt werden paid_seats (RISKS Nr. 22).';
comment on column bookings.paid_seats is
  'Bezahlte und provisionierte Plätze = seats − free_persons.';
comment on column bookings.free_persons is
  'Gratisplätze aus der Gruppenregel (belegen Kontingent, kosten nichts).';
comment on column bookings.ticket_price_cents_snapshot is
  'Ticketpreis pro Person zum Verkaufszeitpunkt (effective_price_cents ticket_price). Snapshot, Hard Rule 7.';
comment on column bookings.deposit_amount_cents_snapshot is
  'Betrag der Anzahlungsregel zum Verkaufszeitpunkt (heute pro Person; Basis-Snapshot folgt mit E5.2). Pflicht bei payment_type = deposit.';
comment on column bookings.commission_per_ticket_cents_snapshot is
  'Provision pro bezahltem Ticket zum Verkaufszeitpunkt (effective_commission_cents). Snapshot, RISKS Nr. 21.';
comment on column bookings.group_threshold_snapshot is
  'Schwelle der Gruppenregel zum Verkaufszeitpunkt (effective_group_rule).';
comment on column bookings.group_free_snapshot is
  'Gratisplätze der Gruppenregel zum Verkaufszeitpunkt (effective_group_rule).';
comment on column bookings.commission_total_cents is
  'Provision dieser Buchung = paid_seats × commission_per_ticket_cents_snapshot. Auswertung summiert nur diese Spalte.';
comment on column bookings.amount_due_cents is
  'Offener Rest (im Bus zu kassieren) = total_amount_cents − amount_paid_cents. Generiert.';
comment on column bookings.payment_status is
  'Vom Promoter markiert: deposit_received oder fully_paid. Jede Änderung steht im booking_audit_log.';
comment on column bookings.sold_at is
  'Zeitpunkt, zu dem die Beträge berechnet (Quote) und bestätigt wurden.';
comment on column bookings.cancelled_at is
  'Storno-Zeitpunkt (nur network_operator). Sitze wurden ans Kontingent zurückgegeben.';
comment on column bookings.cancelled_by is
  'Profil, das storniert hat (network_operator).';
comment on column bookings.cancellation_reason is
  'Freitext zum Storno (z. B. Kunde erschienen nicht, Event abgesagt).';

-- Ein Schlüssel = eine Buchung. Partiell, weil Online-Buchungen keinen tragen.
create unique index bookings_idempotency_key_key
  on bookings (idempotency_key) where idempotency_key is not null;

create index bookings_promoter_sold_idx
  on bookings (promoter_id, sold_at desc) where promoter_id is not null;

alter table bookings
  -- Rest im Bus darf nie negativ sein (gilt für jeden Kanal).
  add constraint amount_paid_within_total
    check (amount_paid_cents <= total_amount_cents),

  -- Sitze = bezahlt + gratis, sobald die Aufteilung gesetzt ist.
  add constraint seats_split_consistent
    check (
      (paid_seats is null and free_persons is null)
      or seats = paid_seats + free_persons
    ),

  -- Promoter-Verkauf: alle Snapshots und der Promoter sind Pflicht (Hard Rule 7
  -- DB-seitig erzwungen). Online-Buchungen der Handover-Funktion bleiben frei.
  add constraint promoter_booking_complete
    check (
      channel <> 'promoter'
      or (
        promoter_id is not null
        and idempotency_key is not null
        and paid_seats is not null
        and free_persons is not null
        and ticket_price_cents_snapshot is not null
        and commission_per_ticket_cents_snapshot is not null
        and group_threshold_snapshot is not null
        and group_free_snapshot is not null
        and commission_total_cents is not null
        and payment_status is not null
        and sold_at is not null
      )
    ),

  -- Anzahlung gewählt → der Anzahlungs-Snapshot muss da sein.
  add constraint promoter_deposit_snapshot_present
    check (
      channel <> 'promoter'
      or payment_type <> 'deposit'
      or deposit_amount_cents_snapshot is not null
    ),

  -- Zahlungsstatus passt zu den Beträgen und zur Zahlart:
  --   fully_paid       ⇔ kassiert = Gesamt
  --   deposit_received ⇒ Zahlart Anzahlung und kassiert < Gesamt
  add constraint payment_status_matches_amounts
    check (
      payment_status is null
      or (payment_status = 'fully_paid' and amount_paid_cents = total_amount_cents)
      or (payment_status = 'deposit_received' and payment_type = 'deposit' and amount_paid_cents < total_amount_cents)
    ),

  -- Storno-Felder gehören zusammen; wer cancelled_at hat, ist storniert/erstattet.
  -- Nur in diese Richtung geprüft, damit release_departure_seats() (setzt nur
  -- status = 'cancelled') weiterhin als erster Schritt eines Stornos laufen kann.
  add constraint cancellation_fields_consistent
    check (
      (cancelled_at is null) = (cancelled_by is null)
      and (cancelled_at is null or status in ('cancelled', 'refunded'))
    );

-- ---------------------------------------------------------------------------
-- Audit-Log pro Buchung (append-only)
-- ---------------------------------------------------------------------------

create table booking_audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references bookings (id) on delete cascade,
  action booking_audit_action not null,
  -- Wer: Profil des Handelnden (Promoter oder network_operator). NULL = System.
  actor_id uuid references profiles (id),
  actor_role user_role,
  -- Vorher/Nachher als JSON (z. B. {"payment_status":"deposit_received"} →
  -- {"payment_status":"fully_paid","amount_paid_cents":12000}).
  old_values jsonb,
  new_values jsonb,
  note text,
  created_at timestamptz not null default now()
);

comment on table booking_audit_log is
  'Append-only: jede fachliche Änderung an einer Buchung (Verkauf, Zahlungsstatus, Storno) mit Handelndem, Zeitpunkt und Vorher/Nachher. Aus der App nicht schreibbar — nur die Funktionen in E5.3 schreiben hier.';

create index booking_audit_log_booking_idx on booking_audit_log (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- Nachrichten-Queue (nur Daten, kein Versand)
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  kind notification_kind not null,
  -- NULL, bis F20 den Kanal festlegt.
  channel notification_channel,
  -- Empfänger-Snapshot aus der Buchung (gleiche Löschbarkeit wie bookings, RISKS Nr. 13)
  recipient_name text not null,
  recipient_phone text,
  recipient_email text,
  -- Wann zu senden: Bestätigung = Verkaufszeitpunkt, Erinnerung = starts_at − 4 h / − 1 h
  scheduled_for timestamptz not null,
  status notification_status not null default 'pending',
  -- Vorgerenderter Inhalt (Sprache/Absender nach F21); bis dahin Platzhalter.
  payload jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Pro Buchung je Art genau eine Nachricht.
  constraint notifications_booking_kind_key unique (booking_id, kind),
  constraint notifications_sent_has_timestamp
    check ((status = 'sent') = (sent_at is not null))
);

comment on table notifications is
  'Nachrichten-Auslöser als Daten: Bestätigung + Erinnerung 4 h/1 h pro Buchung, status pending = ausstehend. Versand ist ein späterer, getrennter Prozess (F20); er setzt sent/failed.';

-- Was der spätere Versand-Prozess abarbeitet: pending, fällig.
create index notifications_due_idx on notifications (scheduled_for) where status = 'pending';
create index notifications_booking_idx on notifications (booking_id);

-- ---------------------------------------------------------------------------
-- RLS + Grants: deny-by-default; Promoter liest eigene, Operator alles;
-- authenticated schreibt NICHTS (nur Funktionen in E5.3, SECURITY DEFINER).
-- ---------------------------------------------------------------------------

-- bookings: RLS ist seit 0003 aktiv; bisher ohne Grant/Policy für authenticated.
grant select on bookings to authenticated;

create policy bookings_select_own_promoter on bookings
  for select to authenticated
  using (is_active_profile() and promoter_id = auth.uid());

create policy bookings_select_network_operator on bookings
  for select to authenticated
  using (is_network_operator());

alter table booking_audit_log enable row level security;
alter table notifications enable row level security;

grant select on booking_audit_log, notifications to authenticated;

-- Promoter: nur Zeilen zu eigenen Buchungen (die Unterabfrage läuft unter der
-- bookings-Policy des Aufrufers — fremde Buchungen sind dort unsichtbar).
create policy booking_audit_log_select_own_promoter on booking_audit_log
  for select to authenticated
  using (
    is_active_profile()
    and exists (select 1 from bookings b where b.id = booking_id and b.promoter_id = auth.uid())
  );
create policy booking_audit_log_select_network_operator on booking_audit_log
  for select to authenticated
  using (is_network_operator());

create policy notifications_select_own_promoter on notifications
  for select to authenticated
  using (
    is_active_profile()
    and exists (select 1 from bookings b where b.id = booking_id and b.promoter_id = auth.uid())
  );
create policy notifications_select_network_operator on notifications
  for select to authenticated
  using (is_network_operator());

-- service_role (BYPASSRLS, nur serverseitig): Audit-Log auch dort append-only
-- (kein UPDATE/DELETE); notifications braucht UPDATE für den späteren Versand.
grant select, insert on booking_audit_log to service_role;
grant select, insert, update on notifications to service_role;

-- anon: seit 0004 per Default ohne Rechte auf neuen Tabellen; ausdrücklich bestätigt.
revoke all on bookings, booking_audit_log, notifications from anon;
