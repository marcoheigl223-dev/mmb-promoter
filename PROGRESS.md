# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 29.09.2026, Etappe 3 (Gabos Admin-Bereich: Termine/Events, Kontingent, Regeln) GEBAUT, VERIFIZIERT UND COMMITTET (4 Commits, von Marco freigegeben), zusammen mit E2 gepusht.** Einzige Datei, die überschrieben werden darf. Nichts hier gilt als protokolliert — erledigte Schritte stehen in `docs/CHANGELOG.md` (Hard Rule 2).

## Wo wir stehen

- Etappe 1 komplett (`fc50fdf` … `cda94b6`), auf GitHub (`origin/main` = `cda94b6`).
- Etappe 2 komplett, 5 Commits `d265ae3`, `4bdc1ef`, `8f6ec6d`, `7e785f9`, `30dc6f8`.
- Etappe 3 komplett, Commits (Marco-Freigabe 29.09.2026): E3.1 `ca25596`, E3.2 `3df108b`, E3.3 `d23843a`, Doku `125e41d` (+ dieser PROGRESS-Nachtrag). E2 + E3 mit `git push origin main` gesichert. Aufteilung war:

| Schritt | Pfade | Beleg |
|---|---|---|
| E3.1 Migration | `supabase/migrations/0004_events_and_rules.sql` | Grants per `information_schema`, `tests/events-rules-rls.test.ts` 21/21 |
| E3.2 App | `src/lib/admin/`, `src/app/admin/termine/`, `src/app/admin/regeln/`, `src/app/admin/page.tsx`, `src/app/admin/layout.tsx` | `tsc` 0, `eslint` 0, Server-Action-Round-Trip, `tests/app-access.test.ts` 9/9 |
| E3.3 Tests | `tests/events-rules-rls.test.ts`, `tests/admin-helpers.test.ts`, `tests/app-access.test.ts`, `tests/profiles-rls.test.ts` | `npm test` 88/88 |
| Doku | `TASKS.md`, `docs/RISKS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `PROGRESS.md` | — |

**F4 bestätigt (Marco, 29.09.2026):** interne Events bekommen vorerst nur eine eigene Provision, kein eigener Preis/keine eigene Anzahlung (F14 bleibt offen). **Offen für Marco:** (1) Browser-Test des Admin-Bereichs (unten), (2) F14 vor E5 (Preis/Anzahlung bei internen Events), (3) Befund RISKS Nr. 25 zur Kenntnis (Default-Privilegien, in 0004 gehärtet). Danach E4 (Promoter-Accounts). Vor E5: F10, F11, F12, F14, RISKS Nr. 22/23.

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` → `supabase status/stop/start/db reset` scheitern. Docker läuft. Ausweichwege:

```
# Migration einspielen (additiv, löscht nichts):
Get-Content supabase\migrations\0004_events_and_rules.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie nachtragen (Tabelle supabase_migrations.schema_migrations: version, name, statements) — für 0004 bereits geschehen.
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

Sobald die CLI wieder geht: `supabase stop && supabase start && supabase db reset` stellt alles aus `config.toml` + Migrationen 0001–0004 + `seed.sql` regulär her.

## Lokal testen — Gabos Admin-Bereich (E3)

Voraussetzung: Docker-Instanz läuft (`docker ps | findstr mmb-promoter`), `.env.local` im Root, `npm run dev` → http://127.0.0.1:3001

Login als **operator@mmb-promoter.test / operator-test-2026** (Seed, nur lokal) → landet auf `/admin`:

1. **Termine-Liste** (`/admin`): Überschrift „Termine und Events", Navigation „Termine | Regeln", Button „Neuer Termin". Anfangs leer („Noch keine Termine …").
2. **Termin anlegen** (`/admin/termine/neu`): Titel, Datum/Uhrzeit (Ortszeit Mallorca), Kontingent, Status, Haken „Internes Event", Notiz → „Termin anlegen" → Detailseite. Erwartung: Uhrzeit wie eingegeben, „intern"-Badge bei gesetztem Haken, Zeile „Kontingent N · gebucht 0 · frei N". Kontrolle in der DB: `starts_at` ist UTC (Sommer −2 h, Winter −1 h).
3. **Kontingent ändern** auf der Detailseite → „Gespeichert." Wer testen will, dass es nicht unter Gebuchtes geht: per psql `update tour_departures set seats_booked_total = 3 where title = '…'`, dann Kontingent 2 speichern → Meldung „Kontingent kann nicht unter die bereits gebuchten Plätze gesenkt werden." (Browser blockiert schon per `min`; die DB-Prüfung greift unabhängig davon.)
4. **Provision für diesen Termin:** „Jetzt gültig: 10,00 € pro Ticket (Standard)". Ausnahme 12,50 € speichern → „Jetzt gültig: 12,50 € … (Ausnahme für diesen Termin, Standard wäre 10,00 €)", Historie-Tabelle darunter. „Wieder Standard" speichern → zurück auf 10,00 €, beide Zeilen bleiben in der Historie.
5. **Regeln** (`/admin/regeln`): „Provision pro Ticket (Standard)" = 10,00 € gültig ab 16.09.2026; neuen Wert speichern → neue Zeile oben in der Historie, alte bleibt. „Gruppenregel (10+1)": „ab 11 Personen 1 gratis"; z. B. 12/2 speichern → neuer Text, alte Zeile bleibt. Gratis ≥ Schwelle → Fehlermeldung.
6. **Status „abgesagt"** statt Löschen — ein Löschen-Knopf existiert bewusst nicht.

Dann als **promoter@mmb-promoter.test / promoter-test-2026**: `/admin`, `/admin/regeln`, `/admin/termine/neu` → jeweils `/kein-zugang`. `/promoter` zeigt weiterhin nur die E2-Begrüßung (Verkauf kommt in E5).

**Aufräumen nach dem Browser-Test** (Regeln sind append-only, die UI löscht nichts):
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from tour_departures where title like 'TEST%';" -c "delete from commission_rules where departure_id is null and commission_cents <> 1000;" -c "delete from group_rules where not (threshold_persons = 11 and free_persons = 1);"
```

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter   # Instanz läuft? (CLI blockiert, s. o.)
npm test                # Vitest: 9 Dateien, 88 Tests (app-access nur mit laufendem Dev-Server, sonst skipped)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
git log --oneline       # Stand: E3 committet (ca25596, 3df108b, d23843a, 125e41d + Nachtrag), lokal = origin/main
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert (neu in E3)

- `supabase/migrations/0004_events_and_rules.sql` — `is_internal`/`note`, `commission_rules`, `group_rules` (append-only, Startwerte als Daten), `effective_commission_cents()`, `effective_group_rule()`, Schreib-Policies nur für `network_operator`, Spalten-Grants, Privilegien-Härtung.
- `src/lib/admin/` (`time`, `money`, `types`, `errors`, `queries`) · `src/app/admin/termine/` (Actions, Formular, `neu`, `[id]` mit Provisions-Ausnahme) · `src/app/admin/regeln/` · `/admin` = Terminliste, Layout mit Navigation.
- Tests: `events-rules-rls` (21), `admin-helpers` (12), `app-access` (9), `profiles-rls` (16, ein Test an 0004 angepasst) + E1/E2 unverändert.

## Was noch NICHT existiert

- Keine Konto-Verwaltung durch Gabo (E4) — Konten nur per Seed. Keine Verkaufsfunktion, kein Provisions-Snapshot pro Buchung (E5). `bookings` für `authenticated` weiterhin komplett gesperrt.
- Keine Gruppenregel pro Event (nicht beauftragt), kein Löschen von Terminen (bewusst), keine Passwort-Reset-Strecke.

## Warnungen für den Wiedereinstieg

- **Nie `git add .`** — gezielt per Pfad (Tabelle oben). `.next/` ist ignoriert.
- `next dev` schreibt den Next.js-Block in `AGENTS.md` neu — Diff dort ignorieren bzw. mitcommitten.
- `[auth.email] enable_signup` muss `true` bleiben; Selbstregistrierung sperrt `[auth] enable_signup = false`.
- Regeln sind append-only: Testwerte aus dem Browser bleiben stehen, bis man sie als `postgres` löscht (Befehl oben).
- Jede neue `create table`-Migration: Grants prüfen — `tests/events-rules-rls.test.ts` meldet, wenn `anon` wieder Rechte bekommt (RISKS Nr. 25).
- Tests laufen nur gegen localhost (`tests/db.ts`, `auth-login`, `app-access` prüfen die URL).
