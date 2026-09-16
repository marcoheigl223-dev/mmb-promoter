# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Angelegt 16.09.2026 (Fundament).** Einzige Datei, die überschrieben werden darf. Nichts hier gilt als protokolliert — erledigte Schritte gehören nach `docs/CHANGELOG.md` (Hard Rule 2).

## Aktuelle Aufgabe

**Etappe 1 (Sicherheitsnetz) läuft — 16.09.2026, Auftrag Marco: ein Strang, `git diff` vor jedem Commit, jeder Unterschritt einzeln, danach Stopp.** Plan bestätigt, `capacity_total` = Kontingent bestätigt (`docs/DECISIONS.md`).

Reihenfolge und Stand (Details `TASKS.md` E1):
- E1.0 Doku-Commit (diese Datei + DECISIONS) — [x]
- E1.1 Vitest + postgres.js + `npm test` + Smoke-Test — [ ]
- E1.2 Migration `0001_inventory_core.sql` (Enums, `tour_departures`, `bookings`) — [ ]
- E1.3 Migration `0002_reserve_function_handover.sql` (Handover-Zeilen 49–151 verbatim) + Diff-Nachweis + Test „Funktion in DB = Handover-Datei" — [ ]
- E1.4 Überbuchungstest 8-parallel + Freigabe-Test — [ ]

Bei Neustart der Session: `git log --oneline -8` zeigt, welche Unterschritte committet sind; `npm test` zeigt den Teststand; `supabase db reset` spielt die Migrationen neu ein.

## Wiedereinstieg — Befehle und Pfade

```
supabase start          # lokale Instanz (Ports 4532x), braucht supabase/.env.local
supabase status         # URLs + Keys → in .env.local eintragen (Vorlage: .env.local.example)
npm run dev             # Next.js auf http://127.0.0.1:3001
supabase stop           # Instanz stoppen (DB bleibt erhalten)
```

| Was | Wert |
|---|---|
| Supabase API | http://127.0.0.1:45321 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres |
| Studio | http://127.0.0.1:45323 |
| Mailpit | http://127.0.0.1:45324 |
| Dev-Server | http://127.0.0.1:3001 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored) |

Stand 16.09.2026: Instanz läuft, `JWT_SECRET` = eigener Wert; `next dev -p 3001` „Ready". CLI meldet Update v2.117.0 (installiert 2.108.0) — nicht gemacht, kein Auftrag.

## Was existiert / was nicht

- `docs/handover/reserve-function-final.sql` liegt vor (byteidentisch zur Boots-Quelle). Braucht `tour_departures`, `bookings`, Enums `booking_channel`/`payment_type`/`booking_status`; schreibt fest `online`/`full` (RISKS Nr. 23).
- `docs/research/` enthält beide Recherchen (Index im README).
- **Keine** Migration, **kein** Testrunner, **kein** `.env.local` im Root (M5 offen), `src/app/*` unverändertes Gerüst.

## Warnungen für den Wiedereinstieg

- Ports sind **4532x**, nicht 5532x — Windows-Portreservierung, `docs/DECISIONS.md` 16.09.
- `next dev` schreibt den Next.js-Block oben in `AGENTS.md` neu; Projektregeln darunter bleiben. Diff danach nicht wundern.
- Storno-Provision (F10) **nicht erfinden** — Marco hat sie ausdrücklich offen gelassen.
