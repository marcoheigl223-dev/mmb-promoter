# docs/decisions/ — Architecture Decision Records (ADR)

Angelegt 16.09.2026. Ein ADR hält **eine** Architektur-Entscheidung ausführlich fest: Kontext, betrachtete Alternativen, Entscheidung, Konsequenzen, Verifikation. Eine Datei pro Entscheidung, fortlaufend nummeriert, **nachträglich nicht mehr geändert** — wird eine Entscheidung revidiert, entsteht ein neuer ADR, und der alte bekommt oben den Status `Überholt durch ADR-XXXX`.

## Abgrenzung zu `docs/DECISIONS.md`

- `docs/DECISIONS.md` ist das **verbindliche Entscheidungs-Log** und wird über `/CLAUDE.md` in jede Session geladen. Es ist der chronologische Index **aller** Entscheidungen, auch der kleinen.
- `docs/decisions/` ergänzt es für die **großen** Entscheidungen, bei denen ein Absatz zu knapp wäre.
- **Regel:** Wird ein ADR angelegt, bekommt `docs/DECISIONS.md` zusätzlich einen Kurz-Eintrag mit Verweis. Nie nur das eine. Bei Widerspruch gilt der ADR als ausführliche Fassung, `DECISIONS.md` als Index.

## Aufbau

`NNNN-kurzer-titel-in-kebab-case.md`, beginnend bei `0001`. Vorlage: [`0000-template.md`](0000-template.md).

## Status-Werte

| Status | Bedeutung |
|---|---|
| `Vorschlag` | zur Diskussion, noch nicht gültig |
| `Angenommen` | gültig, Grundlage für die Arbeit |
| `Überholt durch ADR-XXXX` | ersetzt — Datei bleibt unverändert als Historie |
| `Verworfen` | nie in Kraft getreten, Begründung in der Datei |

## Index

| Nr. | Titel | Status | Datum |
|---|---|---|---|
| [0001](0001-vollstaendig-getrennt-von-mymallorcaboats.md) | Vollständig getrennt von MyMallorcaBoats — eigene DB, manuelle Kontingent-Zuteilung durch Gabo, keine Cross-DB-Kopplung | Angenommen | 16.09.2026 |
