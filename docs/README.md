# docs/ — Dokumentations-System von mmb-promoter

Angelegt 16.09.2026 (Fundament). Die Regeln für alle Schichten stehen in `/AGENTS.md` (Abschnitt „Doku-Schichten"). Kurzfassung:

| Pfad | Zweck | Anhänge-Regel |
|---|---|---|
| `CHANGELOG.md` | Änderungsprotokoll (Hard Rule 2) | neue Einträge **unten**, nie löschen |
| `DECISIONS.md` | Entscheidungs-Log, Index aller Entscheidungen | neue Einträge **oben**, nie löschen |
| `decisions/` | ADRs (ausführliche Architektur-Entscheidungen) | eine Datei pro Entscheidung, nie ändern |
| `RISKS.md` | Risiko-Register + offene Fragen | Status ändern, nie löschen |
| `research/` | Recherche-Berichte (Input von außen, kein Fakt-Ersatz) | Dateien hinzufügen, nie editieren |
| `handover/` | Übergabe-Artefakte aus dem Boots-Projekt (z. B. `reserve-function-final.sql`) | nie editieren, nie als Migration ausführen |
| `../PROGRESS.md` | Scratchpad der laufenden Aufgabe | darf überschrieben werden |
| `../TASKS.md` | abhakbare Schritte der laufenden Phase | Haken setzen, ergänzen |

Wo Marco Dateien ablegt: siehe `research/README.md` und `handover/README.md`.
