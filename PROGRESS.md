# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 03.10.2026:**
- Teil 1 ist bestätigt und committet (`6236fc8`, `49d2f9c`, `10c6553`).
- **TEIL 2 ist von Marco bestätigt und committet** (`ae17025`, `543c509`, `b9174dc` + Doku-Commit) und gepusht.
- **Jetzt: TEIL 3** (Gabos Auswertungs-Dashboard, `/admin/auswertung`).
- Reihenfolge laut Marco (DECISIONS 03.10. „Teil 2“): 3 Gabo-Auswertung · 4 Guide-Extras · 5 Status-Fluss neu · 6 E-Mail-Logik.
- Diese Datei darf als einzige überschrieben werden. Erledigte Schritte stehen in `docs/CHANGELOG.md`.

## Wo wir stehen

- **Migrationen 0001–0013** lokal eingespielt und committet.
- **Lokale DB:**
  - 4 Seed-Profile (Operator, Promoter, deaktivierter Promoter, **Guide**)
  - 1 Buchung (Marcos Browser-Verkauf, Party Bus 10/30)
  - Keine Testreste
- **Verifikation:**
  - `tsc` 0, `eslint` 0
  - **`npm test` 269/269 in 20 Dateien** (8-parallel-Überbuchungstests grün)
  - Round-Trip Konten 20/20, Guide-Verkauf 8/8

## Commit-Vorschlag (wartet auf Marcos OK; gezielt per Pfad, nie `git add .`)

1. **Migrationen + Seed:** `supabase/migrations/0012_user_role_guide.sql`, `supabase/migrations/0013_guide_role_accounts.sql`, `supabase/seed.sql`
2. **App:** `src/lib/auth/access.ts`, `src/app/admin/layout.tsx`, `src/app/promoter/layout.tsx`, `src/app/admin/konten/` (4 Dateien), `src/lib/admin/accounts.ts`, `src/lib/admin/account-queries.ts`, `src/lib/supabase/admin.ts`
3. **Tests:** `tests/guide-role.test.ts`, `tests/accounts-input.test.ts`, `tests/access-guard.test.ts`, `tests/auth-login.test.ts`, `tests/app-access.test.ts`, `tests/bookings-rls.test.ts`, `tests/events-rules-rls.test.ts`, `tests/profiles-rls.test.ts`
4. **docs:** `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `TASKS.md`, `PROGRESS.md`

## Browser-Test Teil 2 (Marco)

`npm run dev` läuft → http://127.0.0.1:3001. Am besten zwei Fenster (normal + Inkognito), damit zwei Logins parallel gehen.

**A — Als Guide verkaufen** (`guide@mmb-promoter.test` / `guide-test-2026`)
1. Nach dem Login landest du auf `/promoter`. Oben links steht **„Guide · Test-Guide“**, rechts „Events · Mein Dashboard · Abmelden“.
2. „Barca Samba Disco-Boot“ → „Verkaufen“ → 2 Personen, Anzahlung, Name + Handy → „Weiter zur Bestätigung“ → „Verkauf bestätigen“.
   - Erwartet: 2 × 74,90 € = 149,80 €, jetzt 60,00 €, Rest 89,80 €.
3. „Mein Dashboard“: genau dieser eine Verkauf (heute 1 Abschluss, 149,80 €, Provision gemäß Regel). **Marcos Party-Bus-Verkauf erscheint hier nicht.**
4. Adresse `/admin` eintippen → **„Kein Zugang“**. Ebenso `/admin/konten`.

**B — Jede Rolle nur Eigenes**
1. Im zweiten Fenster als `promoter@mmb-promoter.test` / `promoter-test-2026` einloggen → „Mein Dashboard“: nur dein Party-Bus-Verkauf, **nicht** der des Guides.
2. Unter Events zeigt „Barca Samba“ trotzdem 28 von 30 frei — das Kontingent ist gemeinsam.

**C — Gabo verwaltet Konten** (`operator@mmb-promoter.test` / `operator-test-2026`)
1. Kopfzeile „Konten“ → zwei Abschnitte **Promoter** und **Guides**.
2. „Neuen Guide anlegen“: Name, E-Mail (z. B. `guide2@mmb-promoter.test`), Passwort mit mindestens 12 Zeichen. Danach öffnet sich die Detailseite mit Erfolgsmeldung.
   - Mit 11 Zeichen oder einer schon vorhandenen E-Mail kommt eine Meldung, angelegt wird nichts.
3. Mit dem neuen Guide einloggen → `/promoter`. Dann als Gabo **deaktivieren** → der Guide landet beim nächsten Klick auf „Gesperrt“. Wieder aktivieren → geht wieder.
4. Passwort setzen → das alte Passwort geht nicht mehr, das neue schon.
5. Gabos eigenes Konto steht in keiner Liste. Eine Rolle lässt sich nicht nachträglich ändern (F29).

**Aufräumen danach** (nur als `postgres`):
- Testverkäufe: Befehl unten löscht **alle** Promoter-/Guide-Verkäufe, auch deinen Party-Bus-Verkauf.
- Selbst angelegte Konten: in Studio (http://127.0.0.1:45323 → Authentication) löschen. Das Profil fällt per FK mit weg.
```
docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -c "delete from bookings where channel = 'promoter';" -c "update tour_departures set seats_booked_total = 0 where title in ('Party Bus – Megapark Funbus', 'Barca Samba Disco-Boot');"
```

## Offen für Marco

| Frage | blockiert |
|---|---|
| **Commit Teil 2** (Diff gezeigt) | Teil 3 |
| **F25** Abrechnung Promoter/Guide ↔ Gabo („was Gabo an wen abgibt“) | Spalte „abzuführen“ in Teil 3 |
| F29/F30/F31/F33 Guide-Rechte pro Event, Tagesbestellungen, Guide-Provision, wer kassiert | Teil 4 |
| F26/F27/F28 Status-Fluss · F32 Ticket-Inhalt | Teil 5 / 6 |
| F15 · F10 · F13 · Gruppenregel 10/1 lokal | später |

## ⚠️ Blocker auf diesem Rechner: Supabase-CLI (RISKS Nr. 24)

Windows Smart App Control blockiert `supabase-go.exe`. Docker läuft. Ausweichweg:
```
Get-Content supabase\migrations\00NN_name.sql -Raw | docker exec -i supabase_db_mmb-promoter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1
# Historie: insert into supabase_migrations.schema_migrations (version, name, statements) values ('00NN', 'name', array[<Dateitext>]);
```
Nach einem harten Neustart kann Postgres ~13 min in der Crash-Recovery hängen (`pg_isready` abwarten).

## Wiedereinstieg — Befehle

```
docker ps --format '{{.Names}} {{.Status}}' | findstr mmb-promoter
npm test                # 20 Dateien, 269 Tests (app-access nur mit laufendem Dev-Server)
npx next typegen && npx tsc --noEmit && npx eslint src tests
npm run dev             # http://127.0.0.1:3001
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Test-Konten | operator@ / promoter@ / inactive-promoter@ / **guide@** mmb-promoter.test (Passwörter in `supabase/seed.sql`) |

## Was existiert

- **Rollen:**
  - `network_operator` (Gabo, `/admin`)
  - `promoter` und **`guide`** (`/promoter`, verkaufen, eigenes Dashboard, nur eigene Daten)
- **Admin:** Termine, Regeln, Vorlagen, Bilder, **Konten** (Promoter/Guides anlegen, aktivieren/deaktivieren, Name, Passwort).
- **Promoter/Guide:** Events, Verkaufen mit Live-Übersicht, Verkaufs-Detail mit Zahlungsstatus, Mein Dashboard.
- **DB:** Sichten 0011 (security_invoker); `reserve_promoter_seats()` für promoter|guide (UPDATE wörtlich); `set_booking_payment_status()` (fremde Buchungen nur Gabo).

## Was noch NICHT existiert

- Gabos Auswertung (Teil 3)
- Guide-Extras (Teil 4)
- Status-Fluss neu (Teil 5)
- Ticket-Mail-Queue (Teil 6)
- Storno-Funktion/-UI
- Standard-Ticketpreis (F15)

## Warnungen für den Wiedereinstieg

- **Git:** nie `git add .`; `next dev` schreibt ggf. den Next.js-Block in `AGENTS.md`.
- **Zeilenenden:** Repo ist LF, `core.autocrlf=false`. Python unter Windows nur mit `newline=''` schreiben, sonst CRLF und riesiger Diff-Lärm (passiert in Teil 2, behoben).
- **Code:**
  - Anführungszeichen „…“
  - Formular-Actions nie mit `.bind()`, IDs als verstecktes Feld
  - Vitest-Libs mit relativen Imports
  - Beträge rechnet nur die DB
- **`service_role`** nur in `src/lib/supabase/admin.ts` (nur `auth.admin`). Alles andere über den RLS-Client.
- **Datenbank:**
  - Neuer Enum-Wert = eigene Migration (0009/0010, 0012/0013).
  - Reserve-Funktion 0002 byteidentisch.
  - `reserve_promoter_seats()`: Identitäts- und 8-parallel-Test vor jedem Commit.
  - Neue Tabellen/Grants → `events-rules-rls` prüfen (RISKS Nr. 25).
- **Tests mit lokalen Fremddaten:** Erwartungen auf eigene Test-/Seed-IDs eingrenzen, nie „genau N Zeilen in der Tabelle“.
- **Round-Trip ohne JS:** versteckte `$ACTION_*`-Felder aus dem HTML **entity-dekodieren** (`&quot;`), sonst „Failed to find Server Action“.
