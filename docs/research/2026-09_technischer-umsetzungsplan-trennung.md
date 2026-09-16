# Saubere Trennung von MyMallorcaExperience in zwei eigenständige Projekte — Technischer Umsetzungsplan (Stand September 2026)

## TL;DR
- **Baue das Promoter-Projekt als frisches, sauberes Schema neu** (nur was Vertrieb braucht) und **kopiere die bewährte `reserve_departure_seats()`-Funktion als DDL** in eine neue Migration der zweiten DB — Postgres hat keine Cross-DB-Queries, jede DB nutzt die Logik autark. In MyMallorcaBoats die Promoter-Spalten/Enums per neuer Migration **droppen** (0 Buchungen = idealer Zeitpunkt, kein Datenrisiko).
- **Zwei separate Repos (Polyrepo)** ist bei vollständiger Trennung korrekt; betreibe die zwei lokalen Supabase-Instanzen mit **unterschiedlichen Ports** (54321ff. vs. 55321ff.) und **eigenem `jwt_secret`**; Next.js-Devserver auf 3000 bzw. 3001.
- Verifiziere den Schnitt ohne CI über **pg_dump-Schema-Diff (vorher/nachher)**, **Vitest für Unit-Logik + Playwright-Smoke** für den Buchungs-Flow, und überführe die 7 Handskripte in `npm test`.

## Key Findings

1. **Schema-Trennung:** Bei 0 Buchungen ist ein sauberer Schnitt möglich. Promoter-Spalten/Enums in MyMallorcaBoats droppen. Postgres kann Enum-Werte grundsätzlich nicht entfernen (offizielle PG-Doku: „Existing values cannot be removed from an enum type … short of dropping and re-creating the enum type") — daher Rename-und-Recreate-Muster oder Enum→text+CHECK. Bei leerer DB ist der einfachste Weg, die betroffenen Objekte sauber neu zu definieren.
2. **Promoter-Code:** ~400 Zeilen → **neu bauen** mit den Erkenntnissen, nicht kopieren. Bei so wenig, tief verwobenem Code überwiegt der Nutzen eines sauberen Neustarts.
3. **Zweites Projekt:** `create-next-app@latest` (Next.js 16, Node ≥ 20.9), eigene Supabase-CLI-Instanz mit eigenen Ports, eigene Migrations 0001…
4. **Manuelle Kontingent-Logik:** Betreiber trägt Kontingente pro Termin ein; Promoter verkaufen atomar innerhalb des Kontingents via `reserve_departure_seats()`-Prinzip in der eigenen DB.
5. **Verifikation ohne CI:** pg_dump-Diff, Vitest+Playwright, Runner für die 7 Skripte.
6. **Zwei Claude-Code-Instanzen:** getrennte Ordner, getrennte Docs, klare Übergabepunkte (git worktrees hier NICHT nötig — es sind zwei echte Repos).
7. **Doku-System:** ~10 Schichten von .md-Dateien.
8. **Umbenennung:** sichere Reihenfolge, GitHub-Redirect als Sicherheitsnetz.
9. **10 Verbesserungen.**
10. **15 Risiken mit Absicherung.**

## Details

### 1. Trennungs-Strategie bei tief verwobenem Schema

**Grundlage:** Das Promoter-System lebt zu ~85% als Spalten/Enums/Constraints innerhalb der Boots-Tabellen. Das ist ein klassischer Fall des **Strangler-Fig / Bounded-Context-Extraction**-Problems — mit dem entscheidenden Vorteil, dass die Datenbank **leer** ist (0 Buchungen). Damit entfällt die schwierigste Phase (Dual-Write / CDC / Datenmigration) komplett. Der Microsoft-Azure- und AWS-Leitfaden zum Strangler-Fig-Muster betont übereinstimmend, dass der härteste Teil immer die geteilte Datenbank ist; da hier bewusst **keine geteilte DB** entsteht und keine Daten existieren, ist der Schnitt risikoarm.

**(a) MyMallorcaBoats — Promoter-Spalten/Enums entfernen (droppen), nicht inaktiv lassen.**

Empfehlung: **Droppen.** Begründung:
- Bei 0 Buchungen gibt es keinen Datenverlust und keine Rückwärtskompatibilität, die gewahrt werden müsste.
- „Inaktiv drin lassen" erzeugt dauerhafte Schema-Verwirrung: künftige Claude-Code-Sessions und Menschen sehen `promoter_id`, `capacity_promoter_quota` etc. und müssen jedes Mal neu verstehen, dass diese tot sind. Das ist eine permanente kognitive Last und eine Einladung zu Bugs (RLS-Policies, die auf tote Spalten verweisen; Enum-Werte, die versehentlich genutzt werden).
- Tote Enum-Werte sind besonders tückisch: Postgres unterstützt **kein** `ALTER TYPE … DROP VALUE` (offizielle Doku, gilt durchgängig bis heute). Ein toter Wert wie `user_role.promoter` bleibt sonst für immer wählbar.

**Konkrete Migration (0004) für MyMallorcaBoats:**
- Spalten droppen: `bookings.promoter_id`, `tour_departures.capacity_promoter_quota`, `tour_departures.seats_booked_promoter`, `tours.default_promoter_quota`, `tours.deposit_amount_cents`, `profiles.promoter_active`.
- Enum-Werte entfernen: Da `ALTER TYPE … DROP VALUE` nicht existiert, das dokumentierte Rename-Recreate-Muster nutzen:
  ```sql
  -- Beispiel user_role: promoter-Wert entfernen
  ALTER TYPE user_role RENAME TO user_role_old;
  CREATE TYPE user_role AS ENUM ('admin','customer'); -- ohne 'promoter'
  ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::text::user_role;
  DROP TYPE user_role_old;
  ```
  Dasselbe für `booking_channel` (ohne `promoter`) und `payment_type` (ohne `deposit`). Wichtig: `ALTER TABLE … TYPE` nimmt einen `ACCESS EXCLUSIVE`-Lock und macht einen Full-Table-Scan — bei leerer DB irrelevant, in Produktion mit Daten wäre es teuer.
- Views/Funktionen, die auf den Enums hängen, müssen vorher gedroppt und danach neu erstellt werden (Postgres blockiert Typänderungen bei View-Abhängigkeit).
- Risiko beim Droppen: Wenn `reserve_departure_seats()` intern auf `capacity_promoter_quota`/`seats_booked_promoter` referenziert, bricht die Funktion. **Daher zuerst** eine bereinigte Version der Funktion deployen (nur Online-Kanal), **dann** die Spalten droppen. Reihenfolge: (1) Funktion refactoren, (2) Spalten/Enums droppen, (3) RLS-Policies prüfen.

**(b) Promoter-Projekt — frisches, sauberes Schema bauen, NICHT kopieren.**

Empfehlung: **Frisch bauen**, nur die bewährte Reservierungs-Logik als DDL übernehmen. Begründung:
- Das kopierte Schema würde Ballast aus dem Boots-Kontext mitschleppen (10-Sprachen-Rechtstexte, öffentliche Tour-Sichtbarkeit etc.), den der Promoter-Vertrieb nicht braucht.
- Ein frisches Schema kann von Anfang an um den echten Bounded Context modelliert werden: Kontingente, Promoter-Accounts, Promoter-Verkäufe, Provisionen.
- **Die eine Ausnahme:** die getestete `reserve_departure_seats()`-Funktion. Diese wird als DDL übernommen (siehe Punkt 4), da sie das einzige wirklich bewährte, hart getestete Asset ist.

**Best Practice „column/enum extraction":** Die sauberste Extraktion aus Postgres-Tabellen ist bei leerer DB, das Zielschema **deklarativ neu zu schreiben** statt inkrementell zu migrieren. Supabase unterstützt declarative schemas (`supabase/schemas/`) mit `supabase db diff` (Engine pg-delta) zur Migrations-Generierung. Für die Ziel-DB gilt: eigene `0001_initial.sql`, die nur die Vertriebs-Domäne enthält.

### 2. Kopieren vs. Neu bauen des Promoter-Codes

**Entscheidung: Neu bauen.** Bei ~400 Zeilen (Login-Weiche, /promoter-Portal-Ansätze, admin/promoter-Accountverwaltung, promoter/data) ist der Kopier-und-Anpass-Aufwand nicht kleiner als sauberes Neuschreiben, aber technisch schuldenbehaftet.

**Entscheidungskriterien (allgemein anwendbar):**
- **Menge:** <500 Zeilen → neu bauen ist meist schneller als Verstehen+Anpassen fremden, verwobenen Codes.
- **Kopplung:** Der Code hängt an den Boots-Tabellen/Enums, die es im neuen Projekt gar nicht gibt. Jede kopierte Zeile müsste ohnehin umgeschrieben werden.
- **Qualität/Reife:** Der Code ist erklärtermaßen nicht sauber gekapselt. Kopieren würde die schlechte Kapselung mitnehmen.
- **Wert des Bestehenden:** Der einzige hohe Wert liegt in der DB-Funktion und in den **Erkenntnissen** (z.B. wie die Login-Weiche funktioniert), nicht im Code selbst.

**Was übernommen wird:** (1) die `reserve_departure_seats()`-DDL, (2) das mentale Modell der Rollen/Kanäle als Referenz in der DIAGNOSE.md, (3) etablierte Muster (RLS deny-by-default, unveränderliches Audit-Log).

### 3. Zweites Projekt aufsetzen (Next.js 16 + Supabase, eigenständig, lokal)

**Voraussetzung:** Node.js ≥ 20.9.0 und TypeScript ≥ 5.1.0 sind die offiziellen Mindestversionen von Next.js 16 (GA am 21. Oktober 2025); Docker Desktop laufend, Supabase CLI installiert.

**Schritt 1 — Next.js 16 scaffolden.** `create-next-app` bietet in Next.js 16 zuerst die Auswahl „recommended Next.js defaults" (TypeScript, ESLint, Tailwind CSS, App Router, AGENTS.md). Bei „customize" fragt es zusätzlich nach Linter (ESLint / Biome / None — Biome ist neu), React Compiler (neu), `src/`-Verzeichnis, Import-Alias und AGENTS.md-Einbindung. In Next.js 16 sind TypeScript, Tailwind CSS, ESLint, App Router und **Turbopack** default, Import-Alias `@/*`, plus mitgelieferte `AGENTS.md` (mit `CLAUDE.md`, die darauf verweist). Turbopack ist ab Next.js 16 laut offiziellem Blog „the default bundler for all new Next.js projects" für **dev UND build**. Non-interaktives, reproduzierbares Kommando für den Agenten:
```
npx create-next-app@latest mymallorcaboats-promoter --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```
Es gibt eine `--agents-md`-Flag (default), die AGENTS.md und CLAUDE.md einbindet, um Coding-Agenten zu aktuellem Next.js-Code anzuleiten. Zum Deaktivieren von Turbopack existiert `--webpack` bzw. `next dev --webpack`.

**Schritt 2 — Ordnerstruktur (Beispiel):**
```
mymallorcaboats-promoter/
  src/app/
    (public)/login/
    admin/            # Dashboard des Netzwerk-Betreibers (Gabo)
      contingents/    # manuelle Kontingent-Verwaltung
      accounts/       # Promoter-Accountverwaltung
      events/         # interne Events
    promoter/         # Promoter-Portal (Verkauf)
  src/lib/supabase/   # server + browser client (@supabase/ssr)
  supabase/
    config.toml
    migrations/0001_initial.sql
    schemas/          # optional declarative
  docs/               # siehe Punkt 7
  AGENTS.md / CLAUDE.md
```

**Schritt 3 — Supabase lokal, parallel zur ersten Instanz (Port-Konflikte vermeiden).** Supabase belegt lokal standardmäßig (offizielle Doku): API/Kong **54321**, Postgres **54322**, Studio **54323**, Inbucket **54324**. Jede lokale Instanz = eigener Docker-Stack. Für das zweite Projekt in `supabase/config.toml` alle Ports und die `project_id` verschieben:
```toml
project_id = "mmb-promoter"
[api]
port = 55321
[db]
port = 55322
shadow_port = 55320
[db.pooler]
port = 55329
[studio]
port = 55323
[inbucket]
port = 55324
[analytics]
port = 55327
```
Start/Stop pro Verzeichnis oder via `--workdir`:
```
supabase start --workdir /pfad/promoter
supabase status --workdir /pfad/promoter
supabase stop --workdir /pfad/promoter
```
**Wichtige Falle:** Wenn das zweite Projekt aus dem ersten geklont wurde, teilen beide Stacks dasselbe `jwt_secret` → identische anon/service_role-Keys. Neues Secret erzeugen (`openssl rand -base64 64`) und in `config.toml` unter `[auth] jwt_secret` setzen, dann `supabase stop && supabase start`. Für saubere Trennung sollten außerdem beide `db.major_version` übereinstimmen. Hinweis: Auf Windows/macOS können System-Dienste (z.B. lokales Postgres auf 5432, AirPlay auf 5000) mit den Supabase-Ports kollidieren — vorab prüfen.

**Schritt 4 — Next.js-Devserver-Port trennen.** Next.js 16 nutzt weiter Port 3000 als Default; `.env.local` reicht dafür nicht (der Server startet, bevor die Datei geladen wird). Stattdessen im `package.json` des Promoter-Projekts: `"dev": "next dev -p 3001"`. Env-Handling: pro Projekt eigene `.env.local` mit den zur jeweiligen Supabase-Instanz gehörenden `NEXT_PUBLIC_SUPABASE_URL` (http://localhost:55321) und Keys; `service_role`-Key nur serverseitig, nie im Client-Bundle.

**Schritt 5 — Auth & Admin-Dashboard.** Supabase Auth mit `@supabase/ssr`, RLS deny-by-default auf allen Tabellen (nach `ENABLE ROW LEVEL SECURITY` ist alles gesperrt, bis Policies existieren — bewusst so). Zwei Rollen: `network_operator` (Gabo) und `promoter`. Login-Weiche routet nach Rolle.

### 4. Die „manuelle Kontingent"-Logik im Promoter-Projekt

**Fachliches Modell (nur eigene DB, keine Echtzeit-Kopplung zur Boots-DB):**

Tabellen (Vorschlag):
- `events` (bzw. `promoter_departures`): pro Termin/Tour/Event ein Datensatz. Felder u.a. `id`, `event_date`, `title`, `is_internal boolean` (interne Events nie öffentlich), `total_quota int` (das von Gabo manuell eingetragene Kontingent, z.B. 30), `seats_booked int default 0`.
- `promoter_sales`: `id`, `event_id`, `promoter_id`, `pax int`, `free_pax int`, `commission_cents int`, `deposit_cents int`, `created_at`.
- `promoters`: Accountdaten.

**Kontingent-Eintrag (Gabo):** Im Admin-Dashboard trägt der Betreiber `total_quota` pro Event manuell ein („30 Plätze für Samstag"). Bewusst **keine** DB-übergreifende atomare Reservierung — der Mensch ist die Schnittstelle. Das ist ein akzeptabler, dokumentierter Trade-off (siehe DECISIONS/ADR).

**Verkauf durch Promoter (atomar, kein Überbuchen INNERHALB des Kontingents):** Genau hier wird die bewährte Logik wiederverwendet. Postgres hat **keine** Cross-Database-Queries (jede DB ist isoliert; ein Bridging bräuchte `dblink`/`postgres_fdw` — die Crunchy-Data-Doku bestätigt: „The default implementation doesn't support cross-database queries, even on the same Postgres server"). Daher wird die Funktion **nicht geteilt**, sondern ihre DDL in eine Migration der Promoter-DB kopiert. Extraktion aus der Quelle:
```sql
SELECT pg_get_functiondef('reserve_departure_seats'::regproc);
```
oder `pg_dump --schema-only`. Die zurückgegebene `CREATE OR REPLACE FUNCTION …` als neue Migration im Promoter-Projekt einspielen und auf die Promoter-Tabellen anpassen (`events.total_quota` statt `capacity_promoter_quota`). Die `SELECT … FOR UPDATE`-Logik (Two-Phase-Locking, das etablierte Muster gegen Doppelbuchung) verhält sich identisch, weil sie in sich geschlossen innerhalb einer Transaktion/DB läuft — das getestete „niemals überbuchen"-Verhalten bleibt erhalten, jetzt bezogen auf das Promoter-Kontingent.

**Geschäftsregeln (bereits geklärt) sauber verankern:**
- **10 € Provision/Ticket:** `commission_cents = paid_pax * 1000`.
- **30 € Anzahlung/Person:** `deposit_cents = pax * 3000`.
- **10+1-Gruppenregel:** ab 11 Personen ist 1 gratis, Provision nur für 10. Sauber als reine Funktion (nach der geklärten Definition: ab 11 → 1 gratis), `paid_pax = pax - free_pax`. Diese Rechenregel als **testbare, reine TypeScript-Funktion** implementieren (Vitest-Unit-Tests mit Grenzfällen 10, 11, 21, 22) UND serverseitig in der DB-Funktion spiegeln, damit sie nicht umgehbar ist.
- **Interne Events:** `is_internal = true` → RLS-Policy schließt sie aus allen öffentlichen Selects aus; nur `network_operator`/zugewiesene Promoter sehen sie.

### 5. Saubere Verifikation des Schnitts ohne CI

**a) DB-Schema-Diff (pg_dump vorher/nachher) — das wichtigste Sicherheitsnetz.**
Vor dem Schnitt in MyMallorcaBoats einen normalisierten Schema-Dump erzeugen, nach jedem Schritt erneut, und gezielt diffen:
```
pg_dump --schema-only --no-owner --no-privileges "$DB_URL" > before.sql
# ... Migration 0004 anwenden ...
pg_dump --schema-only --no-owner --no-privileges "$DB_URL" > after.sql
diff -u before.sql after.sql
```
So werden destruktive Operationen sichtbar: gedroppte Spalte, verengter Typ, verschwundene Tabelle. Der erwartete Diff sind **nur** die Promoter-Objekte — alles andere muss identisch bleiben. (Tipp aus der Praxis: pg_dump-Ausgabe vorher normalisieren, um Ordnungs-Rauschen zu reduzieren.) Supabase liefert zusätzlich `supabase db diff` zur Migrations-Generierung; Caveat: DML wird nicht getrackt, RLS-Policy-Renames und manche View-Eigenschaften diffen nicht sauber — daher Output stets als Entwurf reviewen.

**b) Vitest als Testrunner einführen (geringer Aufwand).**
Installation: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom`. Minimal-Config (`vitest.config.ts`) mit `environment: 'jsdom'`, Alias `@`→`src`. Aufwand: wenige Stunden bis zur ersten grünen Suite (ein realer 2026er Erfahrungsbericht kam auf „27 passing tests" in einer Next.js-16-App). Vitest ist Jest-kompatibel, aber deutlich schneller und out-of-the-box TypeScript-fähig. Priorität: reine Logik testen — vor allem die 10+1-Gruppenregel, Provisions-/Anzahlungsberechnung, und (im Boots-Projekt) alles, was `reserve_departure_seats()` aufruft. `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

**c) Playwright-Smoke für den kritischen Buchungs-Flow.**
Faustregel: E2E-Tests für jeden umsatzkritischen Pfad (Login, Buchung, Zahlung) — „If a flow breaking would wake someone up at 2 AM, it needs an E2E test." Für den Solo-Dev genügt eine kleine Smoke-Suite (2-3 kritische Journeys): öffentliche Buchung Ende-zu-Ende, Admin-Login, Promoter-Verkauf. Playwright wartet automatisch auf Elemente (weniger Flakiness); rollenbasierte Selektoren statt CSS-Klassen nutzen. Programmatisch einloggen (Auth-State speichern) statt jedes Mal durch die UI.

**d) Die 7 Handskripte in einen Runner überführen.**
Jedes der 7 Skripte als `*.test.ts` unter Vitest kapseln bzw. als npm-Scripts bündeln (`"test:all"`). Besonders der 8-parallele-Requests-Überbuchungstest sollte als reproduzierbarer Test bestehen bleiben — er ist der wichtigste Regressionsschutz für beide Projekte.

**e) Empfohlener minimaler CI/Test-Ansatz für Solo-Dev mit KI-Agent.**
- Lokal: `npm test` (Vitest) + `npm run test:e2e:smoke` (Playwright) als Pre-Commit-Ritual.
- Optional leichtgewichtige GitHub Actions: `on: [push, pull_request]`, `actions/setup-node`, `npm ci`, `npm test`. Ein einzelner Workflow pro Repo genügt. Das schließt die größte Lücke (keine Regressionserkennung) mit minimalem Aufwand.
- Build-Kontrolle: `next build` vor/nach dem Schnitt; wenn der öffentliche Buchungs-Teil unangetastet blieb, sollte der Build ohne neue Fehler durchlaufen (grobe, aber schnelle Kontrolle).

### 6. Parallel-Arbeit mit zwei Claude-Code-Instanzen

**Grundprinzip:** Zwei **getrennte Ordner**, zwei Terminals (PowerShell), zwei Claude-Code-Sessions, zwei Repos. Da die Projekte vollständig getrennt sind (Polyrepo), sind **git worktrees hier NICHT nötig** — worktrees lösen das Problem paralleler Branches im *selben* Repo. Bei zwei echten Repos ist die simple Zwei-Ordner-Struktur korrekt und sauberer.

**Best Practices gegen Chaos:**
- **Terminal-Tabs klar benennen** (z.B. „BOATS" / „PROMOTER"); Windows Terminal erlaubt Tab-Namen. Verhindert Verwechslung, welche Session welches Projekt bearbeitet.
- **Getrennte Docs pro Projekt** (AGENTS.md/CLAUDE.md je Repo, siehe Punkt 7). Jede Instanz liest nur ihren eigenen Kontext.
- **Kein geteilter State:** Getrennte DBs (verschiedene Ports), getrennte `.env.local`, getrennte Dev-Ports (3000/3001). Zwei Sessions dürfen nie dieselbe DB migrieren (allgemein bekannte Falle: „If two sessions are both running migrations against the same local database, you'll have problems").
- **Klare Übergabepunkte:** Der harte Abhängigkeitspunkt ist die `reserve_departure_seats()`-DDL. Reihenfolge: **zuerst** im Boots-Projekt die Funktion bereinigen und die finale DDL „einfrieren", **dann** diese DDL an das Promoter-Projekt übergeben. Bis dahin arbeitet die Promoter-Instanz an Scaffold/Auth/UI, die nicht von der Funktion abhängen.
- **Scratchpad/Progress-Datei pro Projekt** (Anthropics „Scratchpad Pattern"): laufender Task-State in einer `PROGRESS.md`, die nach jeder Teilaufgabe aktualisiert wird und Kompaktierung überlebt. Auch fehlgeschlagene Ansätze festhalten („Tried X, failed because Y"), damit spätere Sessions keine Sackgassen wiederholen. Anthropics eigene Empfehlung für lange Läufe: „commit after each feature, update progress files, and restart sessions rather than running indefinitely."
- **Checkpoints nutzen:** Claude Code snapshotet vor jeder Änderung; `/rewind` stellt Zustände wieder her. Kleine, häufige Commits als zusätzliches Netz.

### 7. Dokumentations-System für beide Projekte (~10 Schichten)

Pro Projekt (getrennt, aber konsistent strukturiert) ein mehrschichtiges Doku-/Regel-System. Prinzip aus der Praxis: **CLAUDE.md/AGENTS.md kurz halten** (Regeln in wenigen Zeilen + Verweise), Tiefe in dedizierte Dateien auslagern — „if a pattern needs more than a few lines, it goes in the skill and CLAUDE.md gets a link."

1. **AGENTS.md** — Stack, Build/Test-Kommandos, Code-Style, Architektur-Grenzen, Boundaries. Nativ von 30+ Tools (Claude Code, Copilot, Cursor, Codex) gelesen. Kurz, präzise, nicht LLM-generiert-aufgebläht.
2. **CLAUDE.md** — Claude-spezifische Projektregeln; verweist auf AGENTS.md. Standing rules (z.B. „additiv arbeiten, nie überschreiben", „nach jeder Aufgabe dokumentieren"). Next.js 16 legt AGENTS.md + CLAUDE.md bereits beim Scaffold an — diese als Basis erweitern.
3. **MASTERPLAN.md** — Gesamtziel, Phasen, Meilensteine, Abhängigkeiten zwischen den zwei Projekten.
4. **TASKS.md / Schritt-für-Schritt-Aufgabenliste** — sequenzielle, abhakbare To-dos mit Akzeptanzkriterien pro Schritt.
5. **PROGRESS.md (Scratchpad)** — aktiver Task-State, laufend aktualisiert; fehlgeschlagene Ansätze; nächste Aktionen; Checkpoints.
6. **CHANGELOG.md** — additiv, was in welcher Session geändert wurde (Datum, Session, Diff-Zusammenfassung).
7. **DECISIONS/ (ADR)** — je Datei eine Entscheidung, sequenziell nummeriert (`0001-getrennte-datenbanken.md`), Status (Proposed/Accepted/Deprecated/Superseded), Kontext, Entscheidung, Konsequenzen. Living document: neue Erkenntnisse mit Datumsstempel ergänzen, alte nicht löschen (die „mutable ADR"-Praxis). Eine `README.md` als Index verlinkt alle ADRs.
8. **RISKS.md** — laufendes Risikoregister mit Absicherung/Status (siehe Punkt 10).
9. **DIAGNOSE.md** — der Ist-Zustand/das Erbe (die Voll-Diagnose des Alt-Codes; im Promoter-Projekt: das übernommene mentale Modell, die Reservierungs-DDL-Herkunft).
10. **AGENT-RULES.md / `.claude/`** — operative Regeln & ggf. Slash-Commands/Subagent-Definitionen (z.B. „db-migrator"-Regeln, „vor Commit: npm test").

**Regeln verankern:**
- **„Nach jeder Aufgabe dokumentieren":** Als Zeile in CLAUDE.md UND als Akzeptanzkriterium jeder TASKS-Aufgabe („Definition of Done: PROGRESS.md + CHANGELOG.md aktualisiert").
- **„Nichts überschreiben, additiv arbeiten":** In CLAUDE.md als harte Regel; ADRs und CHANGELOG sind append-only. Für Code: kleine Commits, `git`-Historie als Netz.
- Testbarkeit der Doku: Behauptungen in Docs sollten im Code grepbar sein („grep before you trust" — falsche Beispiele erkennt man per `grep`).

### 8. Umbenennung MyMallorcaExperience → MyMallorcaBoats

**Risiken:** Referenzen in `package.json`/`package-lock.json` (`name`), Imports mit hardcodiertem Alias, git remote URL, Supabase-`project_id` in `config.toml`, hardcodierte Strings (Titel, Meta, E-Mail-Templates, 10-Sprachen-Texte), README-Badges, Deployment-Configs, evtl. Domain/OAuth-Callback-URLs. Am häufigsten brechen nicht Git selbst, sondern „forgotten integrations" (CI-Referenzen, Badges, Webhooks).

**Sichere Reihenfolge:**
1. **Git-Sicherheit zuerst:** sauberer Commit / Branch, damit jeder Schritt rückrollbar ist.
2. **GitHub-Repo umbenennen** (Web-UI). GitHub leitet die alte URL automatisch um (Redirect) — Clones/Pushes funktionieren weiter, aber das ist nur ein Netz, kein Freibrief (GitHub kann einen freigegebenen Namen später neu vergeben).
3. **Lokales Remote aktualisieren:** `git remote set-url origin https://github.com/<user>/MyMallorcaBoats.git`.
4. **Ordner umbenennen** (Projektverzeichnis).
5. **`package.json` `name` + `package-lock.json`** anpassen.
6. **Supabase `config.toml` `project_id`** anpassen (lokaler Bezeichner; betrifft Container-/Stack-Namen).
7. **Grep nach hardcodierten Strings:** `grep -ri "mymallorcaexperience"` case-insensitiv über den ganzen Baum; jede Fundstelle bewusst entscheiden (Marken-String vs. technische Referenz). Besonders die 10-Sprachen-Textdateien und Meta/Title-Tags.
8. **CI/Deployment/Badges/Env** aktualisieren; einen Smoke-Build (`next build`) fahren zur Roundtrip-Bestätigung.
9. Erst danach die inhaltliche Trennung starten (Umbenennung ist ein Vorbereitungsschritt, kein Parallelschritt).

### 9. Zehn weitere Verbesserungen/Optimierungen

1. **Provisions-/Anzahlungslogik als einzige Source of Truth** in einer reinen, getesteten Funktion (TS + DB gespiegelt), damit UI und DB nie auseinanderlaufen.
2. **Seed-Skripte mit `ON CONFLICT DO NOTHING`** für reproduzierbare `supabase db reset`-Läufe in beiden Projekten.
3. **TypeScript-Typen aus dem DB-Schema generieren** (`supabase gen types typescript`) in beiden Projekten — verhindert Drift zwischen DB und Code.
4. **Unveränderliches Audit-Log auch im Promoter-Projekt** (Muster aus Boots übernehmen) für Kontingent-Einträge und Verkäufe — wichtig, weil der Mensch (Gabo) die Kontingent-Schnittstelle ist.
5. **Idempotente Migrations + `supabase db reset` als Standard-Verifikation** („läuft die Migration sauber von Null?").
6. **Column-level Privileges** zusätzlich zu RLS für sensible Felder (z.B. `total_quota` nur durch `network_operator` änderbar) — RLS allein kann „diese Zeile ja, dieses Feld nein" nicht ausdrücken; erst `REVOKE`+gezieltes `GRANT` schließt die Lücke.
7. **Dependabot/Renovate + monatliche Next.js-Security-Releases beachten** (Next.js fährt seit 2026 einen festen, angekündigten Security-Release-Prozess mit Active LTS 16.x und Maintenance LTS 15.5.x) — beide Repos aktuell halten.
8. **`.env.example` + Port-Preflight-Check-Skript** pro Projekt, damit Port-Konflikte (EADDRINUSE / belegte 5432x) früh und klar erkannt werden.
9. **Ein gemeinsames, versioniertes „Regel-Template"** für die Doku-Struktur (Punkt 7), damit beide Projekte konsistent bleiben, ohne Code zu teilen.
10. **Backup-/Export-Routine** der Kontingent- und Verkaufsdaten (regelmäßiger `pg_dump`), da es bewusst keine technische Kopplung/Redundanz zwischen den DBs gibt.

### 10. Fünfzehn weitere Risiken (mit Absicherung)

1. **Geteiltes `jwt_secret` bei geklontem Supabase** → identische Keys, DB-übergreifende Token-Verwechslung. *Absicherung:* neues `jwt_secret` je Instanz (`openssl rand -base64 64`), verifizieren dass anon/service-Keys differieren.
2. **Port-Kollisionen** (54321ff. doppelt, oder System-Postgres auf 5432). *Absicherung:* zweite Instanz auf 5532x, Preflight-Port-Check, `supabase status` prüfen.
3. **`reserve_departure_seats()` bricht beim Spalten-Drop** (referenziert Promoter-Felder). *Absicherung:* Funktion zuerst refactoren/deployen, dann droppen; pg_dump-Diff kontrollieren.
4. **Tote Enum-Werte lassen sich nicht per DROP VALUE entfernen** → bleiben wählbar. *Absicherung:* Rename-Recreate-Muster oder Enum→text+CHECK.
5. **Falsche Doppelarbeit durch zwei Claude-Sessions** (beide ändern dieselbe Migration/DB). *Absicherung:* strikte Ordner-/DB-Trennung, benannte Tabs, PROGRESS.md pro Projekt, klare Übergabe der DDL.
6. **Menschliche Kontingent-Fehleingabe** (Gabo trägt 300 statt 30 ein → Überverkauf des Netzwerks). *Absicherung:* Plausibilitäts-Constraints/Warnungen im Admin-UI, Audit-Log, Bestätigungsdialog.
7. **Keine Echtzeit-Kopplung → Doppelverkauf zwischen Online- und Promoter-Kanal** an denselben realen Plätzen. *Absicherung:* Das ist bewusst akzeptiert (Mensch als Schnittstelle) — als ADR dokumentieren; Gabo muss Kontingente konservativ setzen; klare betriebliche Regel.
8. **RLS-Lücke im neuen Projekt** (Tabelle ohne Policy oder `USING (true)`). *Absicherung:* deny-by-default, Query `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;` als Check; Zwei-Account-Test.
9. **`service_role`-Key im Client-Bundle** (klassischer Supabase-Fehler; CVE-2025-48757-Muster). *Absicherung:* Key nur serverseitig, Grep im Bundle, RLS als zweite Verteidigungslinie.
10. **Migration läuft lokal, aber nicht auf Remote** (Diff-Tool-Artefakte, fehlende Grants). *Absicherung:* `supabase db reset` vor Commit; generierte Diffs manuell reviewen.
11. **Umbenennungs-Restschulden** (vergessene hardcodierte Strings in 10 Sprachdateien). *Absicherung:* case-insensitives Grep, Smoke-Build, manuelle Sichtprüfung der Meta/Legal-Texte.
12. **Kein CI → stille Regression** beim autonomen Agenten-Arbeiten über Stunden. *Absicherung:* Vitest+Playwright-Smoke als Pre-Commit, optional GitHub Actions, git-Checkpoints (`/rewind`).
13. **Kontext-/State-Drift in langen Claude-Sessions** (eine katastrophale Edit nach vielen guten). *Absicherung:* Claude-Code-Checkpoints, kleine Commits, PROGRESS.md, Sessions lieber neu starten statt endlos laufen lassen.
14. **Turbopack/Next.js-16-Build-Bruch bei Adapter/Hosting** (Provider-Adapter noch nicht 16-ready). *Absicherung:* Staging-Build zuerst, Provider-Release-Notes prüfen, ggf. `--webpack`-Fallback.
15. **Divergenz der bewährten Reservierungslogik** (zwei Kopien der Funktion driften auseinander). *Absicherung:* DDL-Herkunft in DIAGNOSE.md dokumentieren, bei Änderungen bewusst in beide Migrationen einpflegen, gemeinsamer Überbuchungstest in beiden Repos.

## Recommendations

**Priorisierte Schritt-für-Schritt-Reihenfolge (was zuerst, was parallel, welche Instanz):**

**Phase 0 — Vorbereitung (BOATS-Instanz, allein, zuerst):**
1. Doku-System (Punkt 7) im Boots-Projekt anlegen; DIAGNOSE.md aus der vorhandenen Voll-Diagnose füllen.
2. Vitest einführen, die 7 Handskripte + Überbuchungstest als Tests kapseln → grüne Baseline.
3. `before.sql` (pg_dump schema-only) als Referenz einfrieren.
4. Umbenennung MyMallorcaExperience → MyMallorcaBoats (Punkt 8) komplett durchziehen und per Smoke-Build verifizieren.

**Phase 1 — Schnitt im Boots-Projekt (BOATS-Instanz):**
5. `reserve_departure_seats()` auf reinen Online-Kanal refactoren, Tests grün halten.
6. **Finale DDL der Funktion „einfrieren"** (`pg_get_functiondef`) → Übergabe-Artefakt für das Promoter-Projekt.
7. Migration 0004: Promoter-Spalten/Enums droppen (Rename-Recreate für Enums).
8. `after.sql` diffen: nur Promoter-Objekte dürfen fehlen; alles andere identisch. Playwright-Smoke des Buchungs-Flows grün.

**Phase 2 — Promoter-Projekt aufbauen (PROMOTER-Instanz, kann ab Schritt 6 parallel starten):**
9. `create-next-app@latest` (Punkt 3), zweite Supabase-Instanz auf 5532x mit eigenem `jwt_secret`, Dev-Port 3001.
10. Doku-System im Promoter-Projekt spiegeln; ADR „getrennte DBs / manuelle Kontingente / kein Echtzeit-Sync".
11. Eigenes `0001_initial.sql`: Vertriebs-Schema (events, promoter_sales, promoters), RLS deny-by-default, Audit-Log.
12. Die eingefrorene Reservierungs-DDL als Migration einspielen und auf Promoter-Tabellen anpassen (Punkt 4).
13. Auth + Login-Weiche, Admin-Dashboard (Kontingent-Verwaltung), Promoter-Portal (Verkauf).
14. Geschäftsregeln (10 €, 30 €, 10+1, interne Events) als getestete reine Funktion + DB-Spiegelung; Vitest-Grenzfälle.
15. Playwright-Smoke: Betreiber-Login → Kontingent eintragen → Promoter-Verkauf → kein Überbuchen.

**Was parallel:** Ab Schritt 6 kann die PROMOTER-Instanz Scaffold/Auth/UI (Schritte 9-11, 13) bauen, während die BOATS-Instanz den Schnitt (7-8) beendet. Der einzige harte Sync-Punkt ist die Funktions-DDL (Schritt 6 → 12).

**Benchmarks/Schwellen, die die Empfehlung ändern:**
- Sobald **>0 echte Buchungen** in der Boots-DB liegen, ist der „einfach droppen"-Weg riskanter → dann Backup + Dual-Read-Übergang statt Hard-Cut.
- Falls die Geschäftsregeln (10+1, Provision) sich noch ändern könnten, die Logik ausschließlich in **einer** getesteten Funktion halten und nirgends duplizieren.
- Wenn später doch eine technische Kopplung gewünscht wird, wäre `postgres_fdw` der Weg — aber das widerspricht der aktuellen bewussten Architektur-Entscheidung und sollte einen neuen ADR erfordern.

## Caveats
- **Marketing vs. belegbare Realität:** Next.js-16-Performancezahlen stammen aus **Vercels eigenen Benchmarks**, nicht aus unabhängigen Tests — als Herstellerangaben behandeln. Konkret verifizierbar: Vercels eigene Dashboard-App fiel im Dev-Server-Speicher von 21,5 GB auf 2 GB nach dem Kompilieren von 50 Routen, nextjs.org von ~4.600 MB auf 840 MB (offizieller 16.3-Blog; „bis zu 90% weniger RAM"). Die kursierende Zahl „22% mehr Requests unter Last" ließ sich nicht eindeutig gegen eine benannte Quelle absichern — vorsichtig behandeln bzw. nicht als Fakt weitergeben. Next.js 16.3 lief zeitweise als `@preview`-Release (Ende Juni 2026), während stabil noch 16.2 war; für Produktion die stabile `@latest`-Linie nutzen.
- Die genaue interne Implementierung von `reserve_departure_seats()` (welche Promoter-Spalten sie referenziert) liegt nicht im Wortlaut vor; die Refactoring-Reihenfolge in Phase 1 ist entsprechend defensiv gewählt. Vor dem Drop unbedingt den Funktionskörper prüfen (`SELECT pg_get_functiondef(...)`).
- Supabase `db diff` erfasst **kein DML** und manche RLS/View-Details unsauber — generierte Migrationen immer manuell reviewen.
- Enum-Änderungen mit `ALTER TABLE … TYPE` nehmen einen `ACCESS EXCLUSIVE`-Lock; bei leerer DB unkritisch, bei späteren Produktivdaten teuer.
- Die create-next-app-Prompts/Flags können sich zwischen Next.js-16-Minorversionen leicht ändern (z.B. neue Biome-/React-Compiler-Prompts); das non-interaktive Kommando mit expliziten Flags ist robuster als das Verlassen auf Defaults.