# CHANGELOG.md — Änderungsprotokoll mmb-promoter

Format: Datum · Was · Warum · Agent. **Neue Einträge unten anhängen** (chronologisch aufsteigend), nie löschen, nie überschreiben (Hard Rule 2, `AGENTS.md`). Auch reine Doku- und Config-Stände werden protokolliert.

Verweise auf Dateien immer mit Pfad; Commits mit Kurz-Hash, sobald bekannt.

---

**16.09.2026 — Projekt-Fundament: Doku-System, lokale Supabase-Instanz mit eigenen Ports, Dev-Server 3001**

Was:
- Doku-System nach dem Muster des Boots-Projekts angelegt: `AGENTS.md` (Projektregeln, additiv unter dem von `next dev` erzeugten Next.js-Block), `CLAUDE.md` (lädt `AGENTS.md`, `docs/DECISIONS.md`, `docs/RISKS.md`, `PROGRESS.md`, `TASKS.md`), `docs/README.md`, `docs/CHANGELOG.md` (diese Datei), `docs/DECISIONS.md`, `docs/RISKS.md`, `PROGRESS.md`, `TASKS.md`, `docs/decisions/` (README, Vorlage `0000-template.md`, **ADR-0001** „vollständig getrennt von MyMallorcaBoats"), `docs/research/` und `docs/handover/` (je README mit Ablage-Anweisung für Marco).
- `supabase init` → `supabase/config.toml` mit `project_id = "mmb-promoter"`. Ports auf **45321** (API), **45322** (DB; Shadow 45320, Pooler 45329), **45323** (Studio), 45324 (Mail), 45327 (Analytics), Inspector 8084 gesetzt. `site_url`/`additional_redirect_urls` auf `127.0.0.1:3001` bzw. `localhost:3001`. Eigenes JWT-Secret über `jwt_secret = "env(SUPABASE_AUTH_JWT_SECRET)"`, Wert in `supabase/.env.local` (gitignored; per `openssl rand -hex 32` erzeugt), Vorlage `supabase/.env.example`.
- `package.json`: `dev` → `next dev -p 3001`, `start` → `next start -p 3001`.
- `.env.local.example` (Root) mit den 4532x-URLs; `.gitignore` um `!.env.local.example` / `!.env.example` ergänzt, damit die Vorlagen ins Repo dürfen, echte `.env*`-Dateien aber ignoriert bleiben.
- Lokale Instanz gestartet und mit `supabase status` verifiziert (Ergebnis siehe `PROGRESS.md`).

Abweichung vom Auftrag, bewusst: Marco hatte **55321/55322/55323** vorgegeben. Der erste `supabase start` scheiterte auf 55322 („bind: An attempt was made to access a socket in a way forbidden by its access permissions"). Ursache: Windows/Hyper-V reserviert auf diesem Rechner große Blöcke im dynamischen Bereich ab 49152 — am 16.09. u. a. 54865–55764 nahezu durchgehend (`netsh interface ipv4 show excludedportrange protocol=tcp`). 45320–45329 liegt unterhalb des dynamischen Bereichs (Start 49152), ist frei und kann nicht dynamisch reserviert werden. Trennung zur Boots-Instanz (543xx) bleibt gewahrt. Eintrag dazu in `docs/DECISIONS.md`.

Nicht gemacht: keine Migration, kein Schema, keine Feature-Datei, kein Test — laut Auftrag Fundament zuerst. `src/app/*` ist unverändert das Create-Next-App-Gerüst.

Warum: Marcos Auftrag vom 16.09.2026 — Fundament + Doku vor jedem Feature; Trennung vom Boots-Projekt (ADR-0001) verlangt eigene Instanz, eigene Ports, eigenes Secret.

Agent: Claude (Session mit Marco).

Commit: `8c434d6` (gezielt per Pfad; `supabase/.env.local` nicht enthalten, geprüft mit `git ls-files`). Zusätzlich verifiziert: `next dev -p 3001` meldet „Ready", Ausgabe `Local: http://localhost:3001`.
