<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Projektregeln mmb-promoter (Promoter-/Vertriebsnetzwerk)

**Lies diese Datei komplett, bevor du irgendeine Aufgabe beginnst. Bei Unsicherheit: nachlesen statt raten — in `docs/DECISIONS.md`, `docs/RISKS.md`, den ADRs unter `docs/decisions/` — oder Marco fragen.** Nichts annehmen, was hier nicht steht.

## Projekt

**mmb-promoter** ist das eigenständige Promoter-/Vertriebsnetzwerk für die Bootstouren von MyMallorcaBoats (Betreiber: Eros Gabriel „Gabo" Dömer, Palma de Mallorca; Projektleitung/Entwicklung: Marco). Promoter verkaufen am Strand Plätze aus einem Kontingent, das Gabo ihnen zuteilt — mit Anzahlung oder Vollzahlung — und sehen ihre eigene Historie/Provision; Gabo verwaltet Accounts, Kontingente, Provisionsregeln und Auswertung.

**Es ist vollständig getrennt vom Boots-Projekt** (`C:\Projects\MyMallorcaExperience`, Repo MyMallorcaBoats): eigene Datenbank, eigene Domain, eigenes Login, eigenes Deployment, eigenes Repo. Verbindlich festgehalten in **ADR-0001** (`docs/decisions/0001-vollstaendig-getrennt-von-mymallorcaboats.md`). Wiederverwendung findet ausschließlich über geteilten **Code** statt (die versionierte SQL-Datei `docs/handover/reserve-function-final.sql`, ggf. TypeScript-Bausteine) — **nie über geteilte Daten**.

Stand 16.09.2026: Fundament und Doku stehen, **keine Features gebaut**. Etappen werden mit Marco geplant (`TASKS.md`).

## Doku-Schichten — wo was hingehört

| Datei | Inhalt | Zeithorizont | Anhänge-Regel |
|---|---|---|---|
| `AGENTS.md` (diese) | Regeln, Projektkontext, Stack, Ports | dauerhaft | nur ergänzen; überholte Absätze als überholt markieren, nicht löschen |
| `CLAUDE.md` | lädt `AGENTS.md` + die Kontext-Dateien in jede Session | — | Verweise pflegen |
| `docs/CHANGELOG.md` | **jede** Änderung: Datum · Was · Warum · Agent | Vergangenheit | neue Einträge **unten**, nie löschen |
| `docs/DECISIONS.md` | Entscheidungs-Log (Index aller Entscheidungen) | dauerhaft | neue Einträge **oben**, nie löschen |
| `docs/decisions/` | ADRs für große Architektur-Entscheidungen | dauerhaft | eine Datei pro Entscheidung, nie nachträglich ändern; Revision = neuer ADR |
| `docs/RISKS.md` | Risiko-Register + offene Fragen (🔴/🟡/🟢) | laufend | Status ändern, Zeilen nie löschen |
| `TASKS.md` | abhakbare Schritte der laufenden Phase | nächste Schritte | Haken setzen, Schritte ergänzen, verworfene ~~durchstreichen~~ |
| `PROGRESS.md` | Scratchpad der gerade laufenden Aufgabe | jetzt | **einzige Datei, die überschrieben werden darf** |
| `docs/research/` | Recherche-Berichte (Input, nicht Wahrheit) | Referenz | Dateien hinzufügen, nie editieren |
| `docs/handover/` | Übergabe-Artefakte aus dem Boots-Projekt | Referenz | nie editieren; Änderungen laufen über eigene Migrationen |

Sitzungsbeginn: `PROGRESS.md` und `TASKS.md` lesen. Sitzungsende: beide aktualisieren, `docs/CHANGELOG.md`-Eintrag schreiben.

## Harte Regeln — nicht verhandelbar

1. **Additiv arbeiten, nie überschreiben.** Doku wird ergänzt, nicht umgeschrieben (Ausnahme: `PROGRESS.md`). Angewendete Migrationen werden nie editiert — Korrektur = neue Migration. Bestehender Code wird erweitert, nicht stillschweigend ersetzt; wer etwas entfernt, begründet es im CHANGELOG.
2. **CHANGELOG-Pflicht.** Jede Änderung (Code, Schema, Doku, Config) bekommt einen Eintrag in `docs/CHANGELOG.md`: Datum · Was · Warum · Agent. Auch reine Doku-Stände.
3. **`git diff` vor jedem Commit.** Diff zeigen, Marco bestätigt, dann **gezielt per Pfad** committen. Kein `git add .`, kein `git add -A`. Ein Schritt = ein Commit.
4. **Die Reserve-Logik ist unantastbar.** Die Überbuchungssperre in `reserve_departure_seats()` — das **eine** atomare `UPDATE tour_departures … WHERE … AND seats_booked_total + p_seats <= capacity_total` (Postgres-Row-Lock serialisiert konkurrierende Anfragen; die zweite auf den letzten Platz trifft 0 Zeilen → `SOLD_OUT`) — wird aus `docs/handover/reserve-function-final.sql` übernommen und **nie umgebaut**: Prüfung und Erhöhung bleiben ein einziges Statement, kein `SELECT`-dann-`UPDATE`, kein Anwendungs-Locking. Kanal-/Kontingent-Erweiterungen sind nur als **zusätzliche** Spalten und `WHERE`-Bedingungen erlaubt (Muster in der Datei dokumentiert). Jede Änderung an der Funktion braucht den Überbuchungstest (8 parallele Aufrufe auf 1 freien Platz → genau 1 Erfolg, 7× `SOLD_OUT`) **grün, bevor** committet wird.
5. **Bei Unsicherheit nicht raten.** Zahlen, Regeln, Beträge (Provision, Anzahlung, Kontingente, Rechtsfragen) kommen von Marco/Gabo. Fehlt ein Fakt: als offene Frage in `docs/RISKS.md` eintragen, nicht als Annahme in Code oder Text.
6. **Keine Cross-DB-Kopplung.** Keine Foreign Keys, keine gemeinsame Auth-Instanz, keine Queries gegen die Boots-DB, keine Replikation, kein gemeinsamer Service-Role-Key, keine gemeinsame `config.toml`. Was das Boots-Projekt braucht (Kontingent-Sperre), passiert **dort** durch Gabo — manuell (ADR-0001).
7. **Zahlungstyp exakt pro Buchung speichern** (Anzahlung vs. Vollzahlung, kassierter Betrag, offener Rest) — nicht nur die Kapazität. Sonst ist die Abrechnung mit dem Boot am Saisonende nicht rekonstruierbar.
8. **Ein Schritt gilt erst als erledigt, wenn er verifiziert ist** (Test gelaufen, Build grün, im Browser gesehen) — nicht, wenn der Code geschrieben ist. Kein Haken ohne Beleg.
9. **Keine echten Secrets, keine echten Kundendaten im Repo.** Lokale Instanz enthält nur Test-/Seed-Daten. `.env.local`-Dateien sind gitignored; Vorlagen (`*.example`) sind leer.
10. **Boots-Projekt nicht anfassen.** Aus diesem Repo heraus werden keine Dateien in `C:\Projects\MyMallorcaExperience` geändert. Lesen zur Referenz ist erlaubt.

## Tech-Stack

Next.js 16.3 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres 17, Auth, lokale CLI-Instanz) · Deployment und Zahlungskonto: offen (`docs/RISKS.md`).

**Next.js 16 ist nicht das Next.js aus dem Trainingswissen.** Vor jedem Code-Schritt den passenden Guide in `node_modules/next/dist/docs/` lesen (Block oben in dieser Datei).

## Lokale Umgebung — Ports (Kollisionsfrei zur Boots-Instanz)

| Dienst | Boots (`project_id "web"`) | **mmb-promoter** |
|---|---|---|
| Next.js Dev-Server | 3000 | **3001** (`npm run dev`) |
| Supabase API (Kong) | 54321 | **45321** |
| Postgres | 54322 | **45322** (Shadow-DB 45320, Pooler 45329) |
| Studio | 54323 | **45323** |
| Mail (Inbucket/Mailpit) | 54324 | **45324** (SMTP 45325, POP3 45326) |
| Analytics | 54327 | **45327** |
| Edge-Runtime-Inspector | 8083 | **8084** |

- **Warum 453xx und nicht 553xx (ursprünglicher Plan):** Windows/Hyper-V reserviert auf diesem Rechner dynamisch große Blöcke ab 49152 (am 16.09.2026 u. a. 55265–55364 → `supabase start` scheiterte mit „bind: access permissions" auf 55322). Der Bereich 45320–45329 liegt **unterhalb** des dynamischen Bereichs (Start 49152, `netsh int ipv4 show dynamicport tcp`) und kann nicht reserviert werden. Prüfen bei Portproblemen: `netsh interface ipv4 show excludedportrange protocol=tcp`.
- `supabase/config.toml`: `project_id = "mmb-promoter"` → Container heißen `supabase_*_mmb-promoter`, Volumes ebenso. Beide Instanzen können gleichzeitig laufen.
- **JWT-Secret** ist eigenständig: `jwt_secret = "env(SUPABASE_AUTH_JWT_SECRET)"`, Wert in `supabase/.env.local` (gitignored, Vorlage `supabase/.env.example`). Ohne diese Datei startet die Instanz nicht — das ist gewollt.
- Befehle: `supabase start` · `supabase status` (Keys für `.env.local`) · `supabase stop` · `supabase db reset` (spielt `supabase/migrations/*.sql` neu ein).
- Migrationen: `supabase/migrations/NNNN_name.sql`, ab `0001`, nur additiv.

## Was NICHT das Ziel ist

- Ein zweites Boots-Projekt. Hier gibt es keine öffentliche Buchungsseite, keinen Online-Kanal.
- Automatischer Abgleich mit dem Boots-Inventar. Kontingente werden von Gabo manuell zugeteilt (ADR-0001).
- Features vor dem Fundament. Erst Etappenplan mit Marco, dann bauen.
