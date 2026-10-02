-- 0007_event_templates.sql — Eventvorlagen (Etappe E5.2, Auftrag Marco 02.10.2026)
--
-- Marco: „Gabo speichert eine Vorlage (Titel, Beträge/Anzahlung, Ticketzahl/
-- Kontingent, Provision, später Bild) und legt daraus neue Events an, bei denen
-- er nur Datum/Uhrzeit ändert. Additiv, RLS deny-by-default (nur
-- network_operator schreibt), als DB-Daten."
--
-- Alles additiv (Hard Rule 1); 0001–0006 bleiben unberührt; die Reserve-Funktion
-- aus 0002 wird NICHT angefasst (Hard Rule 4). Plan docs/ETAPPE5_PLAN.md D7:
-- Vorlagen sind editierbare Stammdaten (keine Abrechnungs-Historie → kein
-- append-only nötig). „Event aus Vorlage" KOPIERT die Werte in tour_departures
-- + pricing_rules-/commission_rules-Ausnahmen; spätere Vorlagen-Änderungen
-- berühren bestehende Events nie. tour_departures.template_id merkt nur die
-- Herkunft.
--
-- Enthält:
--   * event_templates — Stammdaten je Vorlage:
--       name                 = Bezeichnung der Vorlage (für Gabos Liste)
--       title                = Titel, den das Event bekommt
--       capacity_total       = Kontingent (Ticketzahl für das Promoter-Netzwerk)
--       is_internal, note    = wie am Termin
--       ticket_price_cents   = eigener Ticketpreis pro Person; NULL = Standard
--       deposit_cents        = eigene Anzahlung pro Person;   NULL = Standard
--       commission_cents     = eigene Provision pro Ticket;   NULL = Standard
--       active               = deaktivieren statt löschen (kein DELETE-Grant)
--       created_by, created_at, updated_at (Trigger nur auf DIESER Tabelle)
--   * tour_departures.template_id (nullable, FK) — Herkunft; nur INSERT-Grant,
--     kein UPDATE: die Herkunft wird nicht nachträglich umgehängt.
--   * create_departure_from_template(vorlage, starts_at, status) — legt in EINER
--     Transaktion den Termin + die Preis-/Anzahlungs-/Provisions-Ausnahmen an
--     (nur die, die in der Vorlage gesetzt sind). security INVOKER: die
--     Policies und Spalten-Grants aus 0004/0005 gelten unverändert für den
--     Aufrufer — die Funktion schafft keine neuen Rechte.
--   * RLS deny-by-default: Vorlagen sieht und pflegt nur network_operator
--     (SELECT/INSERT/UPDATE, kein DELETE). Promoter brauchen Vorlagen nicht —
--     sie sehen Events, nicht deren Herkunft.
--
-- Bewusst NICHT hier (Hard Rule 5):
--   * Bild (image_path): „später Bild" — kommt mit dem Storage-Bucket (E5.7, F19).
--   * Anzahlungsbasis / Gesamtbetrag (F16) und 10+1-Optionen (F11/F18): offen.
--   * Keine Startwerte — Vorlagen legt Gabo selbst an.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table event_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  title text not null check (length(btrim(title)) between 1 and 200),
  capacity_total integer not null check (capacity_total >= 0),
  is_internal boolean not null default false,
  note text check (note is null or length(note) <= 2000),
  -- Beträge in Cent pro Person/Ticket; NULL = beim Event gilt der Standard.
  ticket_price_cents integer check (ticket_price_cents >= 0),
  deposit_cents integer check (deposit_cents >= 0),
  commission_cents integer check (commission_cents >= 0),
  active boolean not null default true,
  created_by uuid references profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nur prüfbar, wenn beide Werte in der Vorlage stehen (sonst App-Prüfung gegen den Standard).
  constraint template_deposit_within_price
    check (ticket_price_cents is null or deposit_cents is null or deposit_cents <= ticket_price_cents)
);

comment on table event_templates is
  'Eventvorlagen (E5.2): Stammdaten, aus denen Gabo neue Termine/Events anlegt — nur Datum/Uhrzeit kommen dazu. Werte werden beim Anlegen KOPIERT (tour_departures + pricing_rules-/commission_rules-Ausnahmen); spätere Änderungen an der Vorlage berühren bestehende Events nicht. active = false statt löschen.';

create index event_templates_active_name_idx on event_templates (active, name);

-- updated_at automatisch — Trigger NUR auf event_templates (tour_departures bleibt triggerfrei).
create function event_templates_touch_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function event_templates_touch_updated_at() from public, anon, authenticated;

create trigger event_templates_set_updated_at
  before update on event_templates
  for each row execute function event_templates_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Herkunft am Termin (nullable). FK on delete set null: ein Event überlebt die
-- Vorlage immer — die Werte sind kopiert, der Verweis ist nur Information.
-- ---------------------------------------------------------------------------

alter table tour_departures
  add column template_id uuid references event_templates (id) on delete set null;

comment on column tour_departures.template_id is
  'Herkunft: aus welcher Eventvorlage dieser Termin angelegt wurde (NULL = von Hand). Werte wurden beim Anlegen kopiert, kein Live-Bezug.';

create index tour_departures_template_id_idx on tour_departures (template_id) where template_id is not null;

-- Spalten-Grant nur INSERT (Anlegen aus Vorlage). Kein UPDATE: Herkunft bleibt.
-- Die Policies tour_departures_insert_network_operator (0004) gelten weiter.
grant insert (template_id) on tour_departures to authenticated;

-- ---------------------------------------------------------------------------
-- RLS + Grants auf event_templates: deny-by-default, nur network_operator
-- ---------------------------------------------------------------------------

alter table event_templates enable row level security;

grant select, insert on event_templates to authenticated;
-- UPDATE nur auf die Pflege-Spalten: id, created_by, created_at, updated_at
-- sind für die App unveränderbar (updated_at setzt der Trigger).
grant update (name, title, capacity_total, is_internal, note,
              ticket_price_cents, deposit_cents, commission_cents, active)
  on event_templates to authenticated;
-- Kein DELETE-Grant: deaktivieren (active = false) statt löschen.

create policy event_templates_select_network_operator on event_templates
  for select to authenticated using (is_network_operator());
create policy event_templates_insert_network_operator on event_templates
  for insert to authenticated
  with check (is_network_operator() and created_by = auth.uid());
create policy event_templates_update_network_operator on event_templates
  for update to authenticated
  using (is_network_operator())
  with check (is_network_operator());

grant select, insert, update, delete on event_templates to service_role;

-- anon: seit 0004 per Default ohne Rechte auf neuen Tabellen; ausdrücklich bestätigt.
revoke all on event_templates from anon;

-- ---------------------------------------------------------------------------
-- Event aus Vorlage anlegen — eine Transaktion, Werte kopiert (D7)
-- ---------------------------------------------------------------------------

create function create_departure_from_template(
  p_template_id uuid,
  p_starts_at timestamptz,
  p_status text default 'open'
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  t event_templates%rowtype;
  v_departure_id uuid;
begin
  -- security invoker: ein Promoter sähe die Vorlage ohnehin nicht (RLS) und
  -- dürfte keinen Termin anlegen — hier trotzdem eine klare Meldung.
  if not is_network_operator() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_starts_at is null then
    raise exception 'STARTS_AT_REQUIRED' using errcode = '22004';
  end if;

  select * into t from event_templates where id = p_template_id;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not t.active then
    raise exception 'TEMPLATE_INACTIVE' using errcode = 'P0001';
  end if;

  -- Termin: alle Werte aus der Vorlage, nur Datum/Uhrzeit (+ Status) vom Aufrufer.
  -- Spalten-Grants + Policy aus 0004 gelten (seats_booked_total bleibt unberührt, Hard Rule 4).
  insert into tour_departures (title, starts_at, capacity_total, status, is_internal, note, template_id)
  values (t.title, p_starts_at, t.capacity_total, coalesce(p_status, 'open'), t.is_internal, t.note, t.id)
  returning id into v_departure_id;

  -- Eigene Beträge der Vorlage werden Termin-Ausnahmen (append-only-Tabellen,
  -- created_by = auth.uid() per Default, Policies aus 0004/0005). NULL = Standard → keine Zeile.
  if t.ticket_price_cents is not null then
    insert into pricing_rules (kind, departure_id, amount_cents)
    values ('ticket_price', v_departure_id, t.ticket_price_cents);
  end if;
  if t.deposit_cents is not null then
    insert into pricing_rules (kind, departure_id, amount_cents)
    values ('deposit', v_departure_id, t.deposit_cents);
  end if;
  if t.commission_cents is not null then
    insert into commission_rules (departure_id, commission_cents)
    values (v_departure_id, t.commission_cents);
  end if;

  return v_departure_id;
end
$$;

comment on function create_departure_from_template(uuid, timestamptz, text) is
  'Legt einen Termin/Event aus einer aktiven Eventvorlage an: Titel, Kontingent, intern, Notiz werden kopiert; gesetzte Vorlagen-Beträge (Ticketpreis, Anzahlung, Provision) werden Termin-Ausnahmen in pricing_rules/commission_rules. Nur network_operator (security invoker, RLS gilt). Liefert die Termin-ID.';

grant execute on function create_departure_from_template(uuid, timestamptz, text) to authenticated, service_role;
revoke all on function create_departure_from_template(uuid, timestamptz, text) from public, anon;
