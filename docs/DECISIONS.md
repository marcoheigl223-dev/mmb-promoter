# DECISIONS.md — Entscheidungs-Log mmb-promoter

Format: Datum · Entscheidung · Begründung. **Neue Einträge oben anhängen**, alte nie löschen. Große Architektur-Entscheidungen bekommen zusätzlich einen ADR in `docs/decisions/` — hier steht dann nur der Kurz-Eintrag mit Verweis (Regel in `docs/decisions/README.md`).

---

**16.09.2026 — Lokale Ports 4532x statt der beauftragten 5532x**

Entscheidung: Die lokale Supabase-Instanz läuft auf 45321 (API), 45322 (DB), 45323 (Studio), 45324 (Mail), 45327 (Analytics), Shadow-DB 45320, Pooler 45329, Edge-Inspector 8084. Dev-Server 3001. Boots bleibt auf 543xx / 3000.

Begründung: 55322 ist auf Marcos Rechner durch Windows/Hyper-V reserviert (Ausschlussbereich 55265–55364, dazu fast alles zwischen 54865 und 55764). Diese Reservierungen werden dynamisch ab Port 49152 vergeben und können sich nach einem Neustart verschieben — jeder Port oberhalb 49152 kann irgendwann getroffen werden. 45320–45329 liegt unterhalb des dynamischen Bereichs und ist dauerhaft sicher. Der Zweck der Vorgabe (keine Kollision mit der Boots-Instanz) ist erfüllt. Falls Marco die 553xx-Ports ausdrücklich will: `netsh int ipv4 set dynamicport tcp start=…` verschiebt den dynamischen Bereich (Admin + Neustart) — bewusst nicht ohne sein OK gemacht.

---

**16.09.2026 — JWT-Secret der lokalen Instanz aus `supabase/.env.local`, nicht hart in `config.toml`**

Entscheidung: `jwt_secret = "env(SUPABASE_AUTH_JWT_SECRET)"`; Wert gitignored in `supabase/.env.local`, leere Vorlage `supabase/.env.example` im Repo.

Begründung: Marco verlangt ein **eigenes** Secret (nicht das Boots-/CLI-Default). Ein hart eingetragenes Secret in einer committeten Datei widerspricht Hard Rule 9. Die CLI 2.108 löst `env(...)`-Referenzen auf und lädt `supabase/.env.local` — mit `supabase start` verifiziert (die Instanz kam bis zum DB-Start, erst der Port scheiterte; nach Port-Wechsel läuft sie). Konsequenz: Auf einem anderen Rechner muss die Datei vorher angelegt werden, sonst startet die Instanz nicht (RISKS Nr. 5). Für die spätere Cloud-Instanz gilt ein dort erzeugtes, anderes Secret.

---

**16.09.2026 — Doku-System nach Boots-Muster, mit zwei Abweichungen**

Entscheidung: Gleiche Schichten wie im Boots-Projekt (`CHANGELOG` unten anhängen, `DECISIONS` oben, `RISKS` mit Ampel, `PROGRESS` als Scratchpad, `TASKS` als Haken-Liste, `docs/decisions/` für ADRs). Abweichungen: (1) Die Projektregeln stehen in `/AGENTS.md` statt `docs/CLAUDE.md`, weil `next dev` diese Datei ohnehin anlegt und pflegt — eine zweite Regel-Datei wäre eine zweite Wahrheitsquelle. (2) Zwei neue Ordner `docs/research/` (Recherchen) und `docs/handover/` (Übergabe-Artefakte aus dem Boots-Projekt), damit im `docs/`-Ordner nicht wie im Boots-Projekt Hunderte lose Dateien liegen.

Begründung: Marcos Auftrag vom 16.09. („mehrschichtiges Doku-System wie im Boots-Projekt"). Das Boots-Projekt hatte anfangs zwei CHANGELOGs mit gegenläufiger Richtung — hier von Anfang an genau eines.

---

**16.09.2026 — ADR-0001: Vollständig getrennt von MyMallorcaBoats** → `docs/decisions/0001-vollstaendig-getrennt-von-mymallorcaboats.md`

Kurzfassung: Eigene Datenbank, eigene Domain, eigenes Login, eigenes Deployment, eigenes Repo. Manuelle Kontingent-Zuteilung durch Gabo. Keine Cross-DB-Kopplung (keine FKs, keine gemeinsame Auth, keine Cross-Queries, keine Replikation, kein gemeinsamer Service-Role-Key). Wiederverwendung nur über geteilten Code (`docs/handover/reserve-function-final.sql`), nie über Daten. Ursprung: Entscheidung vom 14.09.2026 im Boots-Projekt (`docs/DECISIONS.md` dort), Repo-Form „zwei getrennte Repos" von Marco am 15.09.2026 festgelegt. Status: **Angenommen.**
