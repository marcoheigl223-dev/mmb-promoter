-- 0001_inventory_core.sql — Kern-Inventar des Promoter-Netzwerks (mmb-promoter)
--
-- Enthält NUR das, was die übernommene Reservierungsfunktion aus
-- docs/handover/reserve-function-final.sql voraussetzt (TASKS E1.2):
--   * Enums booking_channel, payment_type, booking_status
--   * Tabelle tour_departures  — ein Termin/Event mit Kontingent
--   * Tabelle bookings         — genau die Spalten, die die Funktion befüllt
--   * Tabellenrechte für service_role (die Funktionen sind SECURITY DEFINER,
--     aufgerufen nur serverseitig mit Service-Role)
--
-- Keine Promoter-Spalten, keine Provision, keine Regeln, keine Profile —
-- das kommt additiv in späteren Migrationen (Etappen E2–E5).
--
-- KONTINGENT: capacity_total IST das Kontingent, das Gabo pro Termin manuell
-- einträgt (docs/DECISIONS.md, 16.09.2026). Eine andere Kapazität kennt dieses
-- System nicht; die Überbuchungssperre der Funktion wirkt unverändert dagegen.
--
-- Spaltentypen und Constraints spiegeln den geprüften Stand des Boots-Schemas
-- (dort Migration 0001 + 0002 abzüglich der in 0005 entfernten Promoter-Spalten),
-- damit die Funktion byteidentisch übernommen werden kann (Hard Rule 4).
-- Einzige bewusste Abweichung: capacity_total >= 0 statt > 0, damit Gabo einen
-- Termin anlegen und das Kontingent später eintragen kann.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- 'online' braucht die Handover-Funktion (fester Cast). 'promoter' ist der Kanal
-- dieses Projekts und wird hier direkt mit angelegt, damit später kein
-- ALTER TYPE ... ADD VALUE nötig ist (Hinweis aus docs/research/, Enum-Locks).
create type booking_channel as enum ('online', 'promoter');
create type payment_type as enum ('deposit', 'full');
create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'refunded');

-- ---------------------------------------------------------------------------
-- Termine / Events mit Kontingent
-- ---------------------------------------------------------------------------

create table tour_departures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,

  -- Kontingent (von Gabo manuell pro Termin eingetragen, ADR-0001)
  capacity_total integer not null check (capacity_total >= 0),
  -- einzige Kapazitätswahrheit; nur über reserve_/release_departure_seats() ändern
  seats_booked_total integer not null default 0 check (seats_booked_total >= 0),

  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),

  constraint total_within_capacity check (seats_booked_total <= capacity_total)
);

comment on table tour_departures is
  'Ein Termin/Event des Promoter-Netzwerks. capacity_total = Kontingent (manuell durch Gabo). seats_booked_total darf nur über reserve_departure_seats()/release_departure_seats() geändert werden (Hard Rule 4).';
comment on column tour_departures.capacity_total is
  'Kontingent, das Gabo diesem Termin zuteilt. Keine Kopplung an die Boots-DB (ADR-0001).';

create index tour_departures_starts_at_idx on tour_departures (starts_at);

-- ---------------------------------------------------------------------------
-- Buchungen — Spalten exakt so, wie die Handover-Funktion sie befüllt
-- ---------------------------------------------------------------------------

create table bookings (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references tour_departures (id),

  channel booking_channel not null,
  payment_type payment_type not null,

  seats integer not null check (seats > 0),
  total_amount_cents integer not null check (total_amount_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),

  status booking_status not null default 'pending',

  stripe_payment_intent_id text,

  customer_name text not null,
  customer_email text not null,
  customer_phone text,

  shuttle boolean not null default false,
  has_allergy boolean not null default false,
  allergy_details text,

  created_at timestamptz not null default now(),

  constraint allergy_details_when_flagged
    check (not has_allergy or (allergy_details is not null and length(trim(allergy_details)) > 0))
);

comment on table bookings is
  'Zahlungstyp und Beträge werden exakt pro Buchung gespeichert, nicht nur die Kapazität (Hard Rule 7).';

create index bookings_departure_id_idx on bookings (departure_id);

-- ---------------------------------------------------------------------------
-- Rechte: die SECURITY-DEFINER-Funktionen (Migration 0002) laufen als Owner;
-- service_role braucht die Tabellenrechte für Admin-Operationen (Termine anlegen).
-- RLS/Policies für authenticated folgen mit dem Auth-Flow (Etappe E2).
-- ---------------------------------------------------------------------------

grant usage on schema public to service_role;
grant select, insert, update, delete on tour_departures, bookings to service_role;
