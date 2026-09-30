# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 30.09.2026, Schritt A (E3.4 / F14: eigener Ticketpreis + eigene Anzahlung pro Termin/Event) GEBAUT UND VERIFIZIERT — NICHT COMMITTET, wartet auf Marcos Bestätigung.** Schritt B (E5, Promoter-Verkauf) beginnt erst nach dieser Bestätigung. Einzige Datei, die überschrieben werden darf. Erledigte Schritte stehen in `docs/CHANGELOG.md` (Hard Rule 2).

## Wo wir stehen

- E1–E3 committet und gepusht (`origin/main` = `7491cd5`).
- **E3.4 (F14) fertig im Arbeitsbaum, uncommitted.** Auftrag Marco 30.09.2026: „ein Event/Termin optional einen EIGENEN Preis und eine EIGENE Anzahlung … Gabo-pflegbar … DB-Daten … RLS: nur network_operator schreibt … Zeig mir git diff + Test, committe nach meiner Bestätigung."

Vorgeschlagene Commit-Aufteilung (gezielt per Pfad, kein `git add .`):

| Commit | Pfade | Beleg |
|---|---|---|
| E3.4a Migration | `supabase/migrations/0005_pricing_rules.sql` | per psql eingespielt, Historie 0005, `tests/pricing-rules-rls.test.ts` 16/16 |
| E3.4b App | `src/lib/admin/types.ts`, `src/lib/admin/pricing.ts`, `src/lib/admin/queries.ts`, `src/app/admin/termine/actions.ts`, `src/app/admin/termine/departure-form.tsx`, `src/app/admin/termine/neu/page.tsx`, `src/app/admin/termine/[id]/page.tsx`, `src/app/admin/regeln/actions.ts`, `src/app/admin/regeln/rules-forms.tsx`, `src/app/admin/regeln/page.tsx` | `tsc` 0, `eslint` 0, Round-Trip durch die Server Actions |
| E3.4c Tests | `tests/pricing-rules-rls.test.ts`, `tests/pricing-logic.test.ts`, `tests/events-rules-rls.test.ts`, `tests/app-access.test.ts` | `npm test` 125/125 in 11 Dateien |
| Doku | `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `TASKS.md`, `PROGRESS.md` | — |

`AGENTS.md` wird von `next dev` neu geschrieben — falls im Diff: mitcommitten oder ignorieren, kein Inhalt von uns.

**Offen für Marco:** (1) Diff + Tests prüfen, Commit freigeben. (2) **F15: regulärer Ticketpreis-Betrag** — nicht geraten; bitte unter `/admin/regeln` eintragen oder mir den Betrag nennen. (3) Browser-Test unten. Danach Schritt B (E5) — dafür weiterhin offen: F10 (Storno-Provision, bleibt offen — Marco: nur Hinweis/Regel anzeigen), F11 (Anzahlung 10 oder 11 Personen — Marco 30.09.: Anzahlung pro Person **oder** Gesamtbetrag mit Gruppenbonus-Option, Gabo-steuerbar), F12 (Funktions-Anpassung, Vorschlag Option A), RISKS Nr. 22/23.

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` → `supabase status/stop/start/db reset` scheitern. Docker läuft. Ausweichwege:

```
# Migration einspielen (additiv, löscht nichts) — für 0005 bereits geschehen:
Get-Content supabase\migrations\0005_pricing_rules.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie nachtragen (supabase_migrations.schema_migrations: version, name, statements) — für 0005 bereits geschehen.
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```

Sobald die CLI wieder geht: `supabase stop && supabase start && supabase db reset` stellt alles aus `config.toml` + Migrationen 0001–0005 + `seed.sql` regulär her.

## Lokal testen — Preis und Anzahlung pro Termin (E3.4 / F14)

Voraussetzung: Docker-Instanz läuft (`docker ps | findstr mmb-promoter`), `.env.local` im Root, `npm run dev` → http://127.0.0.1:3001

Login als **operator@mmb-promoter.test / operator-test-2026** (Seed, nur lokal):

1. **Regeln** (`/admin/regeln`): oben „Ticketpreis pro Person (Standard)" = „noch nicht eingetragen" + gelbe Warnung (F15). Betrag eintragen (z. B. 40,00) → „Neuer Standard gespeichert.", Historie-Zeile erscheint, Warnung weg. Darunter „Anzahlung pro Person (Standard)" = 30,00 € gültig ab 16.09.2026; neuen Wert speichern → neue Zeile, alte bleibt.
2. **Termin anlegen** (`/admin/termine/neu`): unter Kontingent/Status die zwei neuen Felder „Eigener Ticketpreis pro Person (Euro)" und „Eigene Anzahlung pro Person (Euro)", Platzhalter „leer = Standard 40,00 €" bzw. „leer = Standard 30,00 €". Beide leer lassen → Detailseite zeigt „Ticketpreis pro Person: 40,00 € (Standard) · Anzahlung pro Person: 30,00 € (Standard)". Mit 45 / 20 anlegen → „45,00 € (eigener Wert, Standard wäre 40,00 €)" / „20,00 € (eigener Wert, Standard wäre 30,00 €)".
3. **Plausibilität:** Anzahlung 60 bei Preis 45 speichern → „Die Anzahlung pro Person darf den Ticketpreis pro Person nicht übersteigen." Anzahlung = Preis ist erlaubt (Vollzahlung).
4. **Zurück auf Standard:** Feld leeren und speichern → Kopfzeile zeigt wieder Standard, Abschnitt „Preis und Anzahlung für diesen Termin" enthält die Zeile „wieder Standard"; alte Zeilen bleiben. Erneut speichern ohne Änderung → keine neue Zeile.
5. **Promoter** (promoter@mmb-promoter.test / promoter-test-2026): `/admin/*` → `/kein-zugang`. `/promoter` unverändert (Verkauf kommt mit E5).

**Aufräumen nach dem Browser-Test** (Regeln sind append-only, die UI löscht nichts):
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from tour_departures where title like 'TEST%';" -c "delete from pricing_rules where created_by is not null;" -c "delete from commission_rules where departure_id is null and commission_cents <> 1000;" -c "delete from group_rules where not (threshold_persons = 11 and free_persons = 1);"
```
Achtung: `delete from pricing_rules where created_by is not null` löscht auch einen eingetragenen Standard-Ticketpreis. Wer ihn behalten will, löscht stattdessen gezielt nach Betrag.

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter   # Instanz läuft? (CLI blockiert, s. o.)
npm test                # Vitest: 11 Dateien, 125 Tests (app-access nur mit laufendem Dev-Server, sonst skipped)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
git status              # E3.4 uncommitted: 11 geänderte + 4 neue Dateien (Tabelle oben)
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert (neu in E3.4)

- `supabase/migrations/0005_pricing_rules.sql` — `pricing_kind`, `pricing_rules` (append-only, Anzahlung 30,00 € als Startdaten, kein Ticketpreis-Startwert), `effective_price_cents()`, RLS nur `network_operator` schreibt.
- `src/lib/admin/pricing.ts` (reine Logik: `parseOptionalEuro`, `activeOverrideCents`, `planPricingWrites`, `depositAbovePriceError`), Erweiterungen in `types.ts`/`queries.ts`, Termin-Formular + Detailseite + `/admin/regeln`.
- Tests: `pricing-rules-rls` (16), `pricing-logic` (21); `events-rules-rls` Grant-Liste, `app-access` Texte.

## Was noch NICHT existiert

- Kein Standard-Ticketpreis-Betrag (F15 — Gabo/Marco trägt ein). Keine Konto-Verwaltung (E4). Keine Verkaufsfunktion, keine Snapshots pro Buchung (E5). `bookings` für `authenticated` weiterhin komplett gesperrt.
- Keine Gruppenregel pro Event, kein Löschen von Terminen (bewusst), keine Passwort-Reset-Strecke.

## Warnungen für den Wiedereinstieg

- **Nie `git add .`** — gezielt per Pfad (Tabelle oben). `.next/` ist ignoriert.
- `next dev` schreibt den Next.js-Block in `AGENTS.md` neu — Diff dort ignorieren bzw. mitcommitten.
- Deutsche Anführungszeichen in Code/Tests immer als `„…“` (U+201E/U+201C) — ein ASCII-`"` als Schlusszeichen bricht JSX/TS-Strings (ist am 30.09. zweimal passiert).
- Regeln sind append-only: Testwerte aus dem Browser bleiben stehen, bis man sie als `postgres` löscht (Befehl oben).
- Jede neue `create table`-Migration: Grants prüfen — `tests/events-rules-rls.test.ts` meldet, wenn `anon` wieder Rechte bekommt (RISKS Nr. 25). Für neue Tabellen die Erwartungsliste dort ergänzen (0005: `pricing_rules INSERT,SELECT`).
- Tests laufen nur gegen localhost (`tests/db.ts`, `auth-login`, `app-access` prüfen die URL).
