# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 03.10.2026: E5.4 (Promoter-Verkauf, Verkaufs-Kern) ist von Marco im Browser bestätigt und COMMITTET. Der Push nach `origin/main` folgt direkt nach dem Doku-Commit. Als Nächstes kommt E5.5 (volles Dashboard Promoter + Gabo), in Teilschritten mit Stopp nach jedem.**

- E5.4-Commits: `d08f8e1` Migrationen 0009/0010, `60ca6ab` Promoter-Portal, `abe39c0` Tests, danach der Doku-Commit.
- Diese Datei darf als einzige überschrieben werden. Erledigte Schritte stehen in `docs/CHANGELOG.md`.

## Wo wir stehen

- **Migrationen 0001–0010** sind lokal eingespielt (`docker exec … psql`, Historie bis `0010`) und committet.
- **Lokale DB (nur Testdaten, nicht im Repo):**
  - 0 Buchungen, 0 Audit-Zeilen (Marco hat nach seinem Test aufgeräumt).
  - 2 Termine, je mit Kontingent 30 und 0 belegt:
    - „Party Bus – Megapark Funbus“, 10.10., intern
    - „Barca Samba Disco-Boot“, 12.10.
  - **Test-Preis an beiden Events:** Ticket 74,90 €, Anzahlung 30,00 €/Person (Termin-Ausnahmen in `pricing_rules`).
  - Ein Standard-Ticketpreis ist weiterhin nicht eingetragen (F15).
- **Aktive Gruppenregel ist 10/1** (ab 29.09., vermutlich E3-Testwert; eigentlich 11/1) — Marco entscheidet.
- **Verifikation vor dem Commit:** `tsc` 0, `eslint` 0, **`npm test` 216/216 in 16 Dateien**.

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
| E5.5-Zerlegung und Teilschritt 1 (Plan im Chat) | E5.5 |
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
npm test                # 16 Dateien, 216 Tests (app-access nur mit laufendem Dev-Server; event-images-HTTP nur mit Storage-API)
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

- **Migrationen 0001–0010:** 0009 bringt die Zahlungsstufe `not_collected`, 0010 die Verkaufs-Funktionen.
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
- Volles Promoter-Dashboard (E5.5)
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
