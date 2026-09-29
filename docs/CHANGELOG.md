# CHANGELOG.md — Änderungsprotokoll mmb-promoter

Format: Datum · Was · Warum · Agent. **Neue Einträge unten anhängen** (chronologisch aufsteigend), nie löschen, nie überschreiben (Hard Rule 2, `AGENTS.md`). Auch reine Doku- und Config-Stände werden protokolliert.

Verweise auf Dateien immer mit Pfad; Commits mit Kurz-Hash, sobald bekannt.

---

**16.09.2026 — Projekt-Fundament: Doku-System, lokale Supabase-Instanz mit eigenen Ports, Dev-Server 3001**

Was:
- Doku-System nach dem Muster des Boots-Projekts angelegt: `AGENTS.md` (Projektregeln, additiv unter dem von `next dev` erzeugten Next.js-Block), `CLAUDE.md` (lädt `AGENTS.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `PROGRESS.md`, `TASKS.md`), `docs/README.md`, `docs/CHANGELOG.md` (diese Datei), `docs/DECISIONS.md`, `docs/RISKS.md`, `PROGRESS.md`, `TASKS.md`, `docs/decisions/` (README, Vorlage `0000-template.md`, **ADR-0001** „vollständig getrennt von MyMallorcaBoats"), `docs/research/` und `docs/handover/` (je README mit Ablage-Anweisung für Marco).
- `supabase init` → `supabase/config.toml` mit `project_id = "mmb-promoter"`. Ports auf **45321** (API), **45322** (DB; Shadow 45320, Pooler 45329), **45323** (Studio), 45324 (Mail), 45327 (Analytics), Inspector 8084 gesetzt. `site_url`/`additional_redirect_urls` auf `127.0.0.1:3001` bzw. `localhost:3001`. Eigenes JWT-Secret über `jwt_secret = "env(SUPABASE_AUTH_JWT_SECRET)"`, Wert in `supabase/.env.local` (gitignored; per `openssl rand -hex 32` erzeugt), Vorlage `supabase/.env.example`.
- `package.json`: `dev` → `next dev -p 3001`, `start` → `next start -p 3001`.
- `.env.local.example` (Root) mit den 4532x-URLs; `.gitignore` um `!.env.local.example` / `!.env.example` ergänzt, damit die Vorlagen ins Repo dürfen, echte `.env*`-Dateien aber ignoriert bleiben.
- Lokale Instanz gestartet und mit `supabase status` verifiziert (Ergebnis siehe `PROGRESS.md`).

Abweichung vom Auftrag, bewusst: Marco hatte **55321/55322/55323** vorgegeben. Der erste `supabase start` scheiterte auf 55322 („bind: An attempt was made to access a socket in a way forbidden by its access permissions"). Ursache: Windows/Hyper-V reserviert auf diesem Rechner große Blöcke im dynamischen Bereich ab 49152 — am 16.09. u. a. 54865–55764 nahezu durchgehend (`netsh interface ipv4 show excludedportrange protocol=tcp`). 45320–45329 liegt unterhalb des dynamischen Bereichs (Start 49152), ist frei und kann nicht dynamisch reserviert werden. Trennung zur Boots-Instanz (543xx) bleibt gewahrt. Eintrag dazu in `docs/DECISIONS.md`.

Nicht gemacht: keine Migration, kein Schema, keine Feature-Datei, kein Test — laut Auftrag Fundament zuerst. `src/app/*` ist unverändert das Create-Next-App-Gerüst.

Warum: Marcos Auftrag vom 16.09.2026 — Fundament + Doku vor jedem Feature; Trennung vom Boots-Projekt (ADR-0001) verlangt eigene Instanz, eigene Ports, eigenes Secret.

Agent: Claude (Session mit Marco).

Commit: `8c434d6` (gezielt per Pfad; `supabase/.env.local` nicht enthalten, geprüft mit `git ls-files`). Zusätzlich verifiziert: `next dev -p 3001` meldet „Ready", Ausgabe `Local: http://localhost:3001`.

---

## 16.09.2026 — Übergabe-Dateien geprüft, Geschäftsregeln verankert, Etappenplan vorgeschlagen

Was:
- Marco hat `docs/handover/reserve-function-final.sql` und zwei Recherchen in `docs/research/` abgelegt. Geprüft: SQL byteidentisch mit `C:\Projects\MyMallorcaExperience\docs\schema-snapshots\reserve-function-final.sql` (`cmp`), 151 Zeilen; Recherchen 295 und 290 Zeilen, UTF-8, vollständige Enden. Index-Tabellen in beiden READMEs nachgetragen. RISKS Nr. 19 → 🟢.
- `docs/DECISIONS.md`: neuer Eintrag „Geschäftsregeln" (Marco, 16.09.): Anzahlung 30 € pro Person; Provision 10 € fest pro Ticket, im Dashboard änderbar, interne Events abweichend; 10+1-Regel (ab 11 Personen 1 gratis, Provision für 10, Gabo-pflegbar); Kontingent manuell pro Termin/Event, atomarer Verkauf dagegen, keine Cross-DB-Kopplung; Storno-Provision bewusst offen.
- `docs/RISKS.md`: F1/F2/F3/F5 auf geklärt, F4 weitgehend geklärt; neue Fragen F10 (Storno-Provision, offen gelassen), F11 (Anzahlung bei Gratisplatz), F12 (Funktions-Anpassung Option A/B); neue Risiken Nr. 21 (Provisions-Snapshot), Nr. 22 (10+1: Sitze vs. bezahlte Plätze), Nr. 23 (Handover-Funktion schreibt fest `online`/`full`); Nr. 15 → 🟡.
- `TASKS.md`: M1–M3 abgehakt, M7 teilweise; Phase 1 als detaillierter Etappenplan E1–E8 (Vorschlag, nicht beschlossen), E1 = Sicherheitsnetz (Testrunner, Migration 0001 Schema, 0002 Funktion unverändert, 8-parallel-Test) als Gate. Design-Annahme „`capacity_total` = Kontingent" zur Bestätigung.
- `PROGRESS.md` überschrieben (Stand: Plan wartet auf Marco).

Nicht gemacht: kein Code, keine Migration, kein Test — Marcos Auftrag „Zeig mir den Plan, bau noch nichts".

Warum: Marcos Nachricht vom 16.09.2026 (Regeln verbindlich verankern, Etappenplan vorschlagen).

Agent: Claude (Session mit Marco).

---

## 16.09.2026 — E1.0: Kontingent-Entscheidung + Etappenplan bestätigt (Doku)

Was: `docs/DECISIONS.md` neuer Eintrag „`capacity_total` IST das Kontingent; Etappenplan E1–E8 bestätigt" (Marco). `PROGRESS.md` auf Etappe-1-Stand gesetzt (Reihenfolge E1.0–E1.4, Wiedereinstieg per `git log`/`npm test`).

Warum: Marcos Bestätigung vom 16.09.2026; Session-Kontext war voll, Stand musste vor der Arbeit gesichert sein.

Agent: Claude.

---

## 16.09.2026 — E1.1: Testrunner (Vitest + postgres.js)

Was:
- `npm install -D vitest postgres @types/node@^22` — Vitest 5.0.1, postgres.js 3.4.9. `@types/node` von ^20 auf ^22 angehoben, weil Vitest 5 das als Peer verlangt (npm ERESOLVE); Node ist 24.12, `tsc --noEmit` weiterhin sauber.
- `package.json`: Skripte `test` (`vitest run`) und `test:watch`.
- `vitest.config.mts`: nur `tests/**/*.test.ts`, Test-Dateien **nacheinander** (`fileParallelism: false`, gemeinsame DB), Timeouts 20 s. `.mts`, weil Vite sonst vor ESM-in-CJS warnt.
- `tests/db.ts`: `DATABASE_URL` aus Umgebung → `.env.local` → Default `127.0.0.1:45322`; wirft bei jeder nicht-lokalen URL (Tests legen Daten an). `connect(max)` — `max` muss ≥ Anzahl paralleler Aufrufe sein, sonst serialisiert der Pool und der Überbuchungstest beweist nichts.
- `tests/smoke.test.ts`: DB erreichbar, `current_database() = postgres`, PostgreSQL 17, URL enthält `:45322/` (nicht die Boots-Instanz 54322, Hard Rule 10).

Verifikation: `npm test` → „Test Files 1 passed, Tests 2 passed"; `npx tsc --noEmit` OK; `npx eslint tests vitest.config.mts` OK.

Warum: TASKS E1.1 — Sicherheitsnetz vor jedem Feature (RISKS Nr. 8).

Agent: Claude.

---

## 16.09.2026 — E1.2: Migration 0001 — Kern-Inventar (Enums, tour_departures, bookings)

Was: `supabase/migrations/0001_inventory_core.sql`. Enums `booking_channel` ('online', 'promoter' — der Promoter-Wert wird jetzt mit angelegt, damit später kein `ALTER TYPE … ADD VALUE` nötig ist), `payment_type` ('deposit','full'), `booking_status` ('pending','confirmed','cancelled','refunded'). `tour_departures`: `id`, `title`, `starts_at`, `capacity_total` (= **Kontingent**, `>= 0`), `seats_booked_total` (default 0), `status` open/closed/cancelled, `created_at`, Constraint `total_within_capacity`. `bookings`: exakt die Spalten, die die Handover-Funktion befüllt (Kanal, Zahlungstyp, Sitze, Beträge, Status, Stripe-Intent, Kunde, Shuttle, Allergie), FK auf `tour_departures`, Constraint Allergie-Details bei Flag. Grants für `service_role`. Spaltentypen spiegeln das Boots-Schema (dort 0001 + 0002 minus 0005), einzige bewusste Abweichung: `capacity_total >= 0` statt `> 0` (Termin anlegen, Kontingent später eintragen). Keine Profile, keine Provision, keine Regeln.

Verifikation: `supabase db reset` → „Applying migration 0001_inventory_core.sql … Finished"; `psql`: Enums mit erwarteten Werten, `tour_departures` 7 Spalten, `bookings` 16 Spalten, `schema_migrations` = `0001 inventory_core`.

Warum: TASKS E1.2 — Voraussetzung, damit die Funktion in 0002 unverändert einspielbar ist (Hard Rule 4). `capacity_total` = Kontingent laut `docs/DECISIONS.md` 16.09.

Agent: Claude.

---

## 16.09.2026 — E1.3: Migration 0002 — Handover-Funktionen unverändert übernommen

Was: `supabase/migrations/0002_reserve_function_handover.sql` = 7-zeiliger Kopf + `tail -n +49 docs/handover/reserve-function-final.sql` (beide Funktionsblöcke, Rechte-Zeilen, Rechte-Kommentar). Nicht abgetippt, per Shell kopiert. `tests/reserve-function-unchanged.test.ts`: vergleicht `pg_get_functiondef()` von `reserve_departure_seats` und `release_departure_seats` mit dem jeweiligen CREATE-Block der Handover-Datei (Zeilenenden normalisiert), prüft das atomare UPDATE und `SOLD_OUT` wörtlich, prüft `has_function_privilege` (anon/authenticated false, service_role true).

Verifikation: `diff <(tail -n +49 docs/handover/reserve-function-final.sql) <(tail -n +8 supabase/migrations/0002_reserve_function_handover.sql)` → leer. `supabase db reset` → „Applying migration 0001 … 0002 … Finished". `npm test` → Test Files 2 passed, Tests 6 passed.

Warum: TASKS E1.3, Hard Rule 4, RISKS Nr. 3 (Abweichung beim Übernehmen) — der Nachweis ist jetzt automatisiert und läuft bei jedem `npm test`.

Agent: Claude.

---

## 16.09.2026 — E1.4: Überbuchungstest grün — das „niemals überbuchen"-Fundament steht

Was: `tests/overbooking.test.ts` (7 Tests). Kern: Termin mit `capacity_total = 1`, 8 gleichzeitige Aufrufe von `reserve_departure_seats()` über 8 eigene, vorab geöffnete Verbindungen (`connect(8)` + `Promise.allSettled`) → genau 1 Erfolg, 7× `SOLD_OUT`, `seats_booked_total = 1`, genau 1 Buchungszeile. Dazu: Kontingent 5 bei 8 parallelen → genau 5; 2 Sitze auf Kontingent 1 → `SOLD_OUT`; Kontingent 0 → `SOLD_OUT`; Status `closed` → `SOLD_OUT`; Freigabe → Zähler 0, zweite Freigabe idempotent, danach 8-parallel wieder genau 1 Erfolg; unbekannte Buchung → `BOOKING_NOT_FOUND`. Testzeilen werden in `afterAll` gelöscht (Prüfung: 0 Zeilen `TEST-overbooking-%` übrig).

Verifikation (wörtlich, `npx vitest run --reporter=verbose`):

```
✓ tests/overbooking.test.ts > … > Kontingent 1, 8 parallele Reservierungen → genau 1 Erfolg, 7× SOLD_OUT 39ms
✓ tests/overbooking.test.ts > … > Kontingent 5, 8 parallele Reservierungen → genau 5 Erfolge, Zähler exakt 5 42ms
✓ tests/overbooking.test.ts > … > mehr Sitze als Kontingent in einem Aufruf → SOLD_OUT, Zähler unverändert 10ms
✓ tests/overbooking.test.ts > … > Kontingent 0 → SOLD_OUT (kein Verkauf ohne von Gabo eingetragenes Kontingent) 10ms
✓ tests/overbooking.test.ts > … > geschlossener Termin → SOLD_OUT, auch wenn Kontingent frei ist 16ms
✓ tests/overbooking.test.ts > … > Freigabe gibt den Platz zurück, ist idempotent, und der Platz ist wieder buchbar 44ms
✓ tests/overbooking.test.ts > … > unbekannte Buchung bei Freigabe → BOOKING_NOT_FOUND 4ms
✓ tests/reserve-function-unchanged.test.ts (4)   ✓ tests/smoke.test.ts (2)
Test Files  3 passed (3)
     Tests  13 passed (13)
```

`npx tsc --noEmit` OK, `npx eslint tests` OK.

Warum: TASKS E1.4, Hard Rule 4 — Beweis, dass die übernommene Sperre auch in dieser DB gegen das manuell eingetragene Kontingent (`capacity_total`) wirkt. RISKS Nr. 2 → 🟢, Nr. 3 → 🟢, Nr. 8 → 🟡 (Runner + 13 Tests, Auth-Tests folgen in E2).

Agent: Claude.

---

## 16.09.2026 — Etappe 1 abgeschlossen: PROGRESS.md auf Endstand

Was: `PROGRESS.md` überschrieben (einzige Datei, für die das erlaubt ist) mit Commit-Tabelle E1.0–E1.4, Wiedereinstiegs-Befehlen, „Was existiert / Was nicht", Warnungen. Ausdrücklicher Hinweis: Etappe 2 nicht begonnen („Danach Stopp", Marco).

Warum: Marcos Auftrag („Session ist voll — leg vorher/nachher den Stand in PROGRESS.md ab"), RISKS Nr. 20.

Agent: Claude.

---

## 17.09.2026 — Voll-Diagnose als Grundlage für den Masterplan (nur Doku)

Was: `docs/DIAGNOSE_MASTERPLAN_BASIS.md` neu — Momentaufnahme des Projekts: IST-Stand mit Reifegrad (Fundament ~95 %, Features 0 %, gesamt ~20 % bis zum ersten Verkauf), geklärte Regeln vs. offene Fragen mit Gate-Zuordnung (F4 vor E3; F8/F11/F12 vor E5; F6/F10 vor E7; F7 vor E8), Etappenplan E1–E8 mit Status (E1 fertig, E2 wartet auf Freigabe), Abhängigkeiten der Handover-Funktion (alle erfüllt), priorisierte Liste bis zum ersten lauffähigen Promoter-Verkauf, neun Befunde (B1–B9: u. a. Passwort-Mindestlänge 6 statt 12 in `config.toml`, Identitätstest bricht bei F12 Option A absichtlich, kein GitHub-Remote, RLS-Policies gehören in E2.1). Live-Zustand am 17.09. erneut geprüft: `npm test` 13/13 grün, `tsc` sauber, Migrationsstand 0001+0002, 0 Nutzer, RLS aus.

Nicht gemacht: kein Code, keine Migration, keine Config-Änderung, keine Änderung an RISKS/TASKS — Befunde werden erst nach Marcos Sichtung dort übernommen.

Warum: Marcos Auftrag vom 17.09.2026 („Voll-Diagnose als Grundlage für einen großen Masterplan — nur lesen/analysieren, nichts bauen").

Agent: Claude.

---

## 29.09.2026 — M6: GitHub-Remote gesetzt und gepusht

Was: `git remote add origin https://github.com/marcoheigl223-dev/mmb-promoter.git`, `git push -u origin main` (11 Commits bis `cda94b6`). Vorher geprüft: `supabase/.env.local` (JWT-Secret) ist gitignored und in keinem Commit der History; im Remote-Baum liegen nur die leeren Vorlagen `.env.local.example` und `supabase/.env.example`.

Verifikation: `git remote -v`, `git log origin/main` == lokal, Suche nach dem Secret über die gesamte History leer.

Warum: TASKS M6, Marcos Auftrag 29.09.2026 („Sichere jetzt alles"). Hard Rule 9.

Agent: Claude.

---

## 29.09.2026 — E2 (Config): Passwort-Mindestlänge 12, keine Selbstregistrierung

Was: `supabase/config.toml` — `[auth] minimum_password_length = 12` (war 6), `[auth] enable_signup = false` (neu). `[auth.email] enable_signup` bleibt bewusst `true` mit Kommentar: dieser Schalter ist `GOTRUE_EXTERNAL_EMAIL_ENABLED` und würde auch den E-Mail-Login abschalten (zwischenzeitlich falsch auf `false` gesetzt, vor dem Commit korrigiert). `package.json`: `@supabase/ssr` ^0.12.7, `@supabase/supabase-js` ^2.117.2, `server-only` als Dependencies.

Verifikation: Der Auth-Container musste ohne CLI neu erzeugt werden (RISKS Nr. 24): gleiches Image `gotrue:v2.191.0`, gleiche 70 Env-Variablen bis auf `GOTRUE_PASSWORD_MIN_LENGTH=12` und `GOTRUE_DISABLE_SIGNUP=true`, gleiches Netz/Alias/Labels/Healthcheck; healthy nach 10 s. REST: Login aller Seed-Konten 200; `POST /signup` → 422 `signup_disabled`; `PUT /user` mit 11 Zeichen → 422 `weak_password` („at least 12 characters"); Nutzerzahl unverändert 3. `tests/auth-login.test.ts` 6/6.

Warum: Marcos Auftrag 29.09.2026 („Passwort-Mindestlänge … auf 12 korrigieren"), Diagnose-Befund B2, RISKS Nr. 9. `enable_signup = false` ist eine Härtung über den Auftrag hinaus (Konten legt nur Gabo an, E4) — mit einer Zeile rückgängig zu machen. DECISIONS 29.09., Punkt 4.

Agent: Claude.

---

## 29.09.2026 — E2.1: Migration 0003 (profiles, Rollen, RLS deny-by-default) + Seed

Was: `supabase/migrations/0003_profiles_roles.sql` — Enum `user_role` (`network_operator`, `promoter`); Tabelle `profiles` (id → `auth.users`, `role`, `active`, `display_name`, Zeitstempel); Helfer `current_profile_role()`, `is_active_profile()`, `is_network_operator()` (SQL, stable, security definer, `search_path = public`, Execute nur für `authenticated`/`service_role`); **RLS aktiviert auf `profiles`, `tour_departures`, `bookings`**; Grants: `authenticated` nur SELECT auf `profiles` und `tour_departures`, `service_role` alles auf `profiles`; Policies `profiles_select_own`, `profiles_select_network_operator`, `tour_departures_select_active_profile`; `bookings` bewusst ohne Policy. `supabase/seed.sql` neu — drei lokale Konten in `auth.users`/`auth.identities` + `profiles` (Operator, aktiver Promoter, deaktivierter Promoter; feste UUIDs `1111…`, `2222…`, `3333…`; Zugangsdaten im Dateikopf). `tests/db.ts`: `readEnvLocal` exportiert.

Verifikation: Beide Dateien per `docker exec supabase_db_mmb-promoter psql -1 -v ON_ERROR_STOP=1` eingespielt (CLI blockiert, RISKS Nr. 24); Eintrag `0003 | profiles_roles` in `supabase_migrations.schema_migrations` von Hand nachgetragen. `pg_tables.rowsecurity` = true auf allen drei Tabellen, 3 Nutzer, 3 Profile, 3 Policies, Grants wie geplant. `tests/profiles-rls.test.ts` 16/16 grün: Promoter sieht nur sich; Operator alle; Inaktiver sieht sich (für die Sperr-Anzeige), aber keine Termine; unbekannte `sub` sieht nichts; **gefälschte Rollen-Claims im JWT ohne Wirkung**; `anon` permission denied; `authenticated` kann Termine nicht schreiben, `bookings` nicht lesen, `reserve_departure_seats()` nicht aufrufen. E1-Tests unverändert grün (Handover-Funktion identisch, 8-parallel 1/7).

Warum: TASKS E2.1; Marcos Auftrag („RLS deny-by-default … in diese Etappe", „Rolle serverseitig aus der DB, nie aus dem Token"); Diagnose-Befunde B6/B7. Additiv: berührt nichts aus 0001/0002 (Hard Rule 1/4).

Agent: Claude.

---

## 29.09.2026 — E2.2: Login, Proxy, Route-Guards, noindex

Was: `src/lib/supabase/server.ts` (SSR-Client pro Request, Cookies getAll/setAll); `src/lib/auth/access.ts` (reine Entscheidung `decideAccess()`, `landingPathFor()`, `areaForPath()`, Bereichs-Tabelle `/admin` → `network_operator`, `/promoter` → `promoter`); `src/lib/auth/dal.ts` (`getCurrentAuth()` mit `getUser()` + Profil aus `profiles` über den RLS-Client, React `cache`; `requireArea()` mit `redirect()`); `src/proxy.ts` (Next.js 16 Proxy: Session-Refresh nach @supabase/ssr-Muster, ohne Session Redirect nach `/login`; Matcher `/admin/:path*`, `/promoter/:path*`, `/login`, `/`); `src/app/login/{page,login-form,actions}` (Server Action `login`: signInWithPassword → Profil aus DB → Ziel nach Rolle; ohne Profil oder inaktiv → sofort `signOut` + Meldung; `logout`); Layouts `src/app/admin/layout.tsx`, `src/app/promoter/layout.tsx` mit `requireArea()` + Abmelden; Platzhalter-Seiten `/admin`, `/promoter`; `/gesperrt`, `/kein-zugang`; `src/app/robots.ts` (Disallow `/`); `next.config.ts` Header `X-Robots-Tag: noindex, nofollow` auf allen Pfaden; Root-Layout `lang="de"`, Titel, `robots: { index: false }`; `src/app/page.tsx` nur noch Verteiler (Create-Next-App-Vorlage entfernt — Begründung: interne App ohne öffentliche Startseite). Root-`.env.local` lokal angelegt (M5, gitignored).

Verifikation: `npx tsc --noEmit` 0 Fehler (nach `next typegen` für `LayoutProps<"/admin">`), `npx eslint src tests` 0; `next dev -p 3001` mit Turbopack läuft, lädt `.env.local` (F9: kein `--webpack`); curl ohne Session: `/`, `/admin`, `/admin/x`, `/promoter`, `/promoter/verkauf` → 307 `/login`; `/login`, `/robots.txt` 200; `X-Robots-Tag` auf allen Antworten. `tests/app-access.test.ts` 7/7 (siehe E2.3). Browser-Test durch Marco steht aus — Anleitung in PROGRESS.md.

Warum: TASKS E2.2; Marcos Auftrag („Login-Seite + Route-Guard für /admin/* und /promoter/* (Next.js 16 Proxy), noindex"). Guides gelesen: proxy, authentication, cookies, server-actions, forms, robots. DECISIONS 29.09., Punkte 2/5/7.

Agent: Claude.

---

## 29.09.2026 — E2.3: Tests „Promoter kommt nicht ins Admin", „inaktiv kommt nicht rein"

Was: `tests/access-guard.test.ts` (11 Tests, reine Logik ohne DB: Promoter → Admin abgelehnt, Operator → Promoter abgelehnt, inaktiv → `/gesperrt` in beiden Bereichen, fremde Profil-Zeile abgelehnt, Landing nach Rolle, Pfad-Erkennung); `tests/profiles-rls.test.ts` (16, siehe E2.1); `tests/auth-login.test.ts` (6, GoTrue-REST: Seed-Logins 200 mit Token-Rolle `authenticated`, falsches Passwort 400, Signup 422, 11 Zeichen 422 und altes Passwort gilt weiter); `tests/app-access.test.ts` (7, End-to-End gegen `npm run dev` auf 3001 — Session bei GoTrue holen, als `sb-127-auth-token`-Cookie senden: Promoter `/promoter` 200 + `/admin` 307 `/kein-zugang`; Operator `/admin` 200 + `/promoter` 307 `/kein-zugang`; inaktiv → `/gesperrt`; `/` verteilt nach DB-Rolle; kaputtes Token → `/login`; noindex-Header + robots.txt; **wird übersprungen, wenn der Dev-Server nicht läuft**).

Verifikation (wörtlich): `Test Files 7 passed (7) · Tests 53 passed (53)` — 13 aus E1 + 40 neu. `tsc` 0, `eslint` 0.

Warum: TASKS E2.3, Hard Rule 8 (kein Haken ohne Beleg). RISKS Nr. 8 → 🟢, Nr. 9 → 🟡.

Agent: Claude.

---

## 29.09.2026 — Doku-Stand Etappe 2 + Befund Smart App Control

Was: `TASKS.md` M5, M6, E2.1–E2.3 abgehakt mit Belegen. `docs/RISKS.md`: Nr. 7 ergänzt (F9 geklärt), Nr. 8 → 🟢, Nr. 9 → 🟡, **neu Nr. 24** (Windows Smart App Control blockiert `supabase-go.exe` der CLI 2.108 — `status/stop/start/db reset` nicht nutzbar, Docker läuft; Entscheidung Marco), F9 beantwortet (nein), **neu F13** (darf Gabo in den Promoter-Bereich?). `docs/DECISIONS.md`: Eintrag 29.09. (Rollenname, Rolle aus DB, deny-by-default, Signup aus, eine Rolle je Bereich, Seed, DAL). `PROGRESS.md` überschrieben (Stand E2, Wiedereinstieg, Test-Anleitung für beide Rollen, Docker-Ausweichwege).

Warum: Hard Rule 2, Sitzungsende-Regel in AGENTS.md.

Agent: Claude.
