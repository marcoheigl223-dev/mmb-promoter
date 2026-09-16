# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Stand 16.09.2026, Etappe 1 (Sicherheitsnetz) ABGESCHLOSSEN.** Einzige Datei, die überschrieben werden darf. Nichts hier gilt als protokolliert — erledigte Schritte stehen in `docs/CHANGELOG.md` (Hard Rule 2).

## Wo wir stehen

Etappe 1 komplett, jeder Unterschritt einzeln committet, alle verifiziert:

| Schritt | Commit | Beleg |
|---|---|---|
| E1.0 Doku (Regeln, Plan, Kontingent-Entscheidung) | `fc50fdf` | DECISIONS/RISKS/TASKS |
| E1.1 Vitest + postgres.js + `npm test` | `e6f6801` | Smoke-Test 2/2 |
| E1.2 Migration `0001_inventory_core.sql` | `8d75b7c` | `supabase db reset`, Enums + 2 Tabellen |
| E1.3 Migration `0002_reserve_function_handover.sql` | `385fcc0` | Diff gegen Handover leer; `pg_get_functiondef` == Datei |
| E1.4 Überbuchungstest | `b416e5d` | **13/13 grün**, 8 parallel → 1 Erfolg / 7× SOLD_OUT |

**Marco hat „Danach Stopp" gesagt.** Etappe 2 (Login + Rollen) ist NICHT begonnen. Nächster Schritt: Marco gibt E2 frei (TASKS E2.1–E2.3). Vor E5: F10, F11, F12 und RISKS Nr. 21–23 klären.

## Wiedereinstieg — Befehle

```
supabase start          # lokale Instanz (Ports 4532x), braucht supabase/.env.local
supabase db reset       # spielt 0001 + 0002 neu ein (löscht lokale Daten — nur Testdaten)
npm test                # Vitest: 3 Dateien, 13 Tests, ~1 s; braucht laufende Instanz
npx vitest run --reporter=verbose
npx tsc --noEmit && npx eslint tests
git log --oneline       # Stand: b416e5d (E1.4)
npm run dev             # Next.js auf http://127.0.0.1:3001 (Gerüst, keine Features)
```

| Was | Wert |
|---|---|
| Postgres | postgresql://postgres:postgres@127.0.0.1:45322/postgres (Default in `tests/db.ts`) |
| Supabase API / Studio / Mailpit | 45321 / 45323 / 45324 |
| Container-Präfix | `supabase_*_mmb-promoter` |
| JWT-Secret | `supabase/.env.local` (gitignored) |

## Was existiert

- `supabase/migrations/0001_inventory_core.sql` — Enums `booking_channel`, `payment_type`, `booking_status`; Tabellen `tour_departures` (`capacity_total` = Kontingent), `bookings`.
- `supabase/migrations/0002_reserve_function_handover.sql` — Handover-Zeilen 49–151 byteidentisch (nie editieren; Erweiterung = neue Migration, E5.1).
- `tests/db.ts` (Verbindung, nur localhost), `tests/smoke.test.ts`, `tests/reserve-function-unchanged.test.ts`, `tests/overbooking.test.ts`.
- `vitest.config.mts` — `fileParallelism: false`, damit Testdateien sich nicht gegenseitig in der DB stören.

## Was noch NICHT existiert

- Kein Login, keine Rollen, keine Profile (E2). `src/app/*` ist das unveränderte Create-Next-App-Gerüst.
- Keine Promoter-Spalten in `bookings`, keine Provisions-/Gruppenregeln (E3/E5).
- Kein `.env.local` im Root (M5), kein GitHub-Remote (M6).

## Warnungen für den Wiedereinstieg

- Tests laufen gegen die **lokale** DB und legen/löschen Zeilen `TEST-overbooking-%` — nie gegen eine andere URL (`tests/db.ts` verweigert Nicht-localhost).
- `next dev` schreibt den Next.js-Block oben in `AGENTS.md` neu — Diff danach nicht wundern.
- Ports 4532x, nicht 5532x (DECISIONS 16.09.).
- `@types/node` ist ^22 (Vitest-Peer-Dep), nicht ^20 — nicht zurückdrehen.
