-- 0005_pricing_rules.sql — Ticketpreis und Anzahlung als Daten (F14, Auftrag Marco 30.09.2026)
--
-- Enthält (alles additiv, Hard Rule 1; 0001–0004 bleiben unberührt; die
-- Reserve-Funktion aus 0002 wird NICHT angefasst, Hard Rule 4):
--   * Enum pricing_kind — 'ticket_price' (Preis pro Person) | 'deposit' (Anzahlung pro Person)
--   * pricing_rules — Beträge als DATEN, append-only, gleiches Muster wie commission_rules:
--       kind                   = welcher Betrag
--       departure_id NULL      = Standard für alle Termine
--       departure_id gesetzt   = eigener Wert für genau diesen Termin/Event
--       amount_cents NULL      = (nur bei Ausnahme) „ab hier wieder Standard"
--       valid_from             = Gültig-ab; die jüngste gültige Zeile zählt
--   * effective_price_cents(kind, departure, at): liefert den zum Zeitpunkt
--     gültigen Betrag pro Person (E5 speichert ihn pro Buchung als Snapshot,
--     Hard Rule 7 — kassierter Betrag und offener Rest sind damit rekonstruierbar).
--   * RLS deny-by-default; nur network_operator schreibt; UPDATE/DELETE für
--     authenticated gar nicht gegrantet → Historie bleibt vollständig.
--
-- Startwerte als DATEN:
--   * Anzahlung: 30,00 € pro Person, gültig ab 16.09.2026 (DECISIONS 16.09., Regel 1).
--   * Ticketpreis: KEIN Startwert. Der reguläre Ticketpreis ist in keiner
--     Entscheidung dokumentiert — er wird nicht geraten (Hard Rule 5, RISKS F15),
--     sondern von Gabo unter /admin/regeln eingetragen. Bis dahin liefert
--     effective_price_cents('ticket_price', …) NULL und E5 verkauft nicht.
--
-- Jeder Termin darf beides überschreiben (nicht nur interne Events): Marco,
-- 30.09.2026 — „ein Event/Termin optional einen EIGENEN Preis und eine EIGENE
-- Anzahlung … Interne Events können beides frei setzen". Die Pflege läuft
-- über die Felder auf der Termin-Detailseite und beim Anlegen (E3.4).

-- ---------------------------------------------------------------------------
-- Enum + Tabelle
-- ---------------------------------------------------------------------------

create type pricing_kind as enum ('ticket_price', 'deposit');

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  kind pricing_kind not null,
  -- NULL = Standard für alle Termine; gesetzt = eigener Wert für diesen Termin/Event
  departure_id uuid references tour_departures (id) on delete cascade,
  -- Betrag pro Person in Cent. NULL nur bei Ausnahme = "wieder Standard".
  amount_cents integer check (amount_cents >= 0),
  valid_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  constraint pricing_standard_has_amount
    check (departure_id is not null or amount_cents is not null)
);

comment on table pricing_rules is
  'Ticketpreis und Anzahlung pro Person als Datensatz, append-only. kind = ticket_price | deposit. Jüngste Zeile mit valid_from <= Zeitpunkt gilt; Termin-Ausnahme schlägt Standard; amount_cents NULL bei Ausnahme = wieder Standard.';

create index pricing_rules_lookup_idx
  on pricing_rules (kind, departure_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- Startwert = Marcos Regel vom 16.09.2026 (Anzahlung 30 € pro Person).
-- Kein Ticketpreis-Startwert (siehe Kopf, RISKS F15).
-- ---------------------------------------------------------------------------

insert into pricing_rules (kind, departure_id, amount_cents, valid_from)
values ('deposit', null, 3000, timestamptz '2026-09-16 00:00:00+02');

-- ---------------------------------------------------------------------------
-- Gültiger Betrag zu einem Zeitpunkt (security invoker → RLS des Aufrufers gilt)
-- ---------------------------------------------------------------------------

create function effective_price_cents(
  p_kind pricing_kind,
  p_departure_id uuid,
  p_at timestamptz default now()
) returns integer
language sql
stable
as $$
  with override as (
    select amount_cents
    from pricing_rules
    where kind = p_kind and departure_id = p_departure_id and valid_from <= p_at
    order by valid_from desc, created_at desc
    limit 1
  ),
  standard as (
    select amount_cents
    from pricing_rules
    where kind = p_kind and departure_id is null and valid_from <= p_at
    order by valid_from desc, created_at desc
    limit 1
  )
  select coalesce(
    (select amount_cents from override),
    (select amount_cents from standard)
  )
$$;

comment on function effective_price_cents(pricing_kind, uuid, timestamptz) is
  'Betrag pro Person in Cent (ticket_price oder deposit), der für diesen Termin zum Zeitpunkt gilt: jüngste Termin-Ausnahme, sonst jüngster Standard. NULL, wenn kein Standard gültig ist.';

grant execute on function effective_price_cents(pricing_kind, uuid, timestamptz) to authenticated, service_role;
-- Default-EXECUTE für public/anon ist seit 0004 entzogen (alter default privileges);
-- hier zur Sicherheit noch einmal ausdrücklich, falls die Migration auf einer
-- Instanz ohne diese Defaults läuft.
revoke all on function effective_price_cents(pricing_kind, uuid, timestamptz) from public, anon;

-- ---------------------------------------------------------------------------
-- RLS + Grants: deny-by-default, nur network_operator schreibt (wie 0004)
-- ---------------------------------------------------------------------------

alter table pricing_rules enable row level security;

-- Lesen: jedes aktive Profil (Promoter brauchen Preis/Anzahlung in E5).
grant select on pricing_rules to authenticated;
create policy pricing_rules_select_active_profile on pricing_rules
  for select to authenticated using (is_active_profile());

-- Schreiben: nur INSERT, nur network_operator, created_by = der Aufrufer.
-- Kein UPDATE-/DELETE-Grant → Historie kann aus der App nicht verändert werden.
grant insert on pricing_rules to authenticated;
create policy pricing_rules_insert_network_operator on pricing_rules
  for insert to authenticated
  with check (is_network_operator() and created_by = auth.uid());

grant select, insert, update, delete on pricing_rules to service_role;

-- anon: seit 0004 per Default ohne Rechte auf neuen Tabellen; ausdrücklich bestätigt.
revoke all on pricing_rules from anon;
