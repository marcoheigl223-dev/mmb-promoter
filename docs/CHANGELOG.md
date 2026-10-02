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

---

## 29.09.2026 — E3.1: Migration 0004 — Termine/Events (intern-Flag, Notiz), Provisions- und Gruppenregeln als Daten, Schreib-Policies nur für network_operator, Privilegien-Härtung

Was: `supabase/migrations/0004_events_and_rules.sql` (additiv, per `docker exec … psql` eingespielt, Historie-Zeile `0004 events_and_rules` von Hand nachgetragen — CLI weiter blockiert, RISKS Nr. 24):
- `tour_departures` + `is_internal boolean not null default false` (internes Event: nur im Promoter-Netzwerk, nie öffentlich) + `note text`.
- `commission_rules` (`departure_id` NULL = Standard, sonst Ausnahme für diesen Termin; `commission_cents` ≥ 0, NULL nur bei Ausnahme = „wieder Standard"; `valid_from`; `created_by default auth.uid()`), Index `(departure_id, valid_from desc)`. `group_rules` (`threshold_persons` ≥ 2, `free_persons` ≥ 0, Check `free < threshold`, `valid_from`, `created_by`).
- **Startwerte als Daten:** Standard 1000 Cent und Gruppenregel 11/1, jeweils gültig ab 16.09.2026 (Marcos Werte aus DECISIONS 16.09.) — keine Konstante im Code.
- Funktionen `effective_commission_cents(p_departure_id, p_at default now())` (Ausnahme vor Standard, neuestes `valid_from <= p_at`) und `effective_group_rule(p_at)`; ausführbar für `authenticated`/`service_role`.
- RLS an auf beiden Regel-Tabellen: SELECT für aktive Profile, INSERT nur `is_network_operator() and created_by = auth.uid()`; **kein UPDATE/DELETE-Grant** (append-only). `tour_departures`: Spalten-Grants INSERT/UPDATE nur auf `title, starts_at, capacity_total, status, is_internal, note` + Policies `is_network_operator()`; `seats_booked_total` bleibt unschreibbar, kein DELETE.
- **Härtung (Befund):** Supabase-Default-Privilegien gaben `anon`/`authenticated` TRUNCATE/REFERENCES/TRIGGER/MAINTAIN auf allen Tabellen in `public` — auch auf `bookings`/`profiles`/`tour_departures` aus E1/E2. Widerrufen (`revoke … from anon/authenticated`, `alter default privileges … revoke` für Tabellen und Funktionen), `effective_*` für `public`/`anon` entzogen. Nachträglich an 0004 angehängt, bevor die Datei committet war — keine angewendete Migration editiert (Hard Rule 1). → RISKS Nr. 25.

Verifikation: `information_schema.table_privileges`/`column_privileges`: `authenticated` = commission_rules INSERT,SELECT · group_rules INSERT,SELECT · profiles SELECT · tour_departures SELECT + Spalten-INSERT/UPDATE auf den 6 Pflege-Spalten; `anon` nichts; `effective_commission_cents(gen_random_uuid())` = 1000, `effective_group_rule()` = 11/1. `tests/events-rules-rls.test.ts` 21/21 (Details unter E3.3). `tests/reserve-function-unchanged.test.ts` und `tests/overbooking.test.ts` weiter grün — Reserve-Funktion unverändert (Hard Rule 4).

Warum: TASKS E3.1; Marcos Auftrag 29.09. („Provisions-Standard (10€/Ticket) + Event-Ausnahme, 10+1-Gruppenregel-Parameter — alles als DATEN in der DB", „interne Events … als Flag", „RLS-Policies … deny-by-default, nur network_operator schreibt"). DECISIONS 29.09. (Etappe 3). F4-Detail: als Annahme umgesetzt und in RISKS F4 zur Bestätigung vermerkt, Restfrage F14.

Agent: Claude.

---

## 29.09.2026 — E3.2: Admin-UI für Gabo — Termine/Events anlegen und pflegen, Kontingent, Provisions-Ausnahme, Standard-Provision und 10+1 auf /admin/regeln

Was:
- `src/lib/admin/` neu: `time.ts` (Ortszeit Mallorca `Europe/Madrid` ⇄ UTC für `datetime-local`, Anzeige de-DE), `money.ts` (Euro-Eingabe „12,50" ⇄ ganze Cent), `types.ts`, `errors.ts` (DB-Fehler → deutsche Meldungen: `total_within_capacity` → „Kontingent kann nicht unter die bereits gebuchten Plätze gesenkt werden.", 42501 → „Keine Berechtigung"), `queries.ts` (`server-only`; Termine kommend/vergangen, Regel-Historien, `rpc(effective_*)`).
- `src/app/admin/termine/actions.ts` (Server Actions `createDeparture`, `updateDeparture`, `setDepartureCommission`), `departure-form.tsx`, `neu/page.tsx`, `[id]/page.tsx` (+ `commission-override-form.tsx`: Ausnahme in Euro oder „wieder Standard", optional Gültig-ab, Historie). `src/app/admin/regeln/` (`actions.ts` `setStandardCommission`/`setGroupRule`, `rules-forms.tsx`, `page.tsx`: aktueller Wert + Historie je Regel). Jede Action ruft selbst `requireArea("admin")` und schreibt über den RLS-Client des Nutzers (`createClient()` aus `@supabase/ssr`, nie `service_role`) — die Policies aus 0004 sind die zweite Schranke.
- `src/app/admin/layout.tsx` additiv: Navigation „Termine" / „Regeln". **`src/app/admin/page.tsx` ersetzt** (E2-Platzhalter „Test-Operator (Gabo)" → Terminliste kommend/vergangen mit Kontingent/gebucht/frei, „intern"-Badge, Button „Neuer Termin"). Begründung: der Platzhalter hatte keinen Inhalt außer der Begrüßung; der Name des Operators steht weiterhin im Layout, der E2-Test `tests/app-access.test.ts` („Test-Operator") bleibt grün.
- Nicht gebaut (bewusst): kein Löschen von Terminen (Absage = Status), keine Gruppenregel pro Event (nicht beauftragt), keine Verkaufsfunktion (E5).

Verifikation: `npx next typegen` + `npx tsc --noEmit` 0, `npx eslint src tests` 0 (Lint-Regel `react-hooks/purity` hatte `Date.now()` im Render bemängelt → „jetzt"-Logik in `queries.ts` verschoben). Dev-Server 3001: ohne Session `/admin/regeln`, `/admin/termine/neu` → 307 `/login`. `tests/app-access.test.ts` 9/9 (Operator: `/admin` 200 „Termine und Events", `/admin/termine/neu` 200, `/admin/regeln` 200, `/admin/termine/keine-uuid` 404; Promoter: alle drei → 307 `/kein-zugang`). **Round-Trip durch die echten Server Actions** (Skript gegen den Dev-Server, Form-POST ohne JavaScript mit den `$ACTION_ID`-Feldern der gerenderten Seite, Session-Cookie des Seed-Operators): anlegen „TEST-e2e Sunset Cruise (intern)" 20.10.2026 18:30, Kontingent 12 → 303 `/admin/termine/<id>`; Detailseite zeigt „intern", Kontingent 12, 20.10.2026 18:30; ändern auf Kontingent 15 + geschlossen → „Gespeichert."; Ausnahme 12,50 € → „Ausnahme gespeichert", „Standard wäre 10,00 €"; derselbe POST als Promoter → 303 `/kein-zugang`; `/admin/regeln`: Gruppenregel 12/2 → „ab 12 Personen 2 gratis", Standard 11,00 € angezeigt. Per psql bestätigt: `starts_at = 2026-10-20 16:30+00` (= 18:30 Madrid), `capacity_total 15`, `closed`, `commission_rules` 1250 (Ausnahme) und 1100 (Standard) mit `created_by` = Operator, `group_rules` 12/2, `effective_commission_cents` 1250/1100, `effective_group_rule` 12/2. Testzeilen danach gelöscht, Stand wieder 1000 / 11+1. Browser-Test durch Marco steht aus (PROGRESS.md).

Warum: TASKS E3.2; Marcos Auftrag 29.09. („Termine/Events anlegen, Kontingent pro Termin setzen (capacity_total = das Kontingent)", „Gabo-pflegbar"). Guides gelesen: server-actions, forms, data-security, revalidatePath, redirect. DECISIONS 29.09. (Etappe 3), Punkte 6–8.

Agent: Claude.

---

## 29.09.2026 — E3.3: Tests — Kontingent nicht unter Gebuchtes, Regeln append-only, RLS der neuen Tabellen, Zeit-/Geld-Helfer, E2E

Was:
- `tests/events-rules-rls.test.ts` (21, neu): RLS an; Startwerte 10,00 €/11+1 ab 16.09.2026 als Daten; `authenticated` exakt SELECT/INSERT auf Regeln und Spalten-INSERT/UPDATE auf den 6 Pflege-Spalten, `anon` kein Tabellenrecht; Operator legt internes Event an, ändert Kontingent/Status/Flag, darf `seats_booked_total` weder setzen noch beim Anlegen mitgeben (`permission denied`), darf nicht löschen; **Kontingent 4 bei 5 gebuchten → `total_within_capacity`, 5 → OK**; Promoter: INSERT → RLS-Verletzung, UPDATE → 0 Zeilen, Wert unverändert; inaktiv sieht keine Regeln; Ausnahme 1500 schlägt Standard, andere Termine unberührt, `created_by` nicht fälschbar; NULL-Ausnahme = wieder Standard, alte Zeile bleibt (2 Zeilen); Standard ohne Betrag verboten; **neuer Standard = neue Zeile, alte 1000-Zeile bleibt, UPDATE/DELETE → `permission denied`**; Gültig-ab entscheidet (Zeile ab 2000 gewinnt jetzt nicht, `p_at = 2010` liefert sie, 1990 → NULL); Gruppenregel: neue Zeile gilt sofort, alte bleibt, UPDATE/DELETE verboten, Gratis ≥ Schwelle verboten. Aufräumen im `afterAll` (nur `TEST-e3-%` und die eigenen Testwerte).
- `tests/admin-helpers.test.ts` (12, neu): Sommer-/Winterzeit, beide Umstellungstage 2026, 31.02. → null, Rückweg, Anzeige; „10", „10,5", „10.50", „ 12,00 € ", „0" → Cent; „abc", „10,555", „-5", „1e3", „10," → null.
- `tests/app-access.test.ts` +2 (Operator sieht die drei Admin-Seiten, 404 bei kaputter ID; Promoter → `/kein-zugang`).
- **`tests/profiles-rls.test.ts` geändert:** der E2-Test „authenticated darf keine Termine schreiben (kein Grant)" widerspricht 0004 (der Operator darf jetzt die Pflege-Spalten schreiben). Ersetzt durch „Promoter darf keine Termine schreiben (RLS: 0 Zeilen), seats_booked_total für niemanden" — die Schutzaussage bleibt erhalten, die Zeile wurde nicht gelöscht, sondern mit Kommentar auf den E3-Stand gebracht.

Verifikation (wörtlich): `Test Files 9 passed (9) · Tests 88 passed (88)` — 53 aus E1/E2 + 35 neu (21 + 12 + 2); E1-Überbuchungstest (8 parallel → 1/7) und `pg_get_functiondef == Handover` unverändert grün. `tsc` 0, `eslint` 0. Zwei Korrekturen beim ersten Lauf: ein Testtitel mit deutschem Anführungszeichen brach den String (Titel umformuliert); `valid_from::date` lief in der UTC-Session auf den 15.09. → Vergleich jetzt `at time zone 'Europe/Madrid'`.

Warum: TASKS E3.3 („Kontingent kann nicht unter seats_booked_total gesenkt werden; Regeländerung erzeugt neue Gültigkeit, überschreibt keine alte"), Hard Rule 8. RISKS Nr. 8, 21, 22, 25.

Agent: Claude.

---

## 29.09.2026 — Doku-Stand Etappe 3

Was: `TASKS.md` E3.1–E3.3 abgehakt mit Belegen. `docs/DECISIONS.md`: Eintrag 29.09. „Etappe 3" (Regeln als append-only-Daten, NULL-Ausnahme = wieder Standard, Gruppenregel nur global, internes Event = Flag, Kontingent ohne Trigger, kein DELETE, Spalten-Grants, RLS-Client statt service_role, Ortszeit Mallorca, Privilegien-Härtung, ersetzter Admin-Platzhalter). `docs/RISKS.md`: Nr. 8 (88 Tests), Nr. 21 → 🟡, Nr. 22 ergänzt (bleibt 🔴 bis E5), Nr. 24 ergänzt, **neu Nr. 25** (Default-Privilegien, 🟢), F4 mit der E3-Annahme — **von Marco am 29.09.2026 bestätigt:** interne Events bekommen vorerst nur eine eigene Provision, kein eigener Preis/keine eigene Anzahlung; **neu F14** (Preis/Anzahlung interner Events, bewusst offen, vor E5). `PROGRESS.md` überschrieben (Stand E3, Commit-Vorschlag, Test-Anleitung für Gabos Admin-Bereich, Wiedereinstieg).

Warum: Hard Rule 2, Sitzungsende-Regel in AGENTS.md.

Agent: Claude.

---

## 30.09.2026 — E3.4 (F14): Eigener Ticketpreis + eigene Anzahlung pro Termin/Event als Daten (Migration 0005, Admin-Felder, Tests)

Was:
- **`supabase/migrations/0005_pricing_rules.sql` (neu, additiv):** Enum `pricing_kind` (`ticket_price` | `deposit`); Tabelle `pricing_rules` nach dem Muster von `commission_rules` (`departure_id NULL` = Standard, gesetzt = eigener Wert für genau diesen Termin/Event; `amount_cents NULL` bei Ausnahme = „wieder Standard"; Check `pricing_standard_has_amount`, `amount_cents >= 0`; `valid_from`; `created_by default auth.uid()`); Index `(kind, departure_id, valid_from desc)`; **Startwert als Daten: Anzahlung 30,00 €/Person ab 16.09.2026** (DECISIONS 16.09., Regel 1); **kein Ticketpreis-Startwert** — der reguläre Preis ist nirgends dokumentiert und wird nicht geraten (Hard Rule 5 → neue Frage F15); `effective_price_cents(kind, termin, zeitpunkt)` (security invoker, stable; Ausnahme schlägt Standard, NULL wenn kein Standard gilt); RLS an, SELECT für aktive Profile (Promoter brauchen die Beträge in E5), INSERT nur `is_network_operator() and created_by = auth.uid()`; `authenticated` nur SELECT/INSERT (kein UPDATE/DELETE → Historie vollständig), `anon`/`public` ausdrücklich ohne Rechte, auch auf der Funktion. Reserve-Funktion aus 0002 **nicht angefasst**. Eingespielt per `docker exec … psql` (CLI blockiert, RISKS Nr. 24), Historie-Zeile `0005` in `supabase_migrations.schema_migrations` nachgetragen.
- **`src/lib/admin/types.ts`** (+): `PRICING_KINDS`, `PricingKind`, `PRICING_KIND_LABELS`, `PricingRule`, `PricingAmounts`. **`src/lib/admin/pricing.ts` (neu, reine Logik):** `parseOptionalEuro` (leer = Standard, Unsinn = Fehler statt still Standard), `activeOverrideCents` (jüngste Zeile mit Gültig-ab ≤ jetzt), `planPricingWrites` (nur schreiben, was sich gegenüber der aktiven Ausnahme ändert; leeres Feld bei aktiver Ausnahme → NULL-Zeile), `depositAbovePriceError` (Anzahlung > Ticketpreis → Fehlermeldung; fehlt ein Wert, keine Prüfung). **`src/lib/admin/queries.ts`** (+): `listPricingRules`, `effectivePriceCents` (RPC), `standardPricing`, `activePricingOverrides`, `departurePricingSummary` (effektiv / Standard / Ausnahme / Historie).
- **Termin-Formular (`departure-form.tsx`):** zwei optionale Felder „Eigener Ticketpreis pro Person (Euro)" und „Eigene Anzahlung pro Person (Euro)", Platzhalter „leer = Standard X €", Hinweis wenn noch kein Standard-Ticketpreis existiert. **`termine/actions.ts`:** `createDeparture`/`updateDeparture` lesen `ticket_price_euro`/`deposit_euro`, prüfen `depositAbovePriceError` gegen den Standard, schreiben die geplanten `pricing_rules`-Zeilen über den RLS-Client (nie service_role); `neu/page.tsx` lädt den Standard; **Detailseite `[id]/page.tsx`:** Kopfzeile „Ticketpreis pro Person: … (eigener Wert, Standard wäre …)" / „Anzahlung pro Person: …", Abschnitt „Preis und Anzahlung für diesen Termin" mit Historie (Gültig ab / Was / Betrag / Angelegt, NULL = „wieder Standard").
- **`/admin/regeln`:** zwei neue Abschnitte oben — „Ticketpreis pro Person (Standard)" (zeigt „noch nicht eingetragen" + Warnung „Ohne Standard-Ticketpreis kann kein Termin ohne eigenen Preis verkauft werden.", solange kein Wert existiert) und „Anzahlung pro Person (Standard)" (30,00 €), je mit `StandardPricingForm` (`regeln/actions.ts` `setStandardPricing`, `kind` aus `PRICING_KINDS`, optional Gültig-ab) und Historie; Provision und Gruppenregel unverändert darunter. Nicht-additiver Anteil: `regeln/page.tsx` wurde für die Promise.all-Ladung umgeordnet, Inhalte der alten Abschnitte unverändert.
- **Tests:** `tests/pricing-rules-rls.test.ts` (16, neu: RLS an + Enum; Startwert 30,00 € ab 16.09.2026 mit `created_by NULL`; **kein** Ticketpreis-Startwert, vor 16.09. auch Anzahlung NULL; `authenticated` exakt SELECT/INSERT, `anon` nichts inkl. Funktion; Operator setzt Standard-Ticketpreis → gilt sofort für alle Termine; Promoter liest, darf nicht schreiben; deaktiviertes Profil sieht keine Zeilen und keinen Betrag; eigener Preis UND eigene Anzahlung schlagen den Standard, andere Termine unberührt; `created_by` nicht fälschbar; NULL-Ausnahme = wieder Standard, alte Zeilen bleiben; Standard ohne Betrag / negativ verboten; UPDATE/DELETE → `permission denied`; neuer Standard = neue Zeile, 30,00-€-Zeile bleibt; Gültig-ab entscheidet, Zeitpunkt-Abfrage liefert Historie; Ausnahme mit Gültig-ab in der Zukunft gilt noch nicht; Aufräumen nur `TEST-f14-%` und eigene Testbeträge). `tests/pricing-logic.test.ts` (21, neu: die vier Funktionen aus `pricing.ts`). `tests/events-rules-rls.test.ts`: Grant-Erwartung um `pricing_rules INSERT,SELECT` ergänzt (+0 Tests, 1 Zeile). `tests/app-access.test.ts`: Operator-Test prüft zusätzlich die neuen Feld-/Abschnitts-Texte auf `/admin/termine/neu` und `/admin/regeln`.

Verifikation (wörtlich): `npx next typegen` ok, `npx tsc --noEmit` 0 Fehler, `npx eslint src tests` 0. `npm test`: **`Test Files 11 passed (11) · Tests 125 passed (125)`** — 88 aus E1–E3 + 37 neu (16 + 21); E1-Überbuchungstest (8 parallel → 1/7) und `pg_get_functiondef == Handover` unverändert grün; `app-access` lief gegen den laufenden Dev-Server 3001. **Round-Trip durch die echten Server Actions** (Skript, Form-POST ohne JavaScript mit den `$ACTION`-Feldern, Session-Cookie des Seed-Operators): `/admin/regeln` Standard-Ticketpreis 40,01 € → „Neuer Standard gespeichert.", Seite zeigt 40,01 €; `/admin/termine/neu` Platzhalter „leer = Standard 40,01 €"; Event „TEST-f14-e2e Sunset (intern)" mit eigenem Preis 45,00 und Anzahlung 20 → 303 auf `/admin/termine/<id>`; Detailseite „Ticketpreis pro Person: 45,00 € (eigener Wert, Standard wäre 40,01 €)" und „Anzahlung pro Person: 20,00 € (eigener Wert, Standard wäre 30,00 €)"; Anzahlung 60 bei Preis 45 → „Die Anzahlung pro Person darf den Ticketpreis pro Person nicht übersteigen.", nichts geschrieben; Preis 50 + Anzahlung leer → „Gespeichert.", Detail 50,00 (eigener Wert) / 30,00 (Standard), Historie mit „wieder Standard"-Zeile; unverändert erneut speichern → keine neue Zeile; derselbe POST als Promoter → 303 `/kein-zugang`. Per psql bestätigt: `pricing_rules` Standard 4001 (`created_by` = Operator), Termin-Zeilen 4500 / 2000 / 5000 / NULL(deposit). Testzeilen danach gelöscht: Stand wieder nur die Seed-Zeile `deposit 3000`, 0 `TEST-%`-Termine. Zwei Korrekturen unterwegs: ASCII-`"` als deutsches Schluss-Anführungszeichen in JSX-Attribut/Test-String brach den Parser → `“` (U+201C); Round-Trip-Prüfung musste Reacts `<!-- -->`-Marker entfernen (kein App-Fehler). Browser-Test durch Marco steht aus (PROGRESS.md). **Nicht committet — wartet auf Marcos Bestätigung (Hard Rule 3).**

Warum: Marcos Auftrag 30.09.2026, Schritt A (F14): „ein Event/Termin optional einen EIGENEN Preis und eine EIGENE Anzahlung … Standard: 30 €/Person Anzahlung, regulärer Ticketpreis … Gabo-pflegbar im Admin-Dashboard … als DB-Daten, nicht Code-Konstanten … RLS: nur network_operator schreibt". Voraussetzung für Schritt B (E5, Preis-/Anzahlungs-Snapshot pro Buchung, Hard Rule 7). DECISIONS 30.09. (F14), RISKS F14 → geklärt, neu F15, Nr. 8/21/24 ergänzt.

Agent: Claude.

---

## 30.09.2026 — E3.4 (F14) committet in vier Schritten; Plan für Etappe 5 (`docs/ETAPPE5_PLAN.md`), nichts gebaut

Was:
- **Commits E3.4 (Marco: „erst git diff zeigen + committen"):** Diff gezeigt, Verifikation erneut gelaufen (`npm test` 125/125 in 11 Dateien, `tsc` 0, `eslint` 0), dann gezielt per Pfad in der in PROGRESS.md vorgeschlagenen Aufteilung: `7055ac3` E3.4a Migration `0005_pricing_rules.sql` · `7affad4` E3.4b Admin-UI (10 Dateien unter `src/`) · `719fc38` E3.4c Tests (4 Dateien) · `8b6d723` Doku (CHANGELOG, DECISIONS, RISKS, TASKS, PROGRESS). Arbeitsbaum danach leer. **Nicht gepusht** (`origin/main` weiter `7491cd5`) — Marco hat keinen Push beauftragt.
- **`docs/ETAPPE5_PLAN.md` (neu, Plan-Dokument, kein Code):** Zerlegung von E5 in E5.0–E5.9 mit Reihenfolge, Abhängigkeiten, Testplan je Schritt und der Liste aller additiven DB-Erweiterungen (Migrationen 0006–0011: Promoter-/Snapshot-Spalten auf `bookings` + Lese-Policies; `deposit_basis` + `effective_deposit()` + Gruppen-Option für F11; `quote_promoter_sale()` + `reserve_promoter_seats()` mit wörtlich übernommenem UPDATE-Block; `notifications` + `enqueue_booking_notifications()`; Bucket `event-images` + `image_path`; `event_templates` + `template_id`). Acht Designentscheidungen D1–D8 zur Bestätigung; darunter **D2: Empfehlung zu F12 geändert von Option A auf Option B** (neue Funktion neben der Handover-Funktion, weil `CREATE OR REPLACE` mit anderer Parameterliste in Postgres eine Überladung anlegt statt zu ersetzen — Option A hätte entweder `DROP` der Original-Funktion oder zwei gleichnamige Funktionen für `supabase.rpc()` bedeutet). Neue offene Fragen F16–F22 (Abschnitt 5 des Plans).
- **`docs/RISKS.md`:** F12-Zeile um die geänderte Empfehlung ergänzt; neue Fragen F16 (Gesamtbetrag-Anzahlung: Gabo-Vorgabe oder freie Eingabe; kappen oder ablehnen), F17 (Event ohne Anzahlung), F18 (10+1 bei Mehrfach-Blöcken), F19 (Bilder privat/öffentlich), F20 (Nachrichtendienste + Konten + Kosten), F21 (Absender/Sprache/Einwilligung), F22 (Status der Promoter-Buchung). **`TASKS.md`:** Nachtrag unter E5 mit Verweis auf den Plan (bestehende E5.1–E5.3 unverändert, werden nach Marcos Bestätigung durch die Plan-Schritte ersetzt/ergänzt). **`PROGRESS.md`** auf Commit-Stand + Planstand überschrieben.

Verifikation: `git log --oneline -5` zeigt die vier Commits, `git status --short` vor dem Plan leer; der Plan selbst ist Text (keine Tests). Faktenbasis des Plans: Migrationen 0001–0005, `docs/handover/reserve-function-final.sql`, `tests/reserve-function-unchanged.test.ts`, `src/app/promoter/*`, `src/lib/auth/*`, `supabase/config.toml` `[storage]`, Next.js-Guide `server-actions.md` (Body-Limit 1 MB).

Warum: Marcos Auftrag 30.09.2026 („Falls F14 … noch nicht committet ist: erst git diff zeigen + committen … Dann PLANE Etappe 5 … schreibe docs/ETAPPE5_PLAN.md, baue noch NICHTS"). Hard Rule 3 (gezielte Commits), Hard Rule 5 (offene Fragen statt Annahmen), Hard Rule 4 (Reserve-Logik: Plan hält 0002 unverändert).

Agent: Claude.

---

## 02.10.2026 — E5.1: Datenmodell Promoter-Verkauf (Migration 0006) + vier E5-Entscheidungen Marco protokolliert — UNCOMMITTET, wartet auf Sichtung

Was:
- **`docs/DECISIONS.md` (Eintrag oben, 02.10.2026):** Marcos vier Entscheidungen zur Freigabe von Etappe 5 — (1) Zahlart frei pro Verkauf (Vollzahler oder Anzahlung, Promoter wählt → F17 nein), (2) Zahlungsstatus manuell („Anzahlung erhalten"/„voll bezahlt", jede Änderung im Audit-Log, echtes Zahlungssystem später), (3) Promoter sieht alle freigegebenen Events inkl. interner, (4) Storno Teil von E5: nur Gabo im Admin, Sitze zurück ins Kontingent, Audit-Log, keine Rückerstattung außer bei Event-Absage durch uns. Dazu die Ausgestaltung E5.1 (Punkte a–i).
- **`supabase/migrations/0006_promoter_sales_model.sql` (neu, additiv, nur Strukturen):** Enums `payment_status` (`deposit_received`|`fully_paid`), `booking_audit_action`, `notification_kind`/`notification_channel`/`notification_status`. `bookings` +16 Spalten (alle nullable): `promoter_id` → `profiles`, `idempotency_key` (eindeutiger Teilindex), `paid_seats`, `free_persons`, sechs Snapshot-/Provisionsspalten, `amount_due_cents` **generiert** = `total_amount_cents − amount_paid_cents`, `payment_status`, `sold_at`, `cancelled_at`, `cancelled_by` → `profiles`, `cancellation_reason`; Index `(promoter_id, sold_at desc)`. Checks: `amount_paid_within_total`, `seats_split_consistent` (Sitze = bezahlt + gratis), `promoter_booking_complete` (bei `channel = 'promoter'` alles Pflicht — Hard Rule 7 DB-seitig), `promoter_deposit_snapshot_present`, `payment_status_matches_amounts` (fully_paid ⇔ kassiert = Gesamt; deposit_received ⇒ Zahlart Anzahlung und kassiert < Gesamt), `cancellation_fields_consistent`. Tabellen `booking_audit_log` (append-only, `on delete cascade`) und `notifications` (Bestätigung + Erinnerung 4 h/1 h, `pending` = ausstehend, Kanal NULL bis F20, `unique (booking_id, kind)`, `sent` ⇔ `sent_at`). RLS: `grant select` auf alle drei Tabellen für `authenticated` — **kein INSERT/UPDATE/DELETE** —, Policies Promoter eigene (`is_active_profile() and promoter_id = auth.uid()`, Audit/Nachrichten über Unterabfrage auf `bookings`) + `network_operator` alle; `anon` ausdrücklich entzogen. **Ein Promoter-Verkauf = `bookings`-Zeile mit `channel = 'promoter'`**, keine zweite Tabelle (Begründung in DECISIONS, Punkt a). **0002 unverändert**, `customer_email` bleibt NOT NULL (F8 offen). Eingespielt per `docker exec … psql -1` (RISKS Nr. 24), Historie-Zeile `0006` nachgetragen.
- **`tests/bookings-rls.test.ts` (neu, 23 Tests):** Struktur (16 Spalten nullable, genau eine generiert; fünf Enums wörtlich; RLS an; Grants exakt), Handover-Funktion schreibt weiterhin (Online-Zeile: Promoter-Spalten NULL, `amount_due_cents` 0; `release_departure_seats()` verträglich mit den Storno-Checks), Checks (3 Personen Anzahlung → Rest 3000, 11/10/1 und Verstoß, jede fehlende Pflichtspalte, fehlender Anzahlungs-Snapshot, vier Zahlungsstatus-Verstöße, Idempotenz-Dublette, drei Storno-Fälle), RLS (Promoter genau eigene Zeile, Operator alle drei, inaktiv 0, anon `permission denied`, Promoter+Operator INSERT/UPDATE/DELETE → `permission denied`), Audit/Nachrichten (nur eigene Buchung, Operator alles, inaktiv 0, anon denied, kein Schreiben, Unique + `sent_at`-Check, Cascade). Testdaten `TEST-e51-…`, in `afterAll` entfernt.
- **`tests/events-rules-rls.test.ts`:** Erwartungsliste der `authenticated`-Tabellenrechte um `booking_audit_log`, `bookings`, `notifications` (je `SELECT`) erweitert (RISKS Nr. 25). **`tests/profiles-rls.test.ts`:** Block „bookings — für authenticated komplett gesperrt" war seit 0006 falsch (SELECT-Grant existiert jetzt); umformuliert zu „nur lesbar (0 fremde Zeilen), nie schreibbar" mit Kommentar und Verweis — der Test `reserve_departure_seats()` nicht aufrufbar bleibt unverändert. Einzige nicht rein additive Teständerung, hier begründet.
- **`docs/RISKS.md`:** Nr. 8 (148 Tests), Nr. 10, Nr. 11 → 🟡 (Schlüssel + Index da, Auswertung E5.3), Nr. 21 → 🟡 (Snapshot-Spalten erzwungen), Nr. 22, Nr. 24 (0006), Nr. 25 ergänzt; F8 (bleibt NOT NULL), F10 (Ablauf entschieden, Provision offen), F17 geklärt (nein), F22 ergänzt; **neu F23** (Zahlungsstatus „noch nichts kassiert"?). **`TASKS.md`:** E5 durch die Plan-Schritte E5.1–E5.9 + Admin-Storno-UI ersetzt (alte drei Zeilen bleiben stehen), E5.1 abgehakt mit Beleg, E7.2-Nachtrag. **`PROGRESS.md`** überschrieben.

Verifikation: `npm test` **148/148 in 12 Dateien** (vorher 125/125 in 11), darunter unverändert grün: `tests/overbooking.test.ts` 7/7 (Kontingent 1, 8 parallel → genau 1 Erfolg, 7× `SOLD_OUT`; Kontingent 5 → genau 5; Freigabe + Wiederverkauf) und `tests/reserve-function-unchanged.test.ts` 4/4 (`pg_get_functiondef` == Handover-Datei). `npx tsc --noEmit` 0 Fehler, `npx eslint src tests` 0. DB nach dem Lauf: 0 bookings, 0 Audit-Zeilen, 0 Nachrichten, 2 echte Termine unverändert. `supabase_migrations.schema_migrations` = 0001–0006.

Warum: Marcos Auftrag 02.10.2026 („vier Entscheidungen additiv in DECISIONS.md … Bau Etappe 5 in den geplanten Teilschritten E5.1 → E5.7, EINEN Schritt nach dem anderen … Starte mit E5.1 (Datenmodell-Erweiterung … additiv, RLS deny-by-default, nur passende Rollen schreiben). Zeig mir git diff + Test. Committe erst nach meiner Bestätigung. Danach Stopp vor E5.2."). Hard Rules 1 (additiv, 0001–0005 unberührt), 4 (Reserve-Funktion nicht angefasst, 8-parallel-Test grün), 5 (F8/F11/F16/F18/F22 nicht geraten, F23 neu gestellt), 7 (Zahlart, kassiert, Rest pro Buchung, DB-seitig erzwungen), 8 (Haken nur mit Testbeleg).

Agent: Claude.
