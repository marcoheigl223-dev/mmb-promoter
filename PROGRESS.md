# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 02.10.2026: E5.1 und E5.2 (Eventvorlagen, Migration `0007_event_templates.sql`) committet — 8 Commits seit `7491cd5`, NICHT gepusht. Stopp vor E5.3: Marco klärt F22/F23/F11/F18.** Einzige Datei, die überschrieben werden darf. Erledigte Schritte stehen in `docs/CHANGELOG.md`.

## Wo wir stehen

- E1–E5.2 committet. E5.1: `2381526` (Plan E5 + DECISIONS), `b0fa251` (Migration 0006), `12ed080` (Tests), `56b0ad4` (Doku). E5.2 (02.10., Marcos OK, `git diff` je Schritt, gezielt per Pfad): `a508988` (E5.2a Migration 0007), `3e2f890` (E5.2b Admin-UI), `fc945b9` (E5.2c Tests), Doku-Commit = `HEAD` (Hash: `git log -1`). **Nicht gepusht** — `origin/main` steht auf `7491cd5` (E3). Push nur auf Marcos Wort.
- **Reihenfolge geändert (Marco, 02.10.):** Eventvorlagen sind E5.2 / 0007 (vorher Plan-Schritt E5.8 / 0011). Die alte E5.2 „Anzahlungsbasis + 10+1-Option" wartet weiter auf F11/F16/F18.
- Arbeitsbaum nach dem Doku-Commit: sauber (außer dem Next.js-Block in `AGENTS.md`, den `next dev` neu schreibt).
- Migration 0007 ist lokal **eingespielt** (per `docker exec … psql`, Historie-Zeile `0007`). DB nach Tests + Round-Trip sauber (0 Vorlagen, 0 Test-Termine, 0 Termin-Regeln).

## Commit-Aufteilung E5.2 (erledigt 02.10.2026)

1. `a508988` E5.2a: Migration 0007 — `supabase/migrations/0007_event_templates.sql`
2. `3e2f890` E5.2b: Admin-UI — `src/app/admin/vorlagen/`, `termine/from-template-form.tsx`, `termine/actions.ts`, `termine/neu/page.tsx`, `termine/[id]/page.tsx`, `admin/layout.tsx`, `lib/admin/{types,queries,errors}.ts`
3. `fc945b9` E5.2c: Tests — `tests/event-templates-rls.test.ts`, `tests/events-rules-rls.test.ts`, `tests/app-access.test.ts`
4. `HEAD` docs: `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `TASKS.md`, `PROGRESS.md`

## Offen für Marco (blockiert die nächsten Schritte)

| Frage | blockiert | Vorschlag Claude |
|---|---|---|
| **F23** Zahlungsstatus „noch nichts kassiert" nötig? | E5.3 (Funktionen) | nein — kein Verkauf ohne Geld |
| **F22** Bar-Anzahlung → `confirmed` oder `pending`? | E5.3 | `confirmed` |
| **F11** Anzahlung bei 10+1 für 10 oder 11 Personen? | E5.3 (`quote_promoter_sale()`) bzw. verschobene Anzahlungsbasis-Migration | Gabo-Option als Daten |
| **F16** „Gesamtbetrag" als Anzahlung: Gabo-Vorgabe pro Event oder freie Eingabe am Strand? Kappen? | verschobene Anzahlungsbasis-Migration, E5.5 | Gabo-Vorgabe, kappen auf Gesamtpreis |
| **F18** 10+1 bei 22 Personen: 2 gratis oder 1? | E5.3 | pro vollem Block |
| **F8** Kunden-E-Mail am Strand Pflicht? (`customer_email NOT NULL` steht noch) | E5.5 (Verkaufs-Flow) | optional |
| F19 Event-Bilder privat oder öffentlich? | E5.7 (Bild an der Vorlage und am Event) | privat |
| F15 Ticketpreis-Betrag | nur erster echter Verkauf | Gabo trägt unter `/admin/regeln` ein |

## Nächster Schritt nach Marcos OK

E5.3 — Migration 0008: `quote_promoter_sale()`, `reserve_promoter_seats()` (Option B neben der Handover-Funktion, **UPDATE-Block wörtlich**, eigener Identitäts-Test + eigener 8-parallel-Test), Zahlungsstatus setzen, Storno (nur Gabo), `enqueue_booking_notifications()`. **Vorher F22/F23 (und F11/F18 für die Quote) entscheiden.**

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` → `supabase status/stop/start/db reset` scheitern. Docker läuft. Ausweichwege:

```
# Migration einspielen (additiv) — 0001–0007 sind eingespielt:
Get-Content supabase\migrations\000N_name.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie nachtragen: insert into supabase_migrations.schema_migrations (version, name, statements) values ('000N', 'name', array[<Dateitext>]);
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

## Lokal testen — Eventvorlagen (E5.2) — Browser-Test durch Marco steht aus

Voraussetzung: Docker-Instanz läuft (`docker ps | findstr mmb-promoter`), `.env.local` im Root, `npm run dev` → http://127.0.0.1:3001

Login als **operator@mmb-promoter.test / operator-test-2026** (Seed, nur lokal):

1. **Vorlagen** (`/admin/vorlagen`, Nav-Link „Vorlagen"): leer → „Noch keine Vorlage". „Neue Vorlage": Name (nur für die Liste), Event-Titel, Kontingent, intern, drei optionale Beträge (Platzhalter „leer = Standard …"), Notiz → „Vorlage anlegen" → Detailseite.
2. **Plausibilität:** Anzahlung 60 bei Preis 45 → Fehlermeldung; Anzahlung = Preis erlaubt.
3. **Event aus Vorlage:** Detailseite → „Event aus dieser Vorlage anlegen" (oder `/admin/termine/neu` → Abschnitt „Aus Vorlage" → „Weiter mit Vorlage"). Seite zeigt nur Datum/Uhrzeit + Status plus die Zusammenfassung der kopierten Werte → „Event aus Vorlage anlegen" → Termin-Detailseite mit Zeile „Aus Vorlage: <Name> (Werte wurden beim Anlegen kopiert)", Preis/Anzahlung als „eigener Wert", Provision als „Ausnahme für diesen Termin".
4. **Kein Live-Bezug:** Vorlage ändern (Titel, Kontingent, Preis) → „Gespeichert. Bereits angelegte Events bleiben unverändert." → Termin-Detailseite unverändert. Vorlagen-Detail listet unter „Events aus dieser Vorlage" den Termin.
5. **Deaktivieren:** „Vorlage deaktivieren" → Liste zeigt sie unter „Deaktiviert" ohne „Event anlegen"; `/admin/termine/neu?vorlage=<id>` warnt und zeigt das normale Formular. „Vorlage wieder aktivieren" hebt das auf.
6. **Promoter** (promoter@mmb-promoter.test / promoter-test-2026): `/admin/vorlagen` → `/kein-zugang`.

**Aufräumen nach dem Browser-Test** (Termine werden nicht gelöscht, Regeln sind append-only — beides nur als `postgres`; Termine zuerst, dann Vorlagen):
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from tour_departures where title like 'TEST%';" -c "delete from event_templates where name like 'TEST%';" -c "delete from pricing_rules where created_by is not null;" -c "delete from commission_rules where departure_id is null and commission_cents <> 1000;" -c "delete from group_rules where not (threshold_persons = 11 and free_persons = 1);"
```
Achtung: `delete from pricing_rules where created_by is not null` löscht auch einen eingetragenen Standard-Ticketpreis. Testvorlagen bitte mit „TEST" beginnen.

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter   # Instanz läuft? (CLI blockiert, s. o.)
npm test                # Vitest: 13 Dateien, 167 Tests (app-access nur mit laufendem Dev-Server, sonst skipped)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
git status              # sauber nach dem E5.2-Doku-Commit (AGENTS.md-Block von next dev ggf. geändert)
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert

- Migrationen 0001–0007 (Inventar, Handover-Funktion unverändert, Profile/Rollen/RLS, Termine + Regeln, Preis/Anzahlung, Promoter-Verkaufs-Datenmodell, **Eventvorlagen**). Admin-Bereich: Termine, Regeln, Vorlagen. Promoter-Bereich: Login + Platzhalter.
- 0007: `event_templates` (editierbare Stammdaten, nur `network_operator`, kein DELETE → `active`), `tour_departures.template_id` (Herkunft, nur INSERT), `create_departure_from_template()` (security invoker, kopiert Titel/Kontingent/intern/Notiz + Beträge als Termin-Ausnahmen in einer Transaktion).
- 167 Tests grün, darunter 8-parallel-Überbuchungstest und Funktions-Identität gegen die Handover-Datei.

## Was noch NICHT existiert

- Kein Standard-Ticketpreis-Betrag (F15). Keine Konto-Verwaltung (E4). **Keine Verkaufs-/Storno-/Zahlungsstatus-Funktion, kein Verkaufs-Flow, kein Promoter-Dashboard, kein Nachrichten-Auslöser, kein Storage-Bucket/Bild** — E5.3 ff. Anzahlungsbasis/10+1-Option (frühere E5.2) wartet auf F11/F16/F18.

## Warnungen für den Wiedereinstieg

- **Nie `git add .`** — gezielt per Pfad. `.next/` ist ignoriert.
- `next dev` schreibt den Next.js-Block in `AGENTS.md` neu — Diff dort ignorieren bzw. mitcommitten.
- Deutsche Anführungszeichen in Code/Tests immer als `„…“` (U+201E/U+201C) — ein ASCII-`"` als Schlusszeichen bricht JSX/TS-Strings.
- Regeln sind append-only: Testwerte aus dem Browser bleiben stehen, bis man sie als `postgres` löscht (Befehl oben).
- Jede neue `create table`-Migration: Grants prüfen — `tests/events-rules-rls.test.ts` meldet, wenn `anon` wieder Rechte bekommt (RISKS Nr. 25); Erwartungsliste dort ergänzen (für 0007 geschehen).
- E5: **Reserve-Funktion aus 0002 bleibt byteidentisch** (Option B). Neue Funktion `reserve_promoter_seats()` (E5.3) bekommt eigenen UPDATE-Block-Identitätstest + eigenen 8-parallel-Test, bevor irgendetwas committet wird (Hard Rule 4).
- Round-Trip-Skripte gegen Server Actions ohne JS: Formulare als **`multipart/form-data`** posten (urlencoded wird still ignoriert → 200 ohne Wirkung); `formatCents` setzt vor „€" ein geschütztes Leerzeichen (U+00A0) — beim Textvergleich normalisieren.
- Tests laufen nur gegen localhost (`tests/db.ts`, `auth-login`, `app-access` prüfen die URL).
