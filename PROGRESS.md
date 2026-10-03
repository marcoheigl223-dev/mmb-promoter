# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 03.10.2026: Marco hat nach der Diagnose E5.5 (`ff76f7e`) entschieden: neuer Status-Fluss, Guide als dritte Rolle, E-Mail nur als Queue, fünf Teile nacheinander (DECISIONS 03.10.). TEIL 1 (Dashboard erreichbar = E5.5b) ist GEBAUT und VERIFIZIERT, aber NICHT committet. Ebenso E5.5a (Migration 0011). Beides wartet auf Marcos Bestätigung (Hard Rule 3). Danach Stopp vor TEIL 2 (Guide-Rolle).**

- Das Dashboard existierte vorher nicht (Marco nahm an, es sei gebaut) und wurde in Teil 1 gebaut: `/promoter/dashboard`, Link „Mein Dashboard“ in der Kopfzeile.
- Diese Datei darf als einzige überschrieben werden. Erledigte Schritte stehen in `docs/CHANGELOG.md`.

## Wo wir stehen

- **Migrationen 0001–0011** lokal eingespielt; 0001–0010 committet, **0011 nicht**.
- **Arbeitsbaum (uncommittet):**
  - E5.5a: `supabase/migrations/0011_sales_reporting_views.sql`, `tests/sales-reporting.test.ts`, `tests/events-rules-rls.test.ts`
  - Teil 1: `src/app/promoter/layout.tsx`, `src/app/promoter/dashboard/page.tsx` (neu), `src/lib/promoter/queries.ts`, `src/lib/promoter/dashboard.ts` (neu), `tests/promoter-dashboard.test.ts` (neu), `tests/app-access.test.ts`
  - Doku: CHANGELOG (E5.5a + Diagnose + Teil 1), DECISIONS (E5.5 + Entscheidungen nach der Diagnose), RISKS (Nr. 8/21/24/25, F25–F33), TASKS, diese Datei
- **Lokale DB:** 1 Buchung — Marcos Browser-Verkauf (Party Bus, 10 P., Vollzahler, 674,10 €), Party Bus 10/30 belegt. Diese Buchung lässt `bookings-rls` „Audit-Log nur eigener Buchung“ rot werden (der Test erwartet keine fremden Promoter-Buchungen). **Marco entscheidet: löschen (Aufräum-Befehl unten) oder Test robuster machen.**
- **Verifikation Teil 1:** `tsc` 0, `eslint` 0, `npm test` 234/235 in 18 Dateien (rot nur der o. g. Test), echte Zahlen HTML = DB 17/17 (Testverkäufe danach entfernt).

## Commit-Vorschlag (wartet auf Marcos OK; `git diff` je Schritt, gezielt per Pfad)

1. **E5.5a Auswertung:** `supabase/migrations/0011_sales_reporting_views.sql`, `tests/sales-reporting.test.ts`, `tests/events-rules-rls.test.ts`
2. **Teil 1 Dashboard:** `src/app/promoter/layout.tsx`, `src/app/promoter/dashboard/page.tsx`, `src/lib/promoter/queries.ts`, `src/lib/promoter/dashboard.ts`, `tests/promoter-dashboard.test.ts`, `tests/app-access.test.ts`
3. **docs:** `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `TASKS.md`, `PROGRESS.md`

## Browser-Test Teil 1 (Marco)

1. `npm run dev` läuft → http://127.0.0.1:3001, Login **promoter@mmb-promoter.test / promoter-test-2026**.
2. Kopfzeile oben rechts: „Events · Mein Dashboard · Abmelden“ → „Mein Dashboard“ tippen.
3. Erwartet mit deinem Verkauf vom Nachmittag:
   - Heute: 1 Abschluss, 674,10 €, Provision 90,00 €
   - Gesamt: 10 Tickets (9 bezahlt · 1 gratis), kassiert 674,10 €, offen 0,00 €
   - Balken am heutigen Tag
   - Verkauf in der Liste
4. Einen neuen Verkauf machen → Dashboard neu laden → Zahlen steigen genau um den Verkauf.
5. Als operator@… `/promoter/dashboard` aufrufen → `/kein-zugang`.

## Offen für Marco

| Frage | blockiert |
|---|---|
| **Commit E5.5a + Teil 1** + Begriffe (DECISIONS 03.10. E5.5) | Teil 2 |
| Marcos Browser-Verkauf in der lokalen DB löschen? (`bookings-rls` rot) | grüner `npm test` |
| **F29/F30** Guide-Rechte pro Event, „Tagesbestellungen“ | Teil 2 |
| Reihenfolge Teil 3–5; F26–F28, F32, F33 | Teil 3 |
| **F25** Abrechnung Promoter ↔ Gabo | Spalte „abzuführen“ (Admin-Auswertung) |
| Gruppenregel 10/1 lokal oder 11/1? · F15 · F10 · F13 | später |

## Handy-Test E5.4 (von Marco am 03.10.2026 im Browser bestätigt — bleibt als Referenz)

Voraussetzungen:
- Docker-Instanz läuft.
- `npm run dev` läuft → http://127.0.0.1:3001
- Chrome → DevTools (F12) → Geräte-Symbol (Strg+Umschalt+M) → „iPhone 12 Pro“ (390 px).
- Login als **promoter@mmb-promoter.test / promoter-test-2026**.
- Kein Preis mehr nötig — 74,90 €/30 € stehen schon an beiden Events.

**A — Live-Übersicht** („Barca Samba Disco-Boot“ → „Verkaufen“). Die Beträge stehen im Kasten „Beträge“ zwischen Zahlart und Kundendaten und ändern sich ca. ¼ s nach jedem Tippen.

| Eingabe | Gesamtpreis | Anzahlung jetzt | Rest im Bus |
|---|---|---|---|
| 1 Person, Anzahlung | 74,90 € | 30,00 € | 44,90 € |
| 3 Personen (mit +), Anzahlung | 224,70 € | 90,00 € | 134,70 € |
| 3 Personen, **Vollzahler** | 224,70 € | „Jetzt kassieren (Vollzahlung)“ 224,70 € | 0,00 € |
| 10 Personen, Anzahlung, nur zahlende Köpfe | 674,10 € (9 × 74,90, „davon gratis − 1“) | 270,00 € | 404,10 € |
| 10 Personen, alle Köpfe inkl. gratis | 674,10 € | 300,00 € | 374,10 € |
| 11 Personen, zahlende Köpfe | 749,00 € (10 × 74,90) | 300,00 € | 449,00 € |
| 20 Personen, Vollzahler | 1.348,20 € (18 × 74,90, 2 gratis) | 1.348,20 € | 0,00 € |
| 3 Personen, freier Betrag 100 | 224,70 € | 100,00 € | 124,70 € |
| 3 Personen, freier Betrag 224,70 | 224,70 € | — (Hinweis „unter dem Gesamtpreis … Vollzahler“) | — |
| 31 Personen | 31-Personen-Rechnung | roter Hinweis „Nur noch 30 Plätze frei.“ | |

Gratisplätze gelten mit der aktiven Regel 10/1. Bei 11/1 wären es bei 10 Personen 0 und bei 20 Personen 1.

**B — Kundendaten Pflicht:**
1. Vollzahler, 2 Personen, Name leer → „Weiter zur Bestätigung“ → Browser verlangt den Namen.
2. Dasselbe mit leerer Handynummer.
3. Mit Name + Handy, ohne E-Mail → Bestätigungsschritt „2 × 74,90 € = 149,80 €“, „Jetzt kassieren 149,80 €“, „Rest im Bus 0,00 €“.

**C — Verkauf abschließen:**
1. „Verkauf bestätigen · … kassiert“ → Detailseite mit Erfolgs-Banner. Doppelt tippen erzeugt nur einen Verkauf.
2. Zahlungsstatus durchschalten. Jede Änderung erscheint im Verlauf.
3. `/promoter` zeigt danach „28 von 30 frei“ bzw. die passende Zahl.

**Aufräumen** (nur als `postgres`). Der Befehl kaskadiert auf Audit-Log und Nachrichten und setzt die Zähler zurück:
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from bookings where channel = 'promoter';" -c "update tour_departures set seats_booked_total = 0 where title in ('Party Bus – Megapark Funbus', 'Barca Samba Disco-Boot');"
```
Die Test-Preise bleiben stehen (append-only; ändern per neuer Zeile auf der Termin-Detailseite).

## Offen für Marco

| Frage | blockiert |
|---|---|
| **Commit E5.5a** + Begriffe bestätigen (Umsatz = Gesamtpreis nicht stornierter Verkäufe, daneben kassiert/offen; heute = Ortszeit Mallorca; Storno separat) — DECISIONS 03.10. E5.5 | E5.5b |
| **F25** Abrechnung Promoter ↔ Gabo (Provision aus dem Bargeld einbehalten oder später ausgezahlt?) | Spalte „abzuführen“ in E5.5c |
| Gruppenregel 10/1 in der lokalen DB stehen lassen oder auf 11/1 zurück? | nichts (nur Testwerte) |
| Reihenfolge danach: Storno-Funktion + Nachrichten-Auslöser (aus E5.4 ausgelagert), Dashboard (E5.5), Admin-Storno-UI | nächster Schritt |
| F15 Ticketpreis-Betrag (echt) · F10 Storno-Provision · F13 Gabo im Promoter-Bereich | später |

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe` → `supabase status/stop/start/db reset` scheitern. Docker läuft. Ausweichwege:

```
# Migration einspielen (additiv) — 0001–0010 sind eingespielt:
Get-Content supabase\migrations\000N_name.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie nachtragen: insert into supabase_migrations.schema_migrations (version, name, statements) values ('000N', 'name', array[<Dateitext>]);
# Keys für .env.local (statt supabase status):
docker inspect supabase_studio_mmb-promoter --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String 'SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY'
```
Nach einem harten PC-Neustart kann Postgres ~13 min in der Crash-Recovery hängen. Einfach abwarten (`pg_isready`).

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter
npm test                # 17 Dateien, 227 Tests (app-access nur mit laufendem Dev-Server; event-images-HTTP nur mit Storage-API)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored); Anon/Service-Key in Root-`.env.local` (gitignored) |

## Was existiert

- **Migrationen 0001–0011:** 0009 bringt die Zahlungsstufe `not_collected`, 0010 die Verkaufs-Funktionen, 0011 die Auswertungs-Sichten `sales_totals`/`sales_by_day`/`sales_by_promoter`/`sales_by_departure` (security_invoker, noch von keiner Seite gelesen).
- **Admin:** Termine, Regeln, Vorlagen, Bilder.
- **Promoter:**
  - Events + eigene Verkäufe (`/promoter`)
  - Verkaufen mit Live-Übersicht und Bestätigungsschritt (`/promoter/verkaufen/[id]`)
  - Verkaufs-Detail mit 3-stufigem Zahlungsstatus und Verlauf (`/promoter/verkaeufe/[id]`)
- **Funktionen:**
  - `promoter_sale_amounts()` (intern)
  - `quote_promoter_sale()` — auch für die Live-Übersicht über `previewSaleAction()`
  - `reserve_promoter_seats()` (Option B, UPDATE-Block wörtlich, Idempotenz, `QUOTE_CHANGED`)
  - `set_booking_payment_status()` (Audit)

## Was noch NICHT existiert

- Storno-Funktion + Admin-Storno-UI
- Nachrichten-Auslöser (`notifications` bleibt leer)
- Promoter-Dashboard (E5.5b) und Admin-Auswertung (E5.5c)
- Bild-Anzeige im Promoter-Portal
- Konto-Verwaltung (E4)
- Standard-Ticketpreis (F15)

## Warnungen für den Wiedereinstieg

- **Git:**
  - **Nie `git add .`**, sondern gezielt per Pfad.
  - Keine Testbilder und keine echten Kundendaten ins Repo.
  - `next dev` schreibt den Next.js-Block in `AGENTS.md` ggf. neu.
- **Code-Konventionen:**
  - Deutsche Anführungszeichen in Code/Tests immer als `„…“` (U+201E/U+201C).
  - **Formular-Actions nie mit `.bind()`** an `useActionState` hängen: Der POST ohne JS hängt. IDs gehören als verstecktes Feld ins Formular.
  - Vitest kennt den Alias `@/` nicht. Libs, die Tests importieren (`src/lib/promoter/sale.ts`), nutzen relative Imports.
  - Beträge rechnet nur die DB. Auch die Live-Übersicht ruft `quote_promoter_sale()` auf, nie eigene Rechnung im Browser.
  - eslint `react-hooks` v7: kein synchrones `setState` im Effekt-Körper, nur in Callbacks.
- **Datenbank:**
  - Neuer Enum-Wert = eigene Migration (erst nach Commit benutzbar). Deshalb sind 0009 und 0010 getrennt.
  - **Reserve-Funktion aus 0002 bleibt byteidentisch.** `reserve_promoter_seats()` hat einen eigenen Identitäts- und 8-parallel-Test. Jede Änderung braucht beide grün vor dem Commit (Hard Rule 4).
  - Regeln sind append-only: Testwerte aus dem Browser bleiben stehen, bis man sie als `postgres` löscht.
  - Jede neue `create table`-Migration: Grants prüfen (`tests/events-rules-rls.test.ts`, RISKS Nr. 25).
- **Round-Trip-Skripte:**
  - Ohne JS: Multipart-POST mit den versteckten `$ACTION_*`-Feldern des jeweiligen Formulars.
  - Server Action wie der Browser: POST mit Header `Next-Action: <id>` (aus `.next/dev/server/app/**/server-reference-manifest.json`) und JSON-Array als Body. Der Wert steht in der RSC-Zeile `1:{…}`.
  - `formatCents` setzt vor „€“ ein U+00A0.
  - Node 24 unter Windows: `createRequire("C:/Projects/mmb-promoter/package.json")`.
- **Tests:** laufen nur gegen localhost.
