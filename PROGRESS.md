# PROGRESS.md — Scratchpad (Arbeitsstand der laufenden Aufgabe)

**Angelegt 16.09.2026 (Fundament).** Einzige Datei, die überschrieben werden darf. Nichts hier gilt als protokolliert — erledigte Schritte gehören nach `docs/CHANGELOG.md` (Hard Rule 2).

## Aktuelle Aufgabe

**Fundament + Doku-System — abgeschlossen (16.09.2026).** Keine Features gebaut (Auftrag Marco). Nächster Schritt: Marco kopiert die Übergabe-Dateien (siehe `TASKS.md`, „Manuelle Schritte für Marco"), dann Etappenplanung.

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

Stand 16.09.2026, 01:35: `supabase start` erfolgreich, `supabase status` liefert die URLs oben; `JWT_SECRET` in der Ausgabe entspricht dem eigenen Wert aus `.env.local` (also nicht der CLI-Default). Boots-Instanz (`supabase_*_web`, 543xx) lief parallel weiter. Hinweis: CLI meldet Update v2.117.0 verfügbar (installiert 2.108.0) — nicht gemacht, kein Auftrag.

## Was noch NICHT existiert

- Keine Migration in `supabase/migrations/` (Ordner leer bis Etappe 1).
- Kein `.env.local` im Root (Vorlage vorhanden; Werte aus `supabase status`).
- Kein Testrunner (RISKS Nr. 8).
- `src/app/*` ist das unveränderte Create-Next-App-Gerüst.
- `docs/research/` und `docs/handover/` sind leer bis Marco kopiert (RISKS Nr. 19).

## Warnungen für den Wiedereinstieg

- Ports sind **4532x**, nicht 5532x wie ursprünglich beauftragt — Windows-Portreservierung, siehe `docs/DECISIONS.md` 16.09.
- `next dev` schreibt den Next.js-Block oben in `AGENTS.md` bei jedem Start neu; die Projektregeln stehen darunter und bleiben erhalten. Diff nach `npm run dev` deshalb nicht wundern.
