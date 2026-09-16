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
