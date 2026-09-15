# TASKS.md — Schritt-für-Schritt-Liste

**Angelegt 16.09.2026 (Fundament).** Die konkreten, einzeln abhakbaren Schritte der aktuellen Phase — gröber als `PROGRESS.md`, feiner als der Etappenplan. Ein Schritt ist so geschnitten, dass er **einen eigenen Commit** ergibt.

## Regeln für diese Liste

1. Ein Schritt = eine abgeschlossene, prüfbare Änderung = ein Commit (gezielt per Pfad, kein `git add .`).
2. Vor jedem Commit `git diff` zeigen, danach Eintrag in `docs/CHANGELOG.md` (Hard Rule 2/3).
3. Erledigte Schritte werden **abgehakt, nicht gelöscht** (Hard Rule 1).
4. Ein Schritt wird erst abgehakt, wenn er **verifiziert** ist (Hard Rule 8).
5. Neue Schritte unten in der jeweiligen Phase ergänzen. Verworfene bleiben ~~durchgestrichen~~ mit Begründung stehen.

## Legende

`[ ]` offen · `[x]` erledigt + verifiziert · `[~]` läuft · `[!]` blockiert (Grund dahinter)

---

## Phase 0 — Fundament + Doku (Auftrag Marco, 16.09.2026)

Kein Feature, keine Migration, kein Schema.

- [x] **Schritt 1 — Doku-System angelegt** · `AGENTS.md` (Projektregeln), `CLAUDE.md`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `PROGRESS.md`, `TASKS.md`, `docs/decisions/` (README, Vorlage, ADR-0001), `docs/research/`, `docs/handover/` (je README mit Ablage-Anweisung)
- [x] **Schritt 2 — Lokale Supabase-Instanz** · `supabase init`, `project_id "mmb-promoter"`, Ports 4532x (Abweichung von 5532x begründet in `docs/DECISIONS.md`), eigenes JWT-Secret via `env()`, `supabase start` + `supabase status` erfolgreich, Boots-Instanz lief parallel
- [x] **Schritt 3 — Dev-Server auf 3001** · `package.json` `dev`/`start` mit `-p 3001`; `.env.local.example`; `.gitignore`-Ausnahmen für Vorlagen
- [ ] **Schritt 4 — Erster Commit** · `git diff` gezeigt, gezielt per Pfad committet (Hash in `docs/CHANGELOG.md` nachtragen)

## Manuelle Schritte für Marco (16.09.2026)

Diese Handgriffe macht Claude nicht selbst (Dateien außerhalb des Repos).

- [ ] **M1 — Übergabe-Artefakt kopieren:** `C:\Projects\MyMallorcaExperience\docs\schema-snapshots\reserve-function-final.sql` → `docs/handover/reserve-function-final.sql` (Name unverändert)
- [ ] **M2 — Recherche 1 kopieren:** `C:\Projects\MyMallorcaExperience\docs\compass_artifact_wf-2f7d398a-fb7e-5fbc-9aaf-c68477b70532_text_markdown.md` → `docs/research/2026-09-14_trennung-recht-technik-risiken.md`
- [ ] **M3 — Recherche 2 kopieren:** `C:\Users\marco\Downloads\compass_artifact_wf-ec5cc706-def8-5177-a5af-4fd72113ca25_text_markdown.md` → `docs/research/2026-09_technischer-umsetzungsplan-trennung.md`
- [ ] **M4 (optional) — alten Boots-Etappenplan als Referenz:** `C:\Projects\MyMallorcaExperience\docs\PROMOTER_SYSTEM_PLAN.md` → `docs/research/2026-09-06_promoter-system-plan_boots.md`
- [ ] **M5 — `.env.local` anlegen:** `.env.local.example` kopieren, Werte aus `supabase status` eintragen (ANON_KEY → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, SERVICE_ROLE_KEY → `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] **M6 — GitHub-Remote setzen** (`git remote add origin …`), sobald das Repo auf GitHub existiert
- [ ] **M7 — Offene Fragen F1–F9 in `docs/RISKS.md` beantworten** (mindestens F1, F2, F5 vor der Datenmodell-Etappe)

Nach M1–M3: Index-Tabellen in `docs/research/README.md` und `docs/handover/README.md` nachtragen, RISKS Nr. 19 auf 🟢.

## Phase 1 — Etappenplanung (offen, mit Marco)

Wird gemeinsam festgelegt. Vorschlag zur Diskussion (nicht beschlossen):

- [ ] **E1 — Sicherheitsnetz zuerst:** Vitest + Skript-Runner; Migration `0001` mit **unverändert** übernommener `reserve_departure_seats()` aus `docs/handover/` + eigenen Kontingent-Spalten; Überbuchungstest 8-parallel grün (RISKS Nr. 2/3/8)
- [ ] **E2 — Rollen + Auth:** Profile mit Rollen `admin` (Gabo) / `promoter`; Login; Proxy-Schutz; Test „Promoter kommt nicht ins Admin"
- [ ] **E3 — Admin: Touren/Abfahrten/Kontingente pflegen** (manuelle Zuteilung, ADR-0001)
- [ ] **E4 — Admin: Promoter-Accounts** (Anlegen, Deaktivieren, Passwort neu)
- [ ] **E5 — Promoter: Verkaufen** gegen Kontingent, Anzahlung/Vollzahlung, Bestätigungsschritt, Idempotenz (RISKS Nr. 10/11)
- [ ] **E6 — Provision** (Regeln durch Gabo, Snapshot pro Buchung) — erst nach F2/F3
- [ ] **E7 — Promoter: Historie/Provision/Statistik**; **Admin: Auswertung + CSV-Export** (F6)
- [ ] **E8 — Verifikation + Doku**, Cloud-Instanz/Deployment (F7)
