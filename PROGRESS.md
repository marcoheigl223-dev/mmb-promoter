# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 02.10.2026: Etappe 5 von Marco freigegeben (vier Entscheidungen in `docs/DECISIONS.md`). E5.1 (Datenmodell, Migration `0006_promoter_sales_model.sql`) GEBAUT und VERIFIZIERT — UNCOMMITTET, wartet auf Marcos Sichtung. Stopp vor E5.2.** Einzige Datei, die überschrieben werden darf. Erledigte Schritte stehen in `docs/CHANGELOG.md`.

## Wo wir stehen

- E1–E3.4 committet; `HEAD = 8b6d723`. **Nicht gepusht** — `origin/main` steht auf `7491cd5` (E3). Push nur auf Marcos Wort.
- Arbeitsbaum (10 Pfade, alle uncommittet):
  - neu: `docs/ETAPPE5_PLAN.md` (Plan 30.09.), `supabase/migrations/0006_promoter_sales_model.sql`, `tests/bookings-rls.test.ts`
  - geändert: `docs/DECISIONS.md`, `docs/RISKS.md`, `docs/CHANGELOG.md`, `TASKS.md`, `PROGRESS.md`, `tests/events-rules-rls.test.ts`, `tests/profiles-rls.test.ts`
- Migration 0006 ist lokal **eingespielt** (per `docker exec … psql`, Historie-Zeile `0006` in `supabase_migrations.schema_migrations`). DB nach dem Testlauf sauber (0 bookings, 0 Audit, 0 Nachrichten).

## Vorgeschlagene Commit-Aufteilung (ein Schritt = ein Commit, gezielt per Pfad)

1. `docs: Plan Etappe 5 (30.09.) + vier E5-Entscheidungen Marco (02.10.)` — `docs/ETAPPE5_PLAN.md`, `docs/DECISIONS.md`
2. `E5.1a: Migration 0006 promoter_sales_model` — `supabase/migrations/0006_promoter_sales_model.sql`
3. `E5.1b: Tests bookings-rls (23) + Erwartungslisten angepasst` — `tests/bookings-rls.test.ts`, `tests/events-rules-rls.test.ts`, `tests/profiles-rls.test.ts`
4. `docs: E5.1 protokolliert` — `docs/CHANGELOG.md`, `docs/RISKS.md`, `TASKS.md`, `PROGRESS.md`

Hinweis: CHANGELOG/RISKS/TASKS enthalten auch noch die uncommitteten Plan-Einträge vom 30.09. — sie wandern mit Commit 4 (oder Marco will sie in Commit 1; dann Pfade entsprechend aufteilen).

## Offen für Marco (blockiert die nächsten Schritte)

| Frage | blockiert | Vorschlag Claude |
|---|---|---|
| **F11** Anzahlung bei 10+1 für 10 oder 11 Personen? | E5.2 (Migration 0007) | Gabo-Option als Daten |
| **F16** „Gesamtbetrag" als Anzahlung: Gabo-Vorgabe pro Event oder freie Eingabe am Strand? Kappen? | E5.2 | Gabo-Vorgabe, kappen auf Gesamtpreis |
| **F18** 10+1 bei 22 Personen: 2 gratis oder 1? | E5.2 | pro vollem Block |
| **F23** Zahlungsstatus „noch nichts kassiert" nötig? | E5.3 (Funktionen) | nein — kein Verkauf ohne Geld |
| **F22** Bar-Anzahlung → `confirmed` oder `pending`? | E5.3 | `confirmed` |
| **F8** Kunden-E-Mail am Strand Pflicht? (`customer_email NOT NULL` steht noch) | E5.5 (Verkaufs-Flow) | optional |
| F15 Ticketpreis-Betrag | nur erster echter Verkauf | Gabo trägt unter `/admin/regeln` ein |

Entschieden am 02.10.2026 (DECISIONS): Zahlart frei pro Verkauf (F17 = nein), Zahlungsstatus manuell + Audit, alle freigegebenen Events sichtbar, Storno nur Gabo (Teil von E5).

## Nächster Schritt nach Marcos OK

E5.2 — Migration `0007`: Anzahlungsbasis (`pricing_rules.basis` / `deposit_basis`) + 10+1-Mehrfachblock-Option als Daten, Admin-Felder. **Erst nach F11/F16/F18.** Dann E5.3 (0008: `quote_promoter_sale()`, `reserve_promoter_seats()` mit wörtlichem UPDATE-Block, Audit/Storno-Funktionen, 8-parallel-Test gegen die neue Funktion).

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` → `supabase status/stop/start/db reset` scheitern. Docker läuft. Ausweichwege:

```
# Migration einspielen (additiv) — 0001–0006 sind eingespielt:
Get-Content supabase\migrations\000N_name.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie nachtragen: insert into supabase_migrations.schema_migrations (version, name, statements) values ('000N', 'name', array[<Dateitext>]);
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

E5 bringt weitere Migrationen (0007–0011) auf diesem Weg.

## Lokal testen — Preis und Anzahlung pro Termin (E3.4 / F14) — Browser-Test durch Marco steht weiterhin aus

Voraussetzung: Docker-Instanz läuft (`docker ps | findstr mmb-promoter`), `.env.local` im Root, `npm run dev` → http://127.0.0.1:3001

Login als **operator@mmb-promoter.test / operator-test-2026** (Seed, nur lokal):

1. **Regeln** (`/admin/regeln`): oben „Ticketpreis pro Person (Standard)" = „noch nicht eingetragen" + gelbe Warnung (F15). Betrag eintragen (z. B. 40,00) → „Neuer Standard gespeichert.", Historie-Zeile erscheint, Warnung weg. Darunter „Anzahlung pro Person (Standard)" = 30,00 € gültig ab 16.09.2026.
2. **Termin anlegen** (`/admin/termine/neu`): Felder „Eigener Ticketpreis pro Person (Euro)" / „Eigene Anzahlung pro Person (Euro)", Platzhalter „leer = Standard …". Leer → Detailseite zeigt Standard; mit 45 / 20 → „45,00 € (eigener Wert, Standard wäre 40,00 €)".
3. **Plausibilität:** Anzahlung 60 bei Preis 45 → Fehlermeldung. Anzahlung = Preis erlaubt.
4. **Zurück auf Standard:** Feld leeren und speichern → Historie-Zeile „wieder Standard"; erneut speichern ohne Änderung → keine neue Zeile.
5. **Promoter** (promoter@mmb-promoter.test / promoter-test-2026): `/admin/*` → `/kein-zugang`. `/promoter` unverändert Platzhalter (Verkauf kommt mit E5.4/E5.5).

**Aufräumen nach dem Browser-Test** (Regeln sind append-only, die UI löscht nichts):
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from tour_departures where title like 'TEST%';" -c "delete from pricing_rules where created_by is not null;" -c "delete from commission_rules where departure_id is null and commission_cents <> 1000;" -c "delete from group_rules where not (threshold_persons = 11 and free_persons = 1);"
```
Achtung: `delete from pricing_rules where created_by is not null` löscht auch einen eingetragenen Standard-Ticketpreis.

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter   # Instanz läuft? (CLI blockiert, s. o.)
npm test                # Vitest: 12 Dateien, 148 Tests (app-access nur mit laufendem Dev-Server, sonst skipped)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
git status              # 10 Pfade uncommitted (s. o.)
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert

- Migrationen 0001–0006 (Inventar, Handover-Funktion unverändert, Profile/Rollen/RLS, Termine + Regeln, Preis/Anzahlung, **Promoter-Verkaufs-Datenmodell**). Admin-Bereich komplett für Termine/Regeln. Promoter-Bereich: Login + Platzhalter.
- 0006: ein Promoter-Verkauf = `bookings`-Zeile mit `channel = 'promoter'` (+16 Spalten: Promoter, Idempotenz, bezahlte/gratis Plätze, Snapshots Preis/Anzahlung/Provision/10+1, Provisionssumme, generierter Rest, Zahlungsstatus, Verkaufszeit, Storno-Felder; DB-Checks erzwingen Vollständigkeit); `booking_audit_log`; `notifications` (`pending` = ausstehend, kein Versand). RLS: `authenticated` nur SELECT (Promoter eigene, Operator alle), Schreiben nur `service_role` bzw. ab E5.3 über security-definer-Funktionen.
- 148 Tests grün, darunter 8-parallel-Überbuchungstest und Funktions-Identität gegen die Handover-Datei.

## Was noch NICHT existiert

- Kein Standard-Ticketpreis-Betrag (F15). Keine Konto-Verwaltung (E4). **Keine Verkaufs-/Storno-/Zahlungsstatus-Funktion, kein Verkaufs-Flow, kein Promoter-Dashboard, kein Nachrichten-Auslöser, kein Storage-Bucket, keine Vorlagen** — E5.2 ff.

## Warnungen für den Wiedereinstieg

- **Nie `git add .`** — gezielt per Pfad. `.next/` ist ignoriert.
- `next dev` schreibt den Next.js-Block in `AGENTS.md` neu — Diff dort ignorieren bzw. mitcommitten.
- Deutsche Anführungszeichen in Code/Tests immer als `„…“` (U+201E/U+201C) — ein ASCII-`"` als Schlusszeichen bricht JSX/TS-Strings.
- Regeln sind append-only: Testwerte aus dem Browser bleiben stehen, bis man sie als `postgres` löscht (Befehl oben).
- Jede neue `create table`-Migration: Grants prüfen — `tests/events-rules-rls.test.ts` meldet, wenn `anon` wieder Rechte bekommt (RISKS Nr. 25); Erwartungsliste dort ergänzen (für 0006 geschehen).
- E5: **Reserve-Funktion aus 0002 bleibt byteidentisch** (Option B). Neue Funktion `reserve_promoter_seats()` (E5.3) bekommt eigenen UPDATE-Block-Identitätstest + eigenen 8-parallel-Test, bevor irgendetwas committet wird (Hard Rule 4).
- `bookings`-Checks aus 0006 gelten auch für die Handover-Funktion: Online-Zeilen bleiben gültig (alle neuen Spalten NULL), `release_departure_seats()` setzt nur `booking_status` (Storno-Felder NULL erlaubt).
- Tests laufen nur gegen localhost (`tests/db.ts`, `auth-login`, `app-access` prüfen die URL).
