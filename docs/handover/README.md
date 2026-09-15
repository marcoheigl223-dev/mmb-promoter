# docs/handover/ — Übergabe-Artefakte aus dem Boots-Projekt

Angelegt 16.09.2026. Hier liegen Dateien, die das Boots-Projekt (MyMallorcaBoats) für dieses Projekt eingefroren hat. Sie sind **Referenz, keine Migration**: nie direkt gegen die Datenbank ausführen, nie editieren. Was daraus übernommen wird, landet als eigene Datei unter `supabase/migrations/` — und der Diff gegen das Artefakt ist Teil der Verifikation (RISKS Nr. 3).

## Ablage-Anweisung für Marco (16.09.2026)

| Quelle | Ziel | Inhalt |
|---|---|---|
| `C:\Projects\MyMallorcaExperience\docs\schema-snapshots\reserve-function-final.sql` | **`docs/handover/reserve-function-final.sql`** | Die bewährte, promoter-freie Fassung von `reserve_departure_seats()` (151 Zeilen), erzeugt aus der laufenden Boots-DB nach Migration 0005. Enthält im Kopf die Anleitung, was beim Übernehmen nicht kaputtgemacht werden darf. |

Dateiname **unverändert** lassen — `AGENTS.md` Hard Rule 4, `docs/RISKS.md` und ADR-0001 verweisen auf genau diesen Pfad.

## Was die Datei für dieses Projekt bedeutet (Hard Rule 4)

Die Überbuchungssperre ist das eine atomare Statement

```sql
update tour_departures
set seats_booked_total = seats_booked_total + p_seats
where id = p_departure_id
  and status = 'open'
  and seats_booked_total + p_seats <= capacity_total
returning id into v_departure_id;
```

Trifft es 0 Zeilen → `SOLD_OUT`. Prüfung und Erhöhung bleiben **ein** Statement. Kontingent-/Kanal-Logik dieses Projekts kommt als **zusätzliche** Spalten und **zusätzliche** `WHERE`-Bedingungen in dasselbe UPDATE — nie als vorgeschaltetes `SELECT`, nie als Anwendungs-Locking. Jede Änderung braucht den 8-parallel-Test grün.

## Index

| Datei | Herkunft | Stand |
|---|---|---|
| `reserve-function-final.sql` | Boots-Repo, `docs/schema-snapshots/`, Commit `7d92565` (neu erzeugt nach `fdc8624`) | **noch nicht abgelegt** — Marco kopiert |
