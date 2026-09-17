# DIAGNOSE_MASTERPLAN_BASIS.md — Voll-Diagnose mmb-promoter (Grundlage für den Masterplan)

**Datum:** 17.09.2026 · **Agent:** Claude · **Auftrag (Marco):** nur lesen und analysieren, nichts bauen.
**Quellen:** komplettes Repo (Stand `ae3a8d0`, Working Tree sauber), laufende lokale Supabase-Instanz, `npm test` und `tsc` am 17.09.2026 erneut ausgeführt, beide Recherchen in `docs/research/`, Handover-Datei.

Diese Datei ist eine **Momentaufnahme** (Referenz), keine Regel-Datei. Verbindlich bleiben `AGENTS.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `TASKS.md`. Wo diese Diagnose etwas Neues findet, ist es unten als **Befund** markiert und muss von Marco in RISKS/TASKS übernommen werden — hier wird nichts entschieden.

---

## 0. Kompakte Übersicht (Ergebnis zuerst)

| Bereich | Stand 17.09.2026 | Reifegrad |
|---|---|---|
| Doku-System (Regeln, Log, ADR, Risiken, Tasks, Progress) | vollständig, konsistent, alle Verweise zeigen auf existierende Dateien | **95 %** |
| Lokale Infrastruktur (Supabase 4532x, Dev-Server 3001, eigenes JWT-Secret) | läuft, beide Instanzen parallel möglich | **90 %** |
| Übergabe-/Recherche-Dateien | alle drei Pflichtdateien abgelegt und geprüft (M4 optional offen) | **100 %** (Pflicht) |
| Datenbank-Schema | 2 Migrationen: Enums, `tour_departures`, `bookings`, Reserve-/Release-Funktion | **20 %** des Zielschemas |
| Sicherheitsnetz (Tests) | Vitest, 13 Tests grün, Überbuchung bewiesen, Funktions-Identität automatisiert | **E1 100 %**, gesamt ~25 % |
| Auth / Rollen / RLS | **nichts** — 0 Nutzer, RLS auf beiden Tabellen aus, kein Supabase-Client installiert | **0 %** |
| Anwendung (`src/app`) | unverändertes Create-Next-App-Gerüst, keine einzige eigene Zeile | **0 %** |
| Geschäftsregeln im Code/Schema | keine (bewusst — nur in `docs/DECISIONS.md`) | **0 %** |
| Deployment / Domain / Zahlung | nicht festgelegt (F7) | **0 %** |
| **Gesamt (Weg bis erster Promoter-Verkauf, E1–E5)** | Fundament fertig, Features 0 | **~20 %** |

**Kernaussage:** Das Projekt hat ein ungewöhnlich solides Fundament (Doku, Instanz, Tests, unantastbare Reserve-Funktion mit Beweis) und **null Features**. Etappe 1 ist **abgeschlossen und verifiziert**, nicht „startbereit". Der nächste Baustein ist E2 (Login + Rollen); ihn blockiert nichts Technisches, nur Marcos Freigabe.

---

## 1. IST-STAND — was existiert, was ist Gerüst, was ist echt gebaut

### 1.1 Echt gebaut (eigene Arbeit, verifiziert)

| Baustein | Datei(en) | Beleg |
|---|---|---|
| Projektregeln + Doku-Schichten | `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/CHANGELOG.md` (8 Einträge, chronologisch), `docs/DECISIONS.md` (6 Einträge), `docs/RISKS.md` (23 Risiken, 12 Fragen), `TASKS.md`, `PROGRESS.md`, `docs/decisions/` (README, Vorlage, ADR-0001) | alle Dateien vorhanden, gegenseitige Verweise stimmen |
| Lokale Supabase-Instanz | `supabase/config.toml` (`project_id "mmb-promoter"`, Ports 45320–45329, Inspector 8084, `site_url` 3001, `jwt_secret = env(...)`), `supabase/.env.example`, `supabase/.env.local` (gitignored, vorhanden) | 12 Container `supabase_*_mmb-promoter` laufen (healthy); `supabase status` liefert Keys; CLI 2.108.0, Postgres 17 |
| Dev-Server-Konfiguration | `package.json` (`dev`/`start` mit `-p 3001`), `.env.local.example`, `.gitignore` mit Vorlagen-Ausnahmen | CHANGELOG 16.09.: `next dev -p 3001` meldet Ready |
| Migration 0001 (Kern-Inventar) | `supabase/migrations/0001_inventory_core.sql` | in DB angewendet (`schema_migrations`: 0001, 0002); Enums `booking_channel` (online, promoter), `payment_type` (deposit, full), `booking_status` (pending, confirmed, cancelled, refunded); `tour_departures` 7 Spalten, `bookings` 16 Spalten |
| Migration 0002 (Handover-Funktionen) | `supabase/migrations/0002_reserve_function_handover.sql` | Zeilen 49–151 der Handover-Datei byteidentisch; `reserve_departure_seats()` und `release_departure_seats()` in DB vorhanden; Rechte nur `service_role` |
| Testrunner + Tests | `vitest.config.mts`, `tests/db.ts`, `tests/smoke.test.ts` (2), `tests/reserve-function-unchanged.test.ts` (4), `tests/overbooking.test.ts` (7) | **17.09.2026 erneut ausgeführt: 3 Dateien, 13/13 grün, 1,0 s; `tsc --noEmit` sauber** |
| Übergabe-Artefakt | `docs/handover/reserve-function-final.sql` (151 Zeilen) | `cmp` gegen Boots-Quelle byteidentisch (CHANGELOG 16.09.) |
| Recherchen | `docs/research/2026-09-14_trennung-recht-technik-risiken.md` (295 Z.), `docs/research/2026-09_technischer-umsetzungsplan-trennung.md` (290 Z.) | vollständig, indexiert in `docs/research/README.md` |

### 1.2 Nur Gerüst (Create-Next-App, unverändert)

- `src/app/page.tsx` — Vercel-Template-Startseite („To get started, edit the page.tsx file"), `src/app/layout.tsx` (Metadata „Create Next App", `lang="en"`), `src/app/globals.css`, `public/*.svg`, `next.config.ts` (leer), `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json` (Standard + `**/*.mts` für Vitest).
- Es gibt **keine** Route außer `/`, keinen Supabase-Client, keine Server Action, kein Proxy/Middleware, keine Komponente.
- `README.md`: eigener Kopf (Projektbeschreibung, Startbefehle) plus das Original-Boilerplate darunter. Der Satz „noch keine Migration" im README ist **überholt** (Befund B1, siehe Abschnitt 6).

### 1.3 Was im Repo NICHT existiert (Faktenliste, für Abschnitt 4 und 5)

| Fehlt | Für Etappe | Bemerkung |
|---|---|---|
| Root-`.env.local` | E2 (App braucht Anon-/Service-Key) | Manueller Schritt M5; Werte liegen in `supabase status` vor |
| npm-Pakete `@supabase/supabase-js`, `@supabase/ssr` | E2 | nicht installiert (`node_modules/@supabase` fehlt) |
| `supabase/seed.sql` | E2.1 (erster Admin lokal) | `config.toml` verweist auf `./seed.sql`, Datei existiert nicht; CLI toleriert das |
| Tabelle `profiles`, Rollen, RLS-Policies | E2.1 | RLS auf `tour_departures` und `bookings` ist **aus** (`relrowsecurity = false`); Zugriff läuft heute nur über `service_role`, was für die Test-Phase korrekt ist |
| Auth-Nutzer | E2 | `auth.users` = 0 Zeilen |
| Promoter-/Provisions-/Regel-Spalten und -Tabellen | E3, E5 | `bookings` hat keine `promoter_id`, keine Provisions-Snapshot-Spalte, keine Anzahlungs-/Rest-Spalte, keinen Idempotenz-Key |
| Parametrisierte Reserve-Funktion (Kanal, Zahlungstyp, Promoter) | E5.1 | Handover-Funktion schreibt fest `'online'`/`'full'` (RISKS Nr. 23) |
| GitHub-Remote | M6 | `git remote -v` leer; alle 10 Commits nur lokal |
| Deployment, Domain, Zahlungskonto | E8 | F7 offen |
| Boots-Etappenplan als Referenz | optional M4 | `docs/research/2026-09-06_promoter-system-plan_boots.md` nicht abgelegt |

### 1.4 Git-Stand

10 Commits, alle vom 16.09.2026, jeder Etappenschritt einzeln (`fc50fdf` E1.0 → `e6f6801` E1.1 → `8d75b7c` E1.2 → `385fcc0` E1.3 → `b416e5d` E1.4 → `ae3a8d0` PROGRESS-Endstand). Working Tree sauber. Kein Remote, kein Branch außer `main`.

---

## 2. GEKLÄRTE REGELN vs. OFFENE FRAGEN

### 2.1 Verbindlich verankert (`docs/DECISIONS.md`, Marco 16.09.2026)

| Regel | Inhalt | Konsequenz für Schema/Code (noch **nicht** umgesetzt) |
|---|---|---|
| **Anzahlung** | 30 € pro Person/Ticket, nicht pro Buchung. 3 Personen = 90 €, Rest im Bus | Bestätigungsschritt zeigt Personen × 30 € und Rest; beide Beträge pro Buchung gespeichert (Hard Rule 7). `bookings` hat bereits `total_amount_cents` und `amount_paid_cents`; ein expliziter „offener Rest" fehlt noch als Spalte (E5.1) |
| **Provision** | 10 € fest pro Ticket; **durch Gabo im Dashboard änderbar**; interne Events dürfen abweichen | Regel als Datensatz (`commission_rules`: Standard + Override pro Termin/Event, Gültig-ab), **Snapshot pro Buchung** (RISKS Nr. 21). Nie als Konstante im Code |
| **10+1-Gruppenregel** | ab 11 Personen ist 1 gratis; Provision für 10; Schwelle und Gratis-Anzahl **Gabo-pflegbar** | `group_rules`-Datensatz; Reserve-Funktion wird mit **Personenzahl** (11) aufgerufen, bezahlt/provisioniert werden 10 (RISKS Nr. 22) |
| **Kontingent** | Gabo trägt pro Termin/Event manuell ein Kontingent ein; Promoter verkaufen atomar dagegen; keine Cross-DB-Kopplung; **ein** Kontingent pro Termin für das ganze Netzwerk (nicht pro Promoter); Termine werden hier manuell angelegt | `capacity_total` **ist** das Kontingent (DECISIONS 16.09.); keine Zusatzspalte, keine zusätzliche WHERE-Bedingung. Umgesetzt in 0001, bewiesen in E1.4 |
| **Storno-Provision** | **bewusst offen gelassen** — nicht erfinden | Bis F10: Storno = Status setzen + `release_departure_seats()`, Provision unangetastet, Auswertung zeigt „Storno, Provision ungeklärt" |
| **Architektur** | ADR-0001: eigene DB, Domain, Login, Deployment, Repo; Wiederverwendung nur über Code | umgesetzt (Instanz, Ports, Secret, Handover-Datei) |
| **Ports** | 4532x / 3001 statt 5532x | umgesetzt |
| **JWT-Secret** | eigenes Secret via `env()`, gitignored | umgesetzt |

### 2.2 Offene Fragen (aus `docs/RISKS.md`, mit Gate-Zuordnung)

| Frage | Kern | Blockiert | Stand / Vorschlag im Repo |
|---|---|---|---|
| **F10 Storno-Provision** | entfällt ganz / anteilig / bleibt? Anders, wenn Kunde die Anzahlung verliert? | **E7.2** (Storno-Behandlung), Auswertung E7.1 | offen, ausdrücklich nicht erfinden |
| **F11 Anzahlung beim Gratisplatz** | 11 Personen: 330 € oder 300 €? | **E5.2** (Bestätigungsschritt), E5.3 (Test) | offen, entstanden aus F1 + F3 |
| **F12 Funktions-Anpassung** | Option A: dieselbe Funktion additiv per `CREATE OR REPLACE` um Parameter erweitern, UPDATE-Block byteidentisch. Option B: neue Funktion `reserve_promoter_seats()` daneben | **E5.1** (Migration 0005) | offen; Claude-Vorschlag Option A (ein Reservierungspfad, ein Test). **Hinweis dieser Diagnose:** Bei Option A greift `tests/reserve-function-unchanged.test.ts` nach der Erweiterung nicht mehr byteidentisch — der Test müsste dann den UPDATE-Block statt der ganzen Funktion vergleichen (Befund B4) |
| F4-Detail interne Events | Was ist ein internes Event genau (eigene Gabo-Veranstaltung ohne Boots-Bezug? andere Preise/Anzahlung?) | **E3** (Event-Typ in 0004) | weitgehend geklärt: Events gehören ins System |
| F6 Gesamtsicht/Abrechnung | CSV je Seite + manueller Abgleich, oder gemeinsamer Report? | **E7.1** | offen |
| F7 Domain, Hosting, Zahlungskonto | — | **E8** | offen; Recherche nennt AOVO-Server, Supabase Pro EU, Stripe getrennt, Resend — alles unbestätigt |
| F8 Kunden-E-Mail Pflicht? | `bookings.customer_email` ist heute `NOT NULL` (aus dem Boots-Schema übernommen) | **E5.1/E5.2** | offen. **Hinweis:** Am Strand ohne E-Mail kann heute keine Buchung angelegt werden; Lockerung wäre additive Migration (`DROP NOT NULL`), berührt die Funktion nicht |
| F9 `--webpack` nötig? | Boots-Projekt braucht es (dortige RISKS Nr. 20) | E2.2 | wird beim ersten Feature-Schritt entschieden; `next dev` lief am 16.09. mit Turbopack ohne Befund, aber ohne echten Code |

**Gate-Reihenfolge der Fragen:** F4-Detail → vor E3 · F8, F11, F12 → vor E5 · F6, F10 → vor E7 · F7 → vor E8.

---

## 3. DER ETAPPENPLAN E1–E8 — Stand, Reihenfolge, Gates

Bestätigt von Marco am 16.09.2026 (DECISIONS „Etappenplan E1–E8 bestätigt"). Reihenfolge ist verbindlich gemeint; E1 war das Gate für alles Weitere.

| Etappe | Inhalt (Kurz) | Status | Gate davor | Was danach möglich ist |
|---|---|---|---|---|
| **E1 Sicherheitsnetz** | E1.1 Vitest · E1.2 Migration 0001 · E1.3 Migration 0002 unverändert · E1.4 8-parallel-Test | **✅ komplett, verifiziert** (13/13, 17.09. erneut grün) | — | alles Weitere |
| **E2 Login + Rollen** | E2.1 `0003_profiles_roles.sql` (profiles admin/promoter, active, RLS, Seed-Admin) · E2.2 Login + Schutz `/admin/*`, `/promoter/*` (Next.js 16 **Proxy**, F9) · E2.3 Rollen-Tests | ⬜ nicht begonnen | Marcos Freigabe („Danach Stopp") | E3, E4 |
| **E3 Admin: Termine/Events, Kontingent, Regeln** | E3.1 `0004_events_and_rules.sql` (Event-Typ, `commission_rules`, `group_rules`) · E3.2 Admin-UI · E3.3 Tests (Kontingent nicht unter `seats_booked_total`; Regeländerung = neue Gültigkeit) | ⬜ | **F4-Detail** | E5 (braucht Termine + Regeln) |
| **E4 Admin: Promoter-Accounts** | E4.1 Anlegen/Deaktivieren/Passwort (≥ 12 Zeichen) · E4.2 Test „deaktiviert kann nicht verkaufen" | ⬜ | E2 | E5 (braucht Promoter-Accounts) |
| **E5 Promoter: Verkaufen** | E5.1 `0005_reserve_promoter_params.sql` (Parameter Kanal, Zahlungstyp, Promoter, Anzahlung, Rest, Provisions-Snapshot, Idempotenz-Key; UPDATE-Block byteidentisch) · E5.2 Verkaufs-Flow mit Bestätigungsschritt · E5.3 Tests | ⬜ | **F11, F12** (+ F8) · E3 · E4 | **erster lauffähiger Promoter-Verkauf** |
| **E6 Promoter-Dashboard** | Historie, Provisionssumme (nur Snapshots), Statistik | ⬜ | E5 | — |
| **E7 Auswertung, Export, Storno** | E7.1 Auswertung + CSV · E7.2 Storno über `release_departure_seats()` | ⬜ | **F6, F10** · E5 | Saisonabrechnung |
| **E8 Live-Vorbereitung** | Cloud-Instanz, Deployment, Domain, Rechtstexte, Abschluss-Verifikation (8-parallel gegen Cloud) | ⬜ | **F7** · Anwalt/Gestor (RISKS 13/16) | Live-Gang |

**Kritischer Pfad zum ersten Verkauf:** E2 → E3 (+F4) → E4 → E5 (+F11, F12, F8). E3 und E4 hängen beide nur an E2 und könnten parallel geplant werden; E5 braucht beide.

**Mitlaufende Pflicht bei jeder Etappe:** Hard Rule 4 (E1.4 bei jeder Funktionsänderung erneut grün), Hard Rule 2/3 (CHANGELOG, Diff vor Commit, Pfad-Commit), Hard Rule 8 (Haken nur mit Beleg).

---

## 4. ABHÄNGIGKEITEN — was die Reserve-Funktion braucht, was E1 brauchte

### 4.1 Was `reserve_departure_seats()` / `release_departure_seats()` voraussetzen — und was davon da ist

| Voraussetzung | Verwendet in der Funktion | Vorhanden? |
|---|---|---|
| Enum `booking_channel` mit Wert `'online'` | fester Cast `'online'::booking_channel` | ✅ 0001 (`online`, `promoter`) |
| Enum `payment_type` mit Wert `'full'` | fester Cast `'full'::payment_type` | ✅ 0001 (`deposit`, `full`) |
| Enum `booking_status` mit `'pending'`, `'cancelled'` | INSERT-Status; Release-Vergleich | ✅ 0001 (4 Werte) |
| `tour_departures.id`, `.status` (Text, `'open'`), `.seats_booked_total`, `.capacity_total` | das atomare UPDATE | ✅ 0001, `status` als Text-Check (open/closed/cancelled) |
| `bookings` mit exakt: `departure_id, channel, payment_type, seats, total_amount_cents, amount_paid_cents, status, stripe_payment_intent_id, customer_name, customer_email, customer_phone, shuttle, has_allergy, allergy_details` (+ `id`, `created_at`) | INSERT + `RETURNS bookings` | ✅ 0001, 16 Spalten |
| `RETURNS bookings` → jede **spätere** Spalte in `bookings` ändert den Rückgabetyp automatisch | Row-Typ | ✅ unkritisch, aber: `pg_get_functiondef` bleibt gleich; Tests vergleichen nur den Funktionstext |
| Rollen `service_role`, `anon`, `authenticated` | GRANT/REVOKE | ✅ Supabase-Standard |
| Extension `pgcrypto` (`gen_random_uuid`) | Default der `id`-Spalten | ✅ 0001 |
| `SECURITY DEFINER` + `search_path = public` | Sicherheits-Eigenschaft | ✅ byteidentisch, in `tests/reserve-function-unchanged.test.ts` mitgeprüft (Rechte) |

**Nichts fehlt.** Die Funktion läuft gegen das Schema aus 0001, der Beweis ist E1.4.

### 4.2 „Was fehlt, damit Etappe 1 starten kann?" — Antwort: **nichts, E1 ist fertig**

Die Frage aus dem Auftrag ist gegenüber dem Repo-Stand überholt. E1.1–E1.4 sind seit dem 16.09.2026 committet (`e6f6801`, `8d75b7c`, `385fcc0`, `b416e5d`) und am 17.09.2026 erneut verifiziert (13/13). Was E1 **gebraucht hatte** und was heute da ist: Testrunner (Vitest 5 + postgres.js 3), lokale Instanz mit Postgres 17 auf 45322, Schema 0001, Funktion 0002, 8 eigene Verbindungen im Test (`connect(8)`).

### 4.3 Was fehlt, damit **E2** (die nächste Etappe) starten kann

| Nr. | Fehlt | Art | Wer |
|---|---|---|---|
| 1 | Marcos Freigabe für E2 („Danach Stopp" vom 16.09.) | Entscheidung | Marco |
| 2 | Root-`.env.local` (M5) mit ANON_KEY / SERVICE_ROLE_KEY / URLs aus `supabase status` | manuell, außerhalb des Repos | Marco (oder Claude mit Freigabe, Werte liegen lokal vor) |
| 3 | `@supabase/supabase-js` + `@supabase/ssr` als Dependency | `npm install`, eigener Commit | Claude in E2.2 |
| 4 | Lesen der Next.js-16-Guides `01-app/01-getting-started/16-proxy.md` und `03-api-reference/03-file-conventions/proxy.md` (Proxy statt Middleware) vor E2.2 | Regel aus `AGENTS.md` | Claude |
| 5 | Entscheidung, wie der erste Admin lokal entsteht (Seed-SQL gegen `auth.users` vs. Supabase-Admin-API-Skript) — TASKS E2.1 sagt „Seed-Skript (nur lokal)" | Design-Detail | Claude schlägt vor, Marco bestätigt |
| 6 | Passwort-Mindestlänge: `config.toml` steht auf **6**, Plan sagt **≥ 12** (RISKS Nr. 9, E4.1) | Config-Änderung, gehört zu E2.1 oder E4.1 | Befund B2 |

Kein Punkt davon ist technisch schwer. Punkt 1 ist der einzige echte Blocker.

### 4.4 Abhängigkeitsgraph der Datenbank-Migrationen (geplant)

```
0001 inventory_core (Enums, tour_departures, bookings)          ✅
  └─ 0002 reserve_function_handover (byteidentisch)              ✅
       ├─ 0003 profiles_roles (E2.1) — profiles 1:1 auth.users, RLS
       │    └─ 0004 events_and_rules (E3.1) — Event-Typ, commission_rules, group_rules
       │         └─ 0005 reserve_promoter_params (E5.1) — bookings + Promoter-/Provisions-/
       │              Idempotenz-Spalten, Funktion additiv (F12), UPDATE-Block byteidentisch
       │              → E1.4 erneut grün + Diff-Nachweis PFLICHT
       └─ (Storno-Provision, E7.2) — erst nach F10, keine Migration vorab
```

---

## 5. WAS DAS PROJEKT BIS ZUM ERSTEN LAUFFÄHIGEN PROMOTER-VERKAUF BRAUCHT — priorisiert

Definition „erster lauffähiger Promoter-Verkauf": Ein eingeloggter, aktiver Promoter wählt einen von Gabo angelegten Termin mit Kontingent, gibt Personenzahl und Zahlungstyp ein, sieht den Bestätigungsschritt mit Beträgen, reserviert atomar, und die Buchung trägt Promoter, Kanal `promoter`, Zahlungstyp, kassierten Betrag, offenen Rest und Provisions-Snapshot. Lokal, ohne Deployment.

### P0 — Entscheidungen (kosten keine Entwicklungszeit, blockieren aber)

1. **E2-Freigabe** durch Marco.
2. **F12** (Option A vs. B) — bestimmt Migration 0005 und die Test-Strategie (Befund B4).
3. **F11** (Anzahlung bei 11 Personen: 300 € oder 330 €) — bestimmt Bestätigungsschritt und Test E5.3.
4. **F8** (E-Mail am Strand optional?) — bestimmt, ob 0005 `customer_email` lockert; ohne Antwort kann der Strand-Flow praktisch nicht benutzt werden.
5. **F4-Detail** (was ist ein internes Event) — bestimmt Event-Typ in 0004. Kann notfalls mit einem minimalen Feld (`is_internal boolean`) starten, wenn Marco das so freigibt.

### P1 — Technisches Fundament für Features (Reihenfolge = Etappenplan)

6. **M5 `.env.local`** + `@supabase/supabase-js`/`@supabase/ssr` installieren.
7. **E2.1 Migration 0003** `profiles` (role admin|promoter, active, display_name), RLS deny-by-default auf `profiles`, `tour_departures`, `bookings`; Seed-Admin nur lokal.
8. **E2.2 Login + Proxy-Schutz** für `/admin/*` und `/promoter/*` (Next.js 16 Proxy; F9 dabei prüfen). Passwort-Mindestlänge auf 12 (Befund B2).
9. **E2.3 Rollen-Tests** (Promoter kommt nicht ins Admin; inaktiver Promoter kommt nicht rein). RISKS Nr. 8 → 🟢.
10. **E3.1 Migration 0004** Event-Typ/Notiz an `tour_departures`, `commission_rules`, `group_rules` — Beträge als Daten.
11. **E3.2 Admin-UI** Termin anlegen, Kontingent setzen/ändern, öffnen/schließen, Provisionsstandard/Override, 10+1-Parameter.
12. **E3.3 Tests** Kontingent nicht unter `seats_booked_total` (heute schützt nur der Check-Constraint `total_within_capacity`, das ist gut, aber die UI muss die Fehlermeldung tragen); Regeländerung = neue Gültigkeit.
13. **E4.1/E4.2 Promoter-Accounts** anlegen/deaktivieren/Passwort; Test „deaktiviert kann nicht verkaufen".

### P2 — Der Verkauf selbst

14. **E5.1 Migration 0005** — Spalten `promoter_id`, `deposit_cents`/`outstanding_cents` (Namen offen), `commission_snapshot_cents`, `idempotency_key` (unique), Funktion additiv nach F12. **UPDATE-Block byteidentisch, E1.4 erneut grün, Diff-Nachweis im CHANGELOG.**
15. **E5.2 Verkaufs-Flow** — Termin → Personen → Regel (Personen × 30 €, 10+1 als reine, getestete Funktion) → Bestätigungsschritt → Reservierung mit Idempotenz-Token. Aufruf der Reserve-Funktion **immer mit Personenzahl** (RISKS Nr. 22).
16. **E5.3 Tests** — 3 Personen = 90 €; 11 Personen → 11 Sitze, Provision 10 × Snapshot; Doppelklick = eine Buchung; Kontingent 0 → SOLD_OUT in der UI.

**Damit ist der erste Verkauf lauffähig.** Alles danach (E6 Dashboard, E7 Auswertung/Storno, E8 Live) ist für „lauffähig" nicht nötig, für „nutzbar in der Saison" aber schon: Ohne E7.1 (Export) kann Gabo nicht mit dem Boot abrechnen, ohne E8 gibt es das System nur auf Marcos Rechner.

### Bewusst nicht enthalten

- Keine öffentliche Buchungsseite, kein Online-Kanal, kein Stripe-Flow für Promoter-Verkäufe (nicht Ziel, `AGENTS.md`).
- Kein automatischer Abgleich mit der Boots-DB (ADR-0001). RISKS Nr. 1 (Doppelverkauf über zwei DBs) bleibt 🔴 und wird **im Boots-Projekt** gelöst, nicht hier.

---

## 6. BEFUNDE dieser Diagnose (neu, noch nicht in RISKS/TASKS — Marco entscheidet)

| # | Befund | Schwere | Vorschlag |
|---|---|---|---|
| **B1** | `README.md` sagt „noch keine Features, keine Migration" — es gibt zwei Migrationen und 13 Tests. `AGENTS.md` Projekt-Absatz sagt „keine Features gebaut" (stimmt) und `TASKS.md` Phase-1-Kopf sagt „von Marco noch nicht beschlossen" (überholt seit DECISIONS 16.09.) | 🟢 kosmetisch | Beim nächsten Doku-Commit additiv korrigieren (README-Zeile ergänzen, TASKS-Kopf als „bestätigt 16.09." markieren) |
| **B2** | `supabase/config.toml` `minimum_password_length = 6`, Plan verlangt ≥ 12 (RISKS Nr. 9, E4.1) | 🟡 | In E2.1 auf 12 setzen, `password_requirements` prüfen; Test in E2.3/E4.2 |
| **B3** | `bookings.customer_email NOT NULL` + Allergie-/Shuttle-/Stripe-Spalten sind Online-Erbe. Für den Strand sind E-Mail (F8), Shuttle, Allergie und Stripe-Intent vermutlich optional oder irrelevant — bleiben aber, weil die Funktion sie befüllt | 🟡 | Nicht löschen (Hard Rule 1/4). In 0005 nur `customer_email` lockern, wenn F8 „optional" ergibt. Übrige Spalten mit `null`/`false` befüllen |
| **B4** | `tests/reserve-function-unchanged.test.ts` vergleicht die **ganze** Funktion mit der Handover-Datei. Sobald 0005 (Option A) die Signatur/INSERT erweitert, schlägt dieser Test **absichtlich** fehl. Bei Option B bleibt er grün, die neue Funktion braucht aber einen eigenen Identitätstest für den UPDATE-Block | 🟡 | Vor E5.1 entscheiden (Teil von F12): Test in E5.1 additiv um „UPDATE-Block byteidentisch" erweitern; die Prüfung der Handover-Funktion selbst kann bei Option A nur noch gegen Migration 0002 (Datei), nicht mehr gegen die DB laufen |
| **B5** | Kein GitHub-Remote (M6): 10 Commits existieren nur auf einem Rechner; RISKS Nr. 20 (Kontext-Verlust) deckt das nicht ab | 🟡 | M6 zeitnah; bis dahin ist die lokale `.git` der einzige Stand |
| **B6** | `supabase/config.toml` verweist auf `./seed.sql`, die Datei fehlt. Harmlos heute, aber E2.1 plant einen Seed-Admin — die Datei würde bei jedem `db reset` laufen, also nur lokale Testdaten dort | 🟢 | In E2.1 bewusst entscheiden: `seed.sql` (läuft bei jedem Reset) vs. separates Skript |
| **B7** | RLS ist auf `tour_departures` und `bookings` aus. Solange nur `service_role` Zugriff hat, ist das korrekt; sobald E2 `authenticated` einführt, müssen Policies **vor** der ersten UI kommen (deny-by-default, Recherche 2 §2) | 🟡 | Teil von E2.1, nicht E3 |
| **B8** | Supabase CLI 2.108.0, verfügbar 2.117.0. Kein Handlungsdruck, aber `config.toml`-Schema kann sich ändern | 🟢 | Beim nächsten `supabase start`-Problem prüfen, nicht vorab updaten |
| **B9** | Recherche 2 §4 schlägt vor, die 10+1-/Provisionsregel zusätzlich **in der DB-Funktion zu spiegeln**. Das würde die Reserve-Funktion um Geschäftslogik erweitern und Hard Rule 4 berühren | 🟡 | Empfehlung dieser Diagnose: Regel als reine TS-Funktion + Server Action; die DB-Funktion bekommt nur fertige Beträge/Snapshots als Parameter (E5.1). Berechnung **außerhalb** des atomaren UPDATE |

---

## 7. Verifikation dieser Diagnose

Am 17.09.2026 ausgeführt, nur lesend:

```
git log --oneline               → 10 Commits, HEAD ae3a8d0, Working Tree sauber
docker ps (mmb-promoter)        → 12 Container healthy (db, auth, kong, studio, rest, realtime, storage, mailpit, …)
supabase status                 → API 45321, DB 45322, Studio 45323, Mailpit 45324
psql schema_migrations          → 0001 inventory_core, 0002 reserve_function_handover
psql public                     → Tabellen tour_departures, bookings; Funktionen reserve_/release_departure_seats;
                                  Enums booking_channel, booking_status, payment_type; 0 Zeilen; RLS aus; auth.users 0
npx vitest run                  → Test Files 3 passed (3), Tests 13 passed (13), 1.01 s
npx tsc --noEmit                → sauber
ls .env.local / git remote -v   → beides fehlt
ls node_modules/@supabase       → fehlt
```

Nichts wurde gebaut, keine Datei außer dieser Diagnose und dem CHANGELOG-Eintrag geändert.
