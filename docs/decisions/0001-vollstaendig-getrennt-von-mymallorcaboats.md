# ADR-0001 — Vollständig getrennt von MyMallorcaBoats: eigene DB, manuelle Kontingent-Zuteilung durch Gabo, keine Cross-DB-Kopplung

- **Status:** Angenommen
- **Datum:** 16.09.2026 (Ursprungs-Entscheidung 14.09.2026 im Boots-Projekt; Repo-Form 15.09.2026)
- **Entscheider:** Marco
- **Betrifft:** Gesamtarchitektur, Datenbank, Auth, Deployment, Repo-Struktur

## Kontext

Das Promoter-/Vertriebssystem war im Boots-Projekt (MyMallorcaBoats, `C:\Projects\MyMallorcaExperience`) ursprünglich als rollenbasiertes Modul in derselben Codebasis geplant (Entscheidung dort vom 01.09.2026). In der Umsetzung zeigte sich, dass es kein Modul war, sondern Schema-Durchdringung: Promoter-Spalten, Enum-Werte und Constraints lebten innerhalb der Boots-Tabellen (ca. 85 % Schema, 15 % Anwendungscode; Diagnose dort vom 14.09.).

Am 14.09.2026 wurde diese Entscheidung im Boots-Projekt vollständig umgekehrt (`docs/DECISIONS.md` dort). Am 15.09. legte Marco fest: **zwei getrennte Repos**, kein Monorepo. In Phase 1 des Boots-Projekts (15./16.09., Commits `3109a01`–`0eab552`) wurde das Promoter-System dort herausgeschnitten: Migrationen 0004–0006, 28 Anwendungsdateien entfernt, Beweis per Schema-Diff. Die bereinigte Reservierungsfunktion wurde als Übergabe-Artefakt eingefroren (`docs/schema-snapshots/reserve-function-final.sql` dort → hier `docs/handover/reserve-function-final.sql`).

Zwänge und Fakten:
- Zum Zeitpunkt des Schnitts gab es **0 Buchungen** in der Boots-DB — keine Daten zu migrieren.
- Rechtliche Begründung (Recherche vom 14.09., `docs/research/`, **kein Rechtsrat**): unterschiedliche Verantwortliche und Verarbeitungszwecke (DSGVO), spanisches Handelsvertreterrecht (Ley 12/1992) für die Promoter, offene Lizenzfrage touristische Vermittlung (Ley 8/2012 Balearen). Getrennte Datenbestände sind Haftungs- und Nachweisgrenze.
- Die Überbuchungsgarantie der Boots-DB (`reserve_departure_seats()`, Postgres-Row-Lock, mit 8 parallelen Requests getestet) gilt nur **innerhalb** einer Datenbank.

## Betrachtete Optionen

1. **Modul in derselben Codebasis/DB (Stand 01.09.)** — Echtzeit-Inventar über einen Zähler; ein Deployment. Nachteile: rechtliche Vermischung, Schema-Durchdringung, ein Ausfall trifft beides, keine getrennte Marke. **Überholt.**
2. **Monorepo (pnpm/Turborepo) mit `packages/core`, aber getrennte DBs** — Code-Wiederverwendung über ein Package, Daten getrennt. Nachteil: gemeinsame Toolchain koppelt Release-Zyklen; Marco hat sich am 15.09. dagegen entschieden.
3. **Zwei getrennte Repos, zwei DBs, Wiederverwendung nur über versionierte Dateien (SQL + ggf. TS)** — vollständige Entkopplung, minimale gemeinsame Oberfläche. Nachteil: doppelter Pflegeaufwand; Auseinanderlaufen des geteilten Codes muss bewusst beobachtet werden.
4. **Zwei Projekte mit Cross-DB-Kopplung** (gemeinsame Auth, Foreign Data Wrapper, Replikation, gemeinsamer Service-Role-Key) — technisch verlockend für eine Gesamtsicht. Nachteil: hebt die rechtliche Trennung faktisch auf, schafft einen zweiten Weg zur Überbuchung und einen gemeinsamen Ausfallpunkt.

## Entscheidung

**mmb-promoter ist ein vollständig eigenständiges Projekt: eigene Datenbank (eigene Supabase-Instanz lokal und in der Cloud), eigene Domain, eigenes Login (eigene Auth-Instanz), eigenes Deployment, eigenes Repo, später eigenes Zahlungskonto.** Option 3.

Im Einzelnen:
1. **Keine Cross-DB-Kopplung.** Keine Foreign Keys, keine gemeinsame Auth-Instanz, keine Queries gegen die Boots-DB, keine Replikation, kein Foreign Data Wrapper, kein gemeinsamer Service-Role-Key, keine gemeinsame `config.toml`, keine gemeinsamen Env-Dateien.
2. **Manuelle Kontingent-Zuteilung durch Gabo.** Gabo legt pro Abfahrt fest, wie viele Plätze an das Promoter-Netzwerk gehen. Diese Plätze werden im Boots-Projekt herausgenommen (dort offen: harte Sperre gegen den Online-Verkauf) und hier als Kontingent eingetragen. Dieses Projekt verkauft **ausschließlich gegen sein eigenes Kontingent**. Es gibt **keinen automatischen Abgleich** zwischen beiden Systemen.
3. **Wiederverwendung nur über geteilten Code.** Die bewährte Reservierungsfunktion wird aus `docs/handover/reserve-function-final.sql` in eine eigene Migration dieses Projekts übernommen und dort um Kontingent-/Kanal-Spalten **additiv** erweitert (Hard Rule 4). TypeScript-Bausteine werden bei Bedarf als Datei kopiert und hier versioniert — nie als Paket aus dem Boots-Repo bezogen.
4. **Lokale Entwicklung:** eigene Supabase-Instanz mit `project_id "mmb-promoter"`, eigenen Ports (4532x statt 5432x), eigenem JWT-Secret; Dev-Server 3001 statt 3000. Beide Instanzen laufen gleichzeitig.

## Begründung

Ausschlaggebend ist die **rechtliche Trennung**, nicht eine technische Präferenz: Sobald die beiden Geschäfte (öffentliche Vermittlung vs. Promoter-Netzwerk) unterschiedliche Verantwortliche, Zwecke und ggf. Lizenzpflichten haben, ist jede Datenkopplung eine Haftungsbrücke. Option 4 hätte die Trennung nur auf dem Papier. Option 2 wurde von Marco verworfen; Option 3 ist die Form mit der kleinsten gemeinsamen Oberfläche. Das frühere Gegenargument („Echtzeit-Sync müsste doppelt gebaut werden") entfällt durch die manuelle Zuteilung — es gibt keine Echtzeit-Sync mehr.

## Konsequenzen

- **Positiv:** Klare Haftungs- und Datengrenze; eigene Marke/Domain; Ausfall oder Umbau des einen Projekts berührt das andere nicht; kein gemeinsamer Secret-Raum; dieses Projekt startet mit leerem, sauberem Schema (nur was Vertrieb braucht).
- **Negativ / bewusst in Kauf genommen:** Doppelter Pflegeaufwand (Deployments, Env-Sätze, Rechtstexte, `config.toml`). Die Überbuchungsgarantie wechselt ihre Natur: nicht mehr ein gemeinsamer Zähler, sondern **disjunkte Kontingente** — eine Daten-Eigenschaft statt einer Code-Eigenschaft. Sie hält nur, wenn das Boots-Projekt das zugeteilte Kontingent hart sperrt (dort offen, RISKS Nr. 1 hier). Es gibt keine Tabelle mehr, die „verkauft insgesamt" beantwortet (RISKS Nr. 14, Frage F6).
- **Auswirkung auf die Hard Rules:** Nr. 4 (Reserve-Logik unantastbar) — die Funktion wird übernommen, nicht umgebaut; Nr. 6 (keine Cross-DB-Kopplung) — ist diese Entscheidung; Nr. 7 (Zahlungstyp exakt) — bleibt Pflicht, weil die Abrechnung mit dem Boot künftig aus zwei Exporten zusammengesetzt wird.
- **Folgearbeiten** (→ `TASKS.md`): Übergabe-Artefakt ablegen; Etappenplan mit Marco; Migration 0001 mit übernommener Reserve-Funktion + Kontingent; Überbuchungstest; Klärung F1–F9 in `docs/RISKS.md`; im Boots-Projekt die harte Kontingent-Sperre (nicht von hier aus).

## Verifikation

- `supabase/config.toml` enthält keine Referenz auf die Boots-Instanz; `docker ps` zeigt beide Instanzen mit getrennten Container-Namen und Ports (16.09.2026: bestätigt).
- Das Schema dieses Projekts enthält keinen Foreign Data Wrapper, keine `dblink`-Extension, keine Verbindung zur Boots-DB (bei jedem Schema-Snapshot prüfen).
- `grep` über das Repo findet keine Boots-URL, keinen Boots-Key, keine Boots-Ports (543xx) außerhalb der Doku-Tabellen.
- Überbuchungstest hier: 8 parallele Reservierungen auf 1 Kontingent-Platz → 1 Erfolg, 7× `SOLD_OUT`.

## Verweise

- `docs/DECISIONS.md`, Eintrag vom 16.09.2026 (Index-Eintrag zu diesem ADR)
- Boots-Projekt: `docs/DECISIONS.md` Eintrag vom 14.09.2026 („UMKEHRUNG der Entscheidung vom 01.09."); `TASKS.md` Phase 1 + Phase 2; `docs/DIAGNOSE_VOLLSTAENDIG.md`; Commits `3109a01`–`0eab552`
- `docs/research/` — Recherchebericht Trennung (Recht/Technik/Risiken) und technischer Umsetzungsplan (Polyrepo, Ports, JWT-Secret)
- `docs/handover/reserve-function-final.sql` — Übergabe-Artefakt
