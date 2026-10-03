# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 03.10.2026: E5.3 (Event-Bilder, Migration `0008_event_images.sql`) ist COMMITTET** (`a6eb1d9` Migration, `82602d2` Admin-UI, `8523526` Tests, Doku-Commit danach; nicht gepusht). Nächster Schritt: E5.4 Promoter-Verkauf (Migration 0009). Die Abschnitte unten beschreiben noch den Stand vor dem Commit. Einzige Datei, die überschrieben werden darf. Erledigte Schritte: `docs/CHANGELOG.md`.

## Wo wir stehen

- Arbeitsbaum: **uncommittete E5.3-Änderungen** (Liste unten) + Doku-Ergänzungen (DECISIONS-Eintrag 02.10. mit Marcos Antworten F22/F23/F11/F18 und Ausgestaltung E5.3, RISKS, TASKS, CHANGELOG, diese Datei). Dazu ggf. der Next.js-Block in `AGENTS.md`, den `next dev` neu schreibt.
- Migration 0008 ist lokal **eingespielt** (per `docker exec … psql`, Historie-Zeile `0008`). DB nach Tests + Round-Trip sauber: 0 Objekte im Bucket, 0 Vorlagen, 0 Test-Termine, 0 Termin-Regeln.
- **03.10.2026 nach PC-Neustart:** Docker Desktop war aus → gestartet, Container liefen von selbst an; Postgres brauchte ~13 min Crash-Recovery (fsync über 12.846 Dateien in `pg_logical/snapshots`) — bei jedem harten Neustart wieder möglich, einfach abwarten (`pg_isready`). Historie 0001–0008 + Seed (3 Konten) unverändert. In der DB stehen 2 Termine von Hand („Party Bus – Megapark Funbus" 10.10., „Barca Samba Disco-Boot" 12.10., je Kontingent 30) und eine **aktive Gruppenregel 10/1** (ab 29.09.2026, vom Test-Operator — vermutlich E3-Testwert, gilt aktuell statt 11/1). Beides nicht angefasst → Marco entscheidet.
- Verifikation E5.3: `tsc` 0, `eslint` 0, `tests/event-images.test.ts` 13/13, **`npm test` 180/180 in 14 Dateien** (8-parallel-Überbuchungstest + Funktions-Identität unverändert grün), Round-Trip durch die echten Server Actions 34/34 (Details im CHANGELOG-Eintrag 02.10. E5.3).

## Commit-Vorschlag E5.3 (wartet auf Marcos OK; `git diff` je Schritt, gezielt per Pfad)

1. **E5.3a Migration 0008:** `supabase/migrations/0008_event_images.sql`
2. **E5.3b Admin-UI + Config + Abhängigkeit:** `src/lib/admin/images.ts`, `src/app/admin/image-form.tsx`, `src/lib/admin/types.ts`, `src/lib/admin/queries.ts`, `src/app/admin/vorlagen/actions.ts`, `src/app/admin/vorlagen/page.tsx`, `src/app/admin/vorlagen/[id]/page.tsx`, `src/app/admin/termine/actions.ts`, `src/app/admin/termine/[id]/page.tsx`, `src/app/admin/termine/neu/page.tsx`, `src/app/admin/page.tsx`, `next.config.ts`, `package.json`, `package-lock.json`
3. **E5.3c Tests:** `tests/event-images.test.ts`, `tests/event-templates-rls.test.ts`, `tests/events-rules-rls.test.ts`
4. **docs:** `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `TASKS.md`, `PROGRESS.md` (Hash von 0008-Commit etc. vorher hier nachtragen)

## Offen für Marco

| Frage | blockiert | Vorschlag Claude |
|---|---|---|
| **F18** 10+1 bei 22 Personen: 2 gratis (pro vollem Block) oder 1? (Marcos Antwort 02.10. klärte die Anzahlungs**basis**, nicht die Blockzahl) | E5.4 `quote_promoter_sale()` | pro vollem Block |
| **F24** Startet ein Verkauf mit Zahlart Vollzahlung direkt als „voll bezahlt"? (Check aus 0006 verlangt es) | E5.4 `reserve_promoter_seats()` | ja |
| **F16-Rest** „freier Gesamtbetrag": kappen auf Gesamtpreis oder ablehnen? (Promoter-Wahl ist seit 02.10. geklärt) | E5.4/E5.5 | kappen |
| **F22-Interpretation** Verkauf mit kassiertem Geld → `bookings.status = 'confirmed'` (Marco nannte nur die Zahlungsstufen) | E5.4 | `confirmed` — bitte kurz bestätigen |
| **F8** Kunden-E-Mail am Strand Pflicht? (`customer_email NOT NULL` steht noch) | E5.5 | optional |
| F15 Ticketpreis-Betrag | erster echter Verkauf | Gabo trägt unter `/admin/regeln` ein |

## Nächster Schritt nach Marcos OK

E5.4 — Migration 0009: Funktionen (`quote_promoter_sale()`, `reserve_promoter_seats()` Option B neben der Handover-Funktion, **UPDATE-Block wörtlich**, eigener Identitäts-Test + eigener 8-parallel-Test; dritter `payment_status`-Wert „noch nichts kassiert" additiv; Startstatus `deposit_received`; Statusänderung Promoter/Gabo mit Audit-Zeile; Anzahlungsbasis als Feld pro Buchung, Standard „zahlende Köpfe"; Storno nur Gabo; `enqueue_booking_notifications()`). **Vorher F18, F24 (und F22-Interpretation) klären.**

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` → `supabase status/stop/start/db reset` scheitern. Docker läuft. Ausweichwege:

```
# Migration einspielen (additiv) — 0001–0008 sind eingespielt:
Get-Content supabase\migrations\000N_name.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie nachtragen: insert into supabase_migrations.schema_migrations (version, name, statements) values ('000N', 'name', array[<Dateitext>]);
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

## Lokal testen — Event-Bilder (E5.3) — Browser-Test durch Marco steht aus

Voraussetzung: Docker-Instanz läuft (`docker ps | findstr mmb-promoter`, 11 Container inkl. `supabase_storage_mmb-promoter`), `.env.local` im Root, `npm run dev` → http://127.0.0.1:3001. Testbilder nicht ins Repo legen (Hard Rule 9).

Login als **operator@mmb-promoter.test / operator-test-2026** (Seed, nur lokal):

1. **Vorlage mit Bild:** `/admin/vorlagen` → Vorlage anlegen (Name mit „TEST" beginnen) → Detailseite, Abschnitt „Bild" → JPG/PNG/WebP wählen → „Bild hochladen" → Vorschau erscheint, Meldung „Bild gespeichert. Bereits angelegte Events behalten ihr bisheriges Bild." Liste `/admin/vorlagen` zeigt das Vorschaubild. Großes Foto (z. B. 4000 px) kommt als WebP max. 1600 px an (Rechtsklick → Bild in neuem Tab: URL enthält `/object/sign/event-images/templates/…webp?token=`).
2. **Fehlerfälle:** Datei > 5 MB → „Bild ist zu groß (max. 5 MB)." (schon im Browser); PDF/Text → „Nur JPG, PNG oder WebP …"; umbenannte Nicht-Bild-Datei → Fehlermeldung vom Server (echtes Format wird aus den Bytes gelesen).
3. **Übernahme:** Detailseite → „Event aus dieser Vorlage anlegen" → Zusammenfassung zeigt „Bild: wird übernommen" + Vorschau → anlegen → Termin-Detail zeigt dasselbe Bild mit Hinweis „Aus der Vorlage übernommen. Ein neues Bild gilt nur für diesen Termin." `/admin` zeigt das Vorschaubild in der Liste.
4. **Kein Live-Bezug:** Vorlagen-Bild ersetzen → Termin behält sein Bild. Termin-Bild ersetzen → Vorlage unverändert. „Bild entfernen" am Termin → „Bild entfernt.", Platzhalter; Vorlage behält ihres.
5. **Promoter** (promoter@mmb-promoter.test / promoter-test-2026): `/admin/…` → `/kein-zugang`. Eine signierte URL aus Schritt 1 funktioniert auch im Promoter-Login (Lesen für aktive Profile, später Dashboard); nach 1 h läuft sie ab. Ohne Login (privates Fenster) → Fehler-JSON der Storage-API.

**Aufräumen nach dem Browser-Test** (nur als `postgres`; Termine zuerst, dann Vorlagen, dann Objekte — direkte DELETEs auf `storage.objects` brauchen die GUC, sonst „Direct deletion … not allowed"):
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from tour_departures where title like 'TEST%';" -c "delete from event_templates where name like 'TEST%';" -c "delete from pricing_rules where created_by is not null;" -c "delete from commission_rules where departure_id is null and commission_cents <> 1000;" -c "delete from group_rules where not (threshold_persons = 11 and free_persons = 1);" -c "begin; select set_config('storage.allow_delete_query','true',true); delete from storage.objects where bucket_id = 'event-images'; commit;" -c "select count(*) from storage.objects;"
```
Achtung: `delete from pricing_rules where created_by is not null` löscht auch einen eingetragenen Standard-Ticketpreis. Der letzte Befehl löscht **alle** Bilder im Bucket (lokal nur Testbilder).

Browser-Test Eventvorlagen (E5.2) wie im CHANGELOG-Eintrag 02.10. E5.2 beschrieben — ebenfalls noch offen.

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter   # Instanz läuft? (CLI blockiert, s. o.)
npm test                # Vitest: 14 Dateien, 180 Tests (app-access nur mit laufendem Dev-Server; event-images-HTTP nur mit laufender Storage-API, sonst skipped)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
git status              # E5.3 uncommittet (s. Commit-Vorschlag), AGENTS.md-Block von next dev ggf. geändert
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Storage-API | `http://127.0.0.1:45321/storage/v1` (Bucket `event-images`, privat) |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert

- Migrationen 0001–0008 (Inventar, Handover-Funktion unverändert, Profile/Rollen/RLS, Termine + Regeln, Preis/Anzahlung, Promoter-Verkaufs-Datenmodell, Eventvorlagen, **Event-Bilder**). Admin-Bereich: Termine, Regeln, Vorlagen, Bilder. Promoter-Bereich: Login + Platzhalter.
- 0008: `image_path` auf `event_templates`/`tour_departures`, privater Bucket `event-images` (5 MiB, jpg/png/webp), vier Policies auf `storage.objects` (aktive Profile lesen, nur `network_operator` schreibt/löscht), `create_departure_from_template()` kopiert den Pfad. App: `src/lib/admin/images.ts` (sharp → WebP ≤ 1600 px, EXIF weg), `image-form.tsx`, Server Actions je Tabelle, signierte URLs (1 h).
- 180 Tests grün, darunter 8-parallel-Überbuchungstest und Funktions-Identität gegen die Handover-Datei.

## Was noch NICHT existiert

- Kein Standard-Ticketpreis-Betrag (F15). Keine Konto-Verwaltung (E4). **Keine Verkaufs-/Storno-/Zahlungsstatus-Funktion, kein Verkaufs-Flow, kein Promoter-Dashboard (auch keine Bild-Anzeige dort), kein Nachrichten-Auslöser** — E5.4 ff. Anzahlungsbasis als Feld pro Buchung kommt mit E5.4 (Antwort F11/F18 vom 02.10.).

## Warnungen für den Wiedereinstieg

- **Nie `git add .`** — gezielt per Pfad. `.next/` ist ignoriert. Keine Testbilder ins Repo.
- `next dev` schreibt den Next.js-Block in `AGENTS.md` neu — Diff dort ignorieren bzw. mitcommitten.
- Deutsche Anführungszeichen in Code/Tests immer als `„…“` (U+201E/U+201C) — ein ASCII-`"` als Schlusszeichen bricht JSX/TS-Strings.
- Regeln sind append-only: Testwerte aus dem Browser bleiben stehen, bis man sie als `postgres` löscht (Befehl oben).
- Jede neue `create table`-Migration: Grants prüfen — `tests/events-rules-rls.test.ts` meldet, wenn `anon` wieder Rechte bekommt (RISKS Nr. 25); Erwartungsliste dort ergänzen (für 0008: `image_path`).
- **Storage (RISKS Nr. 25, E5.3):** `revoke` auf `storage.*` als `postgres` wirkt nicht (Eigentümer `supabase_storage_admin`) — Schutz ist RLS + Storage-API. Direkte DELETEs auf `storage.objects` brauchen `set_config('storage.allow_delete_query','true',true)` in der Transaktion (Trigger `protect_objects_delete`); die App löscht nur über `storage.remove()`. Die lokale Storage-API meldet Fehler als HTTP 400 mit echtem Code im JSON-Feld `statusCode`.
- `sharp` ist eine native Abhängigkeit: nach `npm ci` auf einem anderen Rechner prüfen, dass das Plattform-Binary mitkommt (`node -e "require('sharp')"`).
- E5.4: **Reserve-Funktion aus 0002 bleibt byteidentisch** (Option B). Neue Funktion `reserve_promoter_seats()` bekommt eigenen UPDATE-Block-Identitätstest + eigenen 8-parallel-Test, bevor irgendetwas committet wird (Hard Rule 4).
- Round-Trip-Skripte gegen Server Actions ohne JS: Formulare als **`multipart/form-data`** posten (urlencoded wird still ignoriert → 200 ohne Wirkung); `formatCents` setzt vor „€" ein geschütztes Leerzeichen (U+00A0). Node 24 unter Windows: `import` aus `C:/…`-Pfaden scheitert (ERR_UNSUPPORTED_ESM_URL_SCHEME) → `createRequire("C:/Projects/mmb-promoter/package.json")`.
- Tests laufen nur gegen localhost (`tests/db.ts`, `auth-login`, `app-access`, `event-images` prüfen die URL).
