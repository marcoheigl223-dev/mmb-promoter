# TASKS.md — Schritt-für-Schritt-Liste

**Angelegt 16.09.2026 (Fundament).** Die konkreten, einzeln abhakbaren Schritte der aktuellen Phase — gröber als `PROGRESS.md`, feiner als der Etappenplan. Ein Schritt ist so geschnitten, dass er **einen eigenen Commit** ergibt.

## Regeln für diese Liste

1. Ein Schritt = eine abgeschlossene, prüfbare Änderung = ein Commit (gezielt per Pfad, kein `git add .`).
2. Vor jedem Commit `git diff` zeigen, danach Eintrag in `docs/CHANGELOG.md` (Hard Rule 2/3).
3. Erledigte Schritte werden **abgehakt, nicht gelöscht** (Hard Rule 1).
4. Ein Schritt wird erst abgehakt, wenn er **verifiziert** ist (Hard Rule 8).
5. Neue Schritte unten in der jeweiligen Phase ergänzen. Verworfene bleiben ~~durchgestrichen~~ mit Begründung stehen.

## Legende

`[ ]` offen · `[x]` erledigt + verifiziert · `[~]` läuft · `[!]` blockiert (Grund dahinter)

---

## Phase 0 — Fundament + Doku (Auftrag Marco, 16.09.2026)

Kein Feature, keine Migration, kein Schema.

- [x] **Schritt 1 — Doku-System angelegt** · `AGENTS.md` (Projektregeln), `CLAUDE.md`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `PROGRESS.md`, `TASKS.md`, `docs/decisions/` (README, Vorlage, ADR-0001), `docs/research/`, `docs/handover/` (je README mit Ablage-Anweisung)
- [x] **Schritt 2 — Lokale Supabase-Instanz** · `supabase init`, `project_id "mmb-promoter"`, Ports 4532x (Abweichung von 5532x begründet in `docs/DECISIONS.md`), eigenes JWT-Secret via `env()`, `supabase start` + `supabase status` erfolgreich, Boots-Instanz lief parallel
- [x] **Schritt 3 — Dev-Server auf 3001** · `package.json` `dev`/`start` mit `-p 3001`; `.env.local.example`; `.gitignore`-Ausnahmen für Vorlagen
- [x] **Schritt 4 — Erster Commit** · `git diff` gezeigt, gezielt per Pfad committet — `8c434d6` (Hash in `docs/CHANGELOG.md` nachgetragen)

## Manuelle Schritte für Marco (16.09.2026)

Diese Handgriffe macht Claude nicht selbst (Dateien außerhalb des Repos).

- [x] **M1 — Übergabe-Artefakt kopieren:** `C:\Projects\MyMallorcaExperience\docs\schema-snapshots\reserve-function-final.sql` → `docs/handover/reserve-function-final.sql` (Name unverändert) — 16.09.2026 abgelegt, `cmp` byteidentisch
- [x] **M2 — Recherche 1 kopieren:** `C:\Projects\MyMallorcaExperience\docs\compass_artifact_wf-2f7d398a-fb7e-5fbc-9aaf-c68477b70532_text_markdown.md` → `docs/research/2026-09-14_trennung-recht-technik-risiken.md` — 16.09.2026 abgelegt, 295 Zeilen vollständig
- [x] **M3 — Recherche 2 kopieren:** `C:\Users\marco\Downloads\compass_artifact_wf-ec5cc706-def8-5177-a5af-4fd72113ca25_text_markdown.md` → `docs/research/2026-09_technischer-umsetzungsplan-trennung.md` — 16.09.2026 abgelegt, 290 Zeilen vollständig
- [ ] **M4 (optional) — alten Boots-Etappenplan als Referenz:** `C:\Projects\MyMallorcaExperience\docs\PROMOTER_SYSTEM_PLAN.md` → `docs/research/2026-09-06_promoter-system-plan_boots.md`
- [x] **M5 — `.env.local` anlegen:** `.env.local.example` kopieren, Werte aus `supabase status` eintragen (ANON_KEY → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, SERVICE_ROLE_KEY → `SUPABASE_SERVICE_ROLE_KEY`) — 29.09.2026 angelegt (gitignored, `git check-ignore` bestätigt); Werte aus dem Studio-Container, weil die CLI blockiert war (RISKS Nr. 24)
- [x] **M6 — GitHub-Remote setzen** (`git remote add origin …`), sobald das Repo auf GitHub existiert — 29.09.2026: `origin` = github.com/marcoheigl223-dev/mmb-promoter, `git push -u origin main` (11 Commits bis `cda94b6`), vorher geprüft: keine Secrets in Baum oder History
- [~] **M7 — Offene Fragen in `docs/RISKS.md` beantworten** — 16.09.2026: F1, F2, F3, F5 geklärt (`docs/DECISIONS.md` „Geschäftsregeln"), F4 weitgehend. Noch offen: F6, F7, F8, F10 (Storno-Provision, bewusst offen), F11 (Anzahlung bei Gratisplatz), F12 (Funktions-Anpassung, Option A/B). Vor E3: F4-Detail; vor E5: F11 + F12; vor E7: F6 + F10.

~~Nach M1–M3: Index-Tabellen in `docs/research/README.md` und `docs/handover/README.md` nachtragen, RISKS Nr. 19 auf 🟢.~~ erledigt 16.09.2026

## Phase 1 — Etappenplan (Vorschlag Claude, 16.09.2026 — von Marco noch nicht beschlossen)

Erste Skizze E1–E8 vom 16.09. früh ist durch die Fassung unten ersetzt (gleicher Zuschnitt, verfeinert nach Marcos Geschäftsregeln). **Es wird nichts gebaut, bevor Marco den Plan bestätigt hat.** Reihenfolge ist verbindlich gemeint: E1 ist das Gate für alles Weitere.

**Tragende Design-Annahme (zur Bestätigung):** In dieser DB ist `tour_departures.capacity_total` **das Kontingent**, das Gabo pro Termin/Event einträgt — es gibt hier keine andere Kapazität. Damit braucht das atomare UPDATE der Handover-Funktion **keine zusätzliche WHERE-Bedingung**; die Überbuchungssperre wirkt unverändert gegen das Kontingent (ADR-0001, Hard Rule 4). Alternative wäre eine separate Kontingent-Spalte neben einer Bootskapazität — die kennt dieses System aber gar nicht.

### E1 — Sicherheitsnetz (vor jedem Feature) · Gate für E2–E8

- [x] **E1.1 — Testrunner:** Vitest 5 + `postgres` 3 (postgres.js) als DB-Client für Tests; `npm test` (= `vitest run`); `DATABASE_URL` aus Umgebung/`.env.local`/Default 45322, Schutz gegen Nicht-lokale URLs; Smoke-Test „DB erreichbar, PostgreSQL 17, Port 45322". Verifiziert 16.09.2026: `npm test` 2/2 grün, `tsc` + `eslint` sauber. `@types/node` ^20 → ^22 (Peer-Anforderung von Vitest 5). *(RISKS Nr. 8 → 🟡)*
- [x] **E1.2 — Migration `0001_inventory_core.sql`:** nur das, was die Handover-Funktion voraussetzt — Enums `booking_channel` ('online','promoter'), `payment_type`, `booking_status`; Tabelle `tour_departures` (id, `title`, `starts_at`, `capacity_total` = Kontingent ≥ 0, `seats_booked_total`, `status`, Check `total_within_capacity`); Tabelle `bookings` mit genau den 16 Spalten, die die Funktion befüllt; Grants für `service_role`. Keine Promoter-Spalten, keine Provision, keine Regeln. Verifiziert 16.09.2026: `supabase db reset` grün („Applying migration 0001_inventory_core.sql"), Enums/Spalten per `psql` gezählt (7 + 16), `supabase_migrations.schema_migrations` = 0001.
- [x] **E1.3 — Migration `0002_reserve_function_handover.sql`:** Handover-Zeilen 49–151 per `tail -n +49` übernommen (nicht abgetippt), 7-zeiliger Kopf davor. Verifiziert 16.09.2026: `diff <(tail -n +49 handover) <(tail -n +8 migration)` leer; `supabase db reset` grün; `tests/reserve-function-unchanged.test.ts` vergleicht `pg_get_functiondef` beider Funktionen mit dem CREATE-Block der Handover-Datei (identisch), prüft das atomare UPDATE wörtlich und die Rechte (anon/authenticated nein, service_role ja) — 6/6 grün. *(RISKS Nr. 3 → 🟢, Hard Rule 4)*
- [x] **E1.4 — Überbuchungstest:** `tests/overbooking.test.ts` — Termin mit Kontingent 1, **8 parallele Aufrufe** von `reserve_departure_seats()` → genau 1 Erfolg, 7× `SOLD_OUT`, `seats_booked_total = 1`; plus `release_departure_seats()` gibt den Platz frei und ein erneuter Aufruf gelingt. Verifiziert 16.09.2026: 7 Tests grün (8-parallel auf Kontingent 1 → 1/7; auf Kontingent 5 → 5/3; 2 Sitze auf 1 → SOLD_OUT; Kontingent 0 → SOLD_OUT; Status closed → SOLD_OUT; Freigabe → 0, idempotent, danach 8-parallel wieder genau 1; BOOKING_NOT_FOUND). `connect(8)` = 8 eigene Verbindungen, vorab geöffnet. Gesamt `npm test` 13/13, Ausgabe wörtlich im CHANGELOG. *(RISKS Nr. 2 → 🟢, Nr. 3 → 🟢, Nr. 8 → 🟡)*

### E2 — Login + Rollen

- [x] **E2.1 — Migration `0003_profiles_roles.sql`:** `profiles` (1:1 zu `auth.users`; `role` admin|promoter, `active`, `display_name`), RLS; erster Admin per Seed-Skript (nur lokal). Umgesetzt 29.09.2026: Enum `user_role` = `network_operator` | `promoter` (Name statt „admin", DECISIONS 29.09.), Helfer `current_profile_role()`/`is_active_profile()`/`is_network_operator()` (security definer, Rolle aus der DB), **RLS auf profiles, tour_departures, bookings aktiviert** (deny-by-default), erste SELECT-Policies (eigenes Profil; Operator alle; aktive Profile lesen Termine; bookings ohne Policy). `supabase/seed.sql`: 3 Konten (Operator, Promoter, deaktivierter Promoter). Verifiziert: per psql eingespielt, `tests/profiles-rls.test.ts` 16/16 grün.
- [x] **E2.2 — Login-Seite + Schutz** von `/admin/*` und `/promoter/*` (Next.js 16: Proxy, nicht Middleware — Guide lesen; F9 dabei klären). Umgesetzt 29.09.2026: `src/proxy.ts` (Session-Refresh + optimistischer Redirect), DAL `src/lib/auth/dal.ts` (`getUser()` + Profil aus DB, `requireArea()` in beiden Layouts), reine Entscheidung `src/lib/auth/access.ts`, `/login` (Server Action, Ziel nach DB-Rolle, inaktiv/ohne Profil → sofort signOut), `/gesperrt`, `/kein-zugang`, Logout, noindex dreifach (Header, robots.txt, Metadata). `config.toml`: Passwort ≥ 12, `enable_signup=false`. F9: Turbopack läuft, kein `--webpack`. Verifiziert: `tsc`, `eslint`, curl-Redirects, `tests/app-access.test.ts` 7/7.
- [x] **E2.3 — Test „Promoter kommt nicht ins Admin", „inaktiver Promoter kommt nicht rein"** (Vorlage: `test-promoter-accounts.mjs` aus der Boots-Historie). Verifiziert 29.09.2026: `tests/access-guard.test.ts` (11, reine Logik), `tests/profiles-rls.test.ts` (16, RLS + gefälschte Token-Claims wirkungslos), `tests/auth-login.test.ts` (6, GoTrue: Login, Signup 422, 11 Zeichen → weak_password), `tests/app-access.test.ts` (7, E2E gegen Dev-Server, wird ohne Server übersprungen). Gesamt `npm test` 53/53.

### E3 — Admin (Gabo): Termine/Events, Kontingent, Regeln · *vorher F4-Detail klären*

- [ ] **E3.1 — Migration `0004_events_and_rules.sql`:** `tour_departures` um Event-Typ/Notiz ergänzen (additiv); `commission_rules` (Standard 10 €/Ticket + Override pro Termin/Event, Gültig-ab); `group_rules` (Schwelle 11, Gratis 1, Gabo-pflegbar). Beträge nur als Daten, nie als Konstante im Code.
- [ ] **E3.2 — Admin-UI:** Termin/Event anlegen, Kontingent (`capacity_total`) setzen/ändern, Status öffnen/schließen; Provisionsstandard und Event-Override pflegen; 10+1-Parameter pflegen.
- [ ] **E3.3 — Test:** Kontingent kann nicht unter `seats_booked_total` gesenkt werden; Regeländerung erzeugt neue Gültigkeit, überschreibt keine alte.

### E4 — Admin: Promoter-Accounts

- [ ] **E4.1 — Anlegen, Deaktivieren, Passwort zurücksetzen** (Mindestlänge 12, ein Account pro Person) *(RISKS Nr. 9)*
- [ ] **E4.2 — Test:** deaktivierter Promoter kann nicht verkaufen.

### E5 — Promoter: Verkaufen gegen Kontingent · *vorher F11 + F12 entscheiden*

- [ ] **E5.1 — Migration `0005_reserve_promoter_params.sql`:** Funktion additiv erweitern (F12, Vorschlag Option A): Parameter Kanal, Zahlungstyp (Anzahlung/Vollzahlung), Promoter-ID, Anzahlung-Cents, Rest-Cents, Provisions-Snapshot-Cents, Idempotenz-Key; `bookings` um diese Spalten ergänzen. **UPDATE-Block byteidentisch**, Diff nur Signatur + INSERT. Verifikation: E1.4 erneut grün + Diff-Nachweis. *(RISKS Nr. 23)*
- [ ] **E5.2 — Verkaufs-Flow:** Termin wählen → Personen → Regel anwenden (Anzahlung = Personen × 30 €; 10+1: 11 Personen reservieren 11 Sitze, bezahlt/provisioniert 10) → **Bestätigungsschritt** mit ausgeschriebenen Beträgen → Reservierung. Idempotenz-Token gegen Doppelklick. *(RISKS Nr. 10/11/22)*
- [ ] **E5.3 — Tests:** Anzahlung 3 Personen = 90 €; 11 Personen → 11 Sitze belegt, Provision 10 × Snapshot; Doppelklick erzeugt eine Buchung; Kontingent 0 → `SOLD_OUT` sichtbar in der UI.

### E6 — Promoter-Dashboard

- [ ] **E6.1 — Historie, Provisionssumme (nur Snapshots), einfache Statistik** *(RISKS Nr. 21)*

### E7 — Admin-Auswertung, Export, Storno · *vorher F6 + F10 klären*

- [ ] **E7.1 — Auswertung pro Promoter/Termin, CSV-Export** (Kanal, Zahlungstyp, kassiert, offen, Provisions-Snapshot) *(RISKS Nr. 14)*
- [ ] **E7.2 — Storno** über `release_departure_seats()`; Provisionsbehandlung erst nach F10.

### E8 — Live-Vorbereitung · *vorher F7*

- [ ] **E8.1 — Cloud-Instanz** (eigenes Projekt, eigenes Secret), Deployment, Domain
- [ ] **E8.2 — Rechtstexte/Datenschutz** für dieses Projekt, Anwalt/Gestor-Check *(RISKS Nr. 13/16)*
- [ ] **E8.3 — Abschluss-Verifikation** (alle Tests, 8-parallel gegen die Cloud-DB) + Doku-Stand
