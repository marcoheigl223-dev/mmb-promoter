-- 0008_event_images.sql — Event-Bilder für Vorlagen und Termine/Events (E5.3, Auftrag Marco 02.10.2026)
--
-- Marco: „Bild pro Event + pro Vorlage (Supabase Storage lokal), Anzeige im Admin
-- + später Promoter-Dashboard. Nur network_operator lädt hoch, Größenlimit ~5 MB,
-- Formate jpg/png/webp, web-optimiert, Vorlagen-Bild wird beim Event-Anlegen
-- übernommen. Additiv, Storage-Policies deny-by-default."
--
-- Alles additiv (Hard Rule 1); 0001–0007 bleiben unberührt; die Reserve-Funktion
-- aus 0002 wird NICHT angefasst (Hard Rule 4). Ausgestaltung: docs/DECISIONS.md
-- 02.10.2026 (E5.3-Punkte), F19 = privat.
--
-- Enthält:
--   * event_templates.image_path, tour_departures.image_path (text, nullable):
--     Pfad des Objekts im Bucket „event-images" (z. B. templates/<id>/<uuid>.webp,
--     departures/<id>/<uuid>.webp). NULL = kein Bild. Check: 1–500 Zeichen,
--     kein „..", kein führender „/". Die Datei selbst liegt in Supabase Storage.
--   * Bucket storage.buckets „event-images": PRIVAT (F19), Limit 5 MiB,
--     erlaubte MIME-Typen image/jpeg, image/png, image/webp. Gelesen wird nur
--     über signierte URLs (App, 1 h); die Storage-API prüft dabei die SELECT-Policy.
--   * Policies auf storage.objects (deny-by-default: ohne Policy sieht/schreibt
--     niemand): aktive Profile lesen (Promoter-Dashboard später), nur
--     network_operator schreibt/ersetzt/löscht. anon: keine Policy → nichts.
--   * Spalten-Grants: authenticated darf image_path setzen (UPDATE auf beiden
--     Tabellen; INSERT auf tour_departures für die Übernahme beim Anlegen) —
--     die Zeilen-Policies aus 0004/0007 (nur network_operator) gelten weiter.
--   * KEINE Härtung der Storage-Default-Grants (anon/authenticated haben auf
--     storage.objects/buckets TRUNCATE/REFERENCES/TRIGGER vom Grantor
--     supabase_storage_admin): Ein revoke als Rolle postgres (kein Superuser,
--     kein Mitglied von supabase_storage_admin) läuft nachweislich ins Leere
--     (Trockenlauf 02.10.2026). Das Schema storage ist nicht über PostgREST
--     erreichbar (config.toml [api] schemas), nur über die Storage-API, die
--     ausschließlich SELECT/INSERT/UPDATE/DELETE unter RLS ausführt → RISKS Nr. 25.
--   * create_departure_from_template(): identisch zu 0007, nur die INSERT-Liste
--     kopiert zusätzlich image_path (Vorlagen-Bild wird übernommen, kein
--     Live-Bezug — das Objekt wird dabei nicht dupliziert, nur der Pfad).
--
-- Bewusst NICHT hier (Hard Rule 5):
--   * Kein öffentlicher Bucket, keine öffentliche URL (F19: privat).
--   * Keine Bildbearbeitung in der DB — Verkleinern/WebP macht die App vor dem
--     Upload (sharp). Das Bucket-Limit ist die zweite Schranke.
--   * Kein Löschen von Objekten per Trigger: die App entfernt ein altes Objekt
--     nur, wenn keine Vorlage/kein Termin es mehr referenziert.

-- ---------------------------------------------------------------------------
-- Spalten
-- ---------------------------------------------------------------------------

alter table event_templates
  add column image_path text
    constraint event_templates_image_path_check check (
      image_path is null
      or (char_length(image_path) between 1 and 500
          and image_path not like '%..%'
          and image_path not like '/%')
    );

comment on column event_templates.image_path is
  'E5.3: Pfad des Vorlagen-Bilds im privaten Storage-Bucket event-images (NULL = kein Bild). Wird beim Anlegen eines Events aus der Vorlage in tour_departures.image_path kopiert.';

alter table tour_departures
  add column image_path text
    constraint tour_departures_image_path_check check (
      image_path is null
      or (char_length(image_path) between 1 and 500
          and image_path not like '%..%'
          and image_path not like '/%')
    );

comment on column tour_departures.image_path is
  'E5.3: Pfad des Event-Bilds im privaten Storage-Bucket event-images (NULL = kein Bild). Beim Anlegen aus einer Vorlage kopiert, danach eigenständig.';

-- Spalten-Grants (die Policies aus 0004/0007 lassen nur network_operator schreiben).
grant update (image_path) on event_templates to authenticated;
grant insert (image_path), update (image_path) on tour_departures to authenticated;

-- ---------------------------------------------------------------------------
-- Bucket (privat) + Policies auf storage.objects — deny-by-default
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);

-- Lesen: jedes aktive Profil (Admin heute, Promoter-Dashboard später) — nur
-- über signierte URLs, die die Storage-API gegen diese Policy erzeugt.
create policy event_images_select_active_profile on storage.objects
  for select to authenticated
  using (bucket_id = 'event-images' and public.is_active_profile());

-- Schreiben/Ersetzen/Löschen: nur network_operator.
create policy event_images_insert_network_operator on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images' and public.is_network_operator());

create policy event_images_update_network_operator on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and public.is_network_operator())
  with check (bucket_id = 'event-images' and public.is_network_operator());

create policy event_images_delete_network_operator on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-images' and public.is_network_operator());

-- ---------------------------------------------------------------------------
-- Event aus Vorlage: Bild wird mit übernommen (sonst identisch zu 0007)
-- ---------------------------------------------------------------------------

create or replace function create_departure_from_template(
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
  -- E5.3 (0008): image_path wird mitkopiert — derselbe Objekt-Pfad, kein Live-Bezug.
  insert into tour_departures (title, starts_at, capacity_total, status, is_internal, note, template_id, image_path)
  values (t.title, p_starts_at, t.capacity_total, coalesce(p_status, 'open'), t.is_internal, t.note, t.id, t.image_path)
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
  'Legt einen Termin/Event aus einer aktiven Eventvorlage an: Titel, Kontingent, intern, Notiz und Bild (image_path, 0008) werden kopiert; gesetzte Vorlagen-Beträge (Ticketpreis, Anzahlung, Provision) werden Termin-Ausnahmen in pricing_rules/commission_rules. Nur network_operator (security invoker, RLS gilt). Liefert die Termin-ID.';

-- Rechte unverändert zu 0007 (create or replace behält sie; ausdrücklich wiederholt).
grant execute on function create_departure_from_template(uuid, timestamptz, text) to authenticated, service_role;
revoke all on function create_departure_from_template(uuid, timestamptz, text) from public, anon;
