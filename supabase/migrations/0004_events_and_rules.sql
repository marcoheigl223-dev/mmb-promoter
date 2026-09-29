-- 0004_events_and_rules.sql — Termine/Events, Provisions- und Gruppenregeln (Etappe E3.1)
--
-- Enthält (alles additiv, Hard Rule 1; 0001–0003 bleiben unberührt):
--   * tour_departures: zwei neue Spalten
--       is_internal  — internes Event (nur im Netzwerk, nie öffentlich; F4-Flag)
--       note         — freie Notiz für Gabo
--   * commission_rules — Provision als DATEN, append-only:
--       departure_id NULL      = Standard für alle Termine (10 €/Ticket, DECISIONS 16.09.)
--       departure_id gesetzt   = Ausnahme für genau diesen Termin/Event
--       commission_cents NULL  = (nur bei Ausnahme) „ab hier wieder Standard"
--       valid_from             = Gültig-ab; die jüngste gültige Zeile zählt
--   * group_rules — 10+1-Parameter als DATEN, append-only (Schwelle 11, gratis 1)
--   * effective_commission_cents(departure, at) / effective_group_rule(at):
--     liefern die zum Zeitpunkt gültigen Werte (E5 speichert sie als Snapshot,
--     RISKS Nr. 21 — spätere Änderungen schreiben keine Historie um).
--   * RLS deny-by-default auf beiden neuen Tabellen; nur network_operator
--     schreibt; UPDATE/DELETE für authenticated gar nicht gegrantet →
--     append-only ist DB-seitig erzwungen (TASKS E3.3: „Regeländerung erzeugt
--     neue Gültigkeit, überschreibt keine alte").
--   * tour_departures: INSERT/UPDATE für authenticated nur auf den Spalten,
--     die Gabo pflegt (Spalten-Grant). seats_booked_total bleibt für die App
--     unschreibbar — nur reserve_/release_departure_seats() ändern den Zähler
--     (Hard Rule 4). Kein DELETE-Grant: Absagen = status 'cancelled'.
--
-- Beträge stehen hier NUR als Datenzeilen (insert), nie als Konstante in
-- Funktionen oder App-Code. Gabo ändert sie im Admin-Bereich (E3.2).
-- Kein Trigger auf tour_departures: der UPDATE-Pfad der Reserve-Funktion
-- bleibt frei von Nebeneffekten.

-- ---------------------------------------------------------------------------
-- tour_departures: Event-Flag + Notiz
-- ---------------------------------------------------------------------------

alter table tour_departures
  add column is_internal boolean not null default false,
  add column note text;

comment on column tour_departures.is_internal is
  'Internes Event: wird nur im Promoter-Netzwerk verkauft, erscheint nie auf einem öffentlichen Kanal. Darf eine eigene Provision haben (commission_rules mit departure_id).';
comment on column tour_departures.note is
  'Freie Notiz von Gabo (Treffpunkt, Besonderheiten). Nicht für Kunden.';

-- ---------------------------------------------------------------------------
-- Provisionsregeln (append-only)
-- ---------------------------------------------------------------------------

create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  -- NULL = Standard für alle Termine; gesetzt = Ausnahme für diesen Termin/Event
  departure_id uuid references tour_departures (id) on delete cascade,
  -- Provision pro bezahltem Ticket in Cent. NULL nur bei Ausnahme = "wieder Standard".
  commission_cents integer check (commission_cents >= 0),
  valid_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  constraint commission_standard_has_amount
    check (departure_id is not null or commission_cents is not null)
);

comment on table commission_rules is
  'Provision pro Ticket als Datensatz, append-only. Jüngste Zeile mit valid_from <= Zeitpunkt gilt; Termin-Ausnahme schlägt Standard.';

create index commission_rules_lookup_idx
  on commission_rules (departure_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- 10+1-Gruppenregel (append-only, global)
-- ---------------------------------------------------------------------------

create table group_rules (
  id uuid primary key default gen_random_uuid(),
  -- ab dieser Personenzahl greift die Regel (11)
  threshold_persons integer not null check (threshold_persons >= 2),
  -- so viele Personen sind gratis (1); 0 = Regel praktisch aus
  free_persons integer not null check (free_persons >= 0),
  valid_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  constraint group_free_below_threshold check (free_persons < threshold_persons)
);

comment on table group_rules is
  'Gruppenregel (10+1) als Datensatz, append-only. Gratisplätze belegen Kontingent, bezahlt/provisioniert wird Personen minus Gratis (DECISIONS 16.09.).';

create index group_rules_lookup_idx on group_rules (valid_from desc);

-- ---------------------------------------------------------------------------
-- Startwerte = Marcos Regeln vom 16.09.2026 (DECISIONS „Geschäftsregeln")
-- Als Daten, gültig ab dem Entscheidungstag. Gabo ändert sie in E3.2.
-- ---------------------------------------------------------------------------

insert into commission_rules (departure_id, commission_cents, valid_from)
values (null, 1000, timestamptz '2026-09-16 00:00:00+02');

insert into group_rules (threshold_persons, free_persons, valid_from)
values (11, 1, timestamptz '2026-09-16 00:00:00+02');

-- ---------------------------------------------------------------------------
-- Gültige Werte zu einem Zeitpunkt (security invoker → RLS des Aufrufers gilt)
-- ---------------------------------------------------------------------------

create function effective_commission_cents(
  p_departure_id uuid,
  p_at timestamptz default now()
) returns integer
language sql
stable
as $$
  with override as (
    select commission_cents
    from commission_rules
    where departure_id = p_departure_id and valid_from <= p_at
    order by valid_from desc, created_at desc
    limit 1
  ),
  standard as (
    select commission_cents
    from commission_rules
    where departure_id is null and valid_from <= p_at
    order by valid_from desc, created_at desc
    limit 1
  )
  select coalesce(
    (select commission_cents from override),
    (select commission_cents from standard)
  )
$$;

comment on function effective_commission_cents(uuid, timestamptz) is
  'Provision in Cent, die für diesen Termin zum Zeitpunkt gilt: jüngste Termin-Ausnahme, sonst jüngster Standard. NULL nur, wenn kein Standard gültig ist.';

create function effective_group_rule(
  p_at timestamptz default now()
) returns table (threshold_persons integer, free_persons integer)
language sql
stable
as $$
  select threshold_persons, free_persons
  from group_rules
  where valid_from <= p_at
  order by valid_from desc, created_at desc
  limit 1
$$;

comment on function effective_group_rule(timestamptz) is
  'Gruppenregel (Schwelle, Gratisplätze), die zum Zeitpunkt gilt. Leer, wenn keine Regel gültig ist.';

grant execute on function effective_commission_cents(uuid, timestamptz) to authenticated, service_role;
grant execute on function effective_group_rule(timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS + Grants: deny-by-default, nur network_operator schreibt
-- ---------------------------------------------------------------------------

alter table commission_rules enable row level security;
alter table group_rules enable row level security;

-- Lesen: jedes aktive Profil (Promoter brauchen die gültige Regel in E5).
grant select on commission_rules, group_rules to authenticated;
create policy commission_rules_select_active_profile on commission_rules
  for select to authenticated using (is_active_profile());
create policy group_rules_select_active_profile on group_rules
  for select to authenticated using (is_active_profile());

-- Schreiben: nur INSERT, nur network_operator, created_by = der Aufrufer.
-- Kein UPDATE-/DELETE-Grant → Historie kann aus der App nicht verändert werden.
grant insert on commission_rules, group_rules to authenticated;
create policy commission_rules_insert_network_operator on commission_rules
  for insert to authenticated
  with check (is_network_operator() and created_by = auth.uid());
create policy group_rules_insert_network_operator on group_rules
  for insert to authenticated
  with check (is_network_operator() and created_by = auth.uid());

grant select, insert, update, delete on commission_rules, group_rules to service_role;

-- tour_departures: Gabo legt Termine an und pflegt Kontingent/Status/Flag/Notiz.
-- Spalten-Grant: seats_booked_total ist NICHT dabei (Hard Rule 4), id/created_at
-- auch nicht (Defaults). Kein DELETE: Absage = status 'cancelled'.
grant insert (title, starts_at, capacity_total, status, is_internal, note)
  on tour_departures to authenticated;
grant update (title, starts_at, capacity_total, status, is_internal, note)
  on tour_departures to authenticated;

create policy tour_departures_insert_network_operator on tour_departures
  for insert to authenticated
  with check (is_network_operator());
create policy tour_departures_update_network_operator on tour_departures
  for update to authenticated
  using (is_network_operator())
  with check (is_network_operator());

-- ---------------------------------------------------------------------------
-- Befund beim Einspielen (29.09.2026): Die Standard-Privilegien der lokalen
-- Supabase-Instanz geben anon UND authenticated auf jeder neuen Tabelle in
-- public automatisch TRUNCATE, REFERENCES, TRIGGER, MAINTAIN (pg_default_acl
-- der Rolle postgres). Das widerspricht deny-by-default: authenticated könnte
-- damit z. B. die Regel-Historie leeren, sobald irgendein Pfad TRUNCATE
-- erreicht. Additiv korrigiert — für alle bestehenden Tabellen und als
-- Default für künftige. Die gezielten Grants oben/in 0003 bleiben erhalten.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger, maintain on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- Die neuen Funktionen bekommen per Default EXECUTE für public/anon — nicht nötig.
revoke all on function effective_commission_cents(uuid, timestamptz) from public, anon;
revoke all on function effective_group_rule(timestamptz) from public, anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
