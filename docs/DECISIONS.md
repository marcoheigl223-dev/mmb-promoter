# DECISIONS.md — Entscheidungs-Log mmb-promoter

Format: Datum · Entscheidung · Begründung. **Neue Einträge oben anhängen**, alte nie löschen. Große Architektur-Entscheidungen bekommen zusätzlich einen ADR in `docs/decisions/` — hier steht dann nur der Kurz-Eintrag mit Verweis (Regel in `docs/decisions/README.md`).

---

**16.09.2026 — `capacity_total` IST das Kontingent; Etappenplan E1–E8 bestätigt**

Entscheidung (Marco, 16.09.2026): In dieser Datenbank ist `tour_departures.capacity_total` das Kontingent, das Gabo pro Termin/Event manuell einträgt. Eine andere Kapazität (Bootskapazität, Online-Anteil) kennt dieses System nicht. Die Überbuchungssperre der Handover-Funktion (`seats_booked_total + p_seats <= capacity_total` im atomaren UPDATE) wirkt damit **unverändert** gegen das Kontingent — **keine Zusatzlogik, keine zusätzliche Spalte, keine zusätzliche WHERE-Bedingung** nötig. Der Etappenplan in `TASKS.md` Phase 1 (E1 Sicherheitsnetz als Gate, danach E2–E8) ist bestätigt. Die Risiken Nr. 21–23 und die Fragen F11/F12 werden vor Etappe 5 geklärt, für Etappe 1 sind sie nicht nötig.

Begründung: Das vermeidet genau die Schema-Durchdringung (Quota-Spalten, Doppelzähler), an der das Modul im Boots-Projekt gescheitert ist, und hält Hard Rule 4 trivial ein: Die Funktion wird byteidentisch übernommen.

---

**16.09.2026 — Geschäftsregeln: Anzahlung, Provision, 10+1-Gruppenregel, Kontingent (von Marco festgelegt)**

Entscheidung (verbindlich, Quelle: Marco, 16.09.2026 — ersetzt die offenen Fragen F1, F2, F3, F5 in `docs/RISKS.md`):

1. **Anzahlung: 30 € pro Person/Ticket**, nicht pro Buchung. Beispiel: 3 Personen = 90 € Anzahlung, Rest wird im Bus kassiert. Konsequenz: Der Bestätigungsschritt im Verkaufs-Flow zeigt Anzahlung = Personen × 30 € und den offenen Rest ausgeschrieben; beide Beträge werden pro Buchung gespeichert (Hard Rule 7).
2. **Provision: 10 € fest pro Ticket.** Der Betrag ist **im Promo-Dashboard durch Gabo änderbar** — nicht hart im Code, nicht in einer Migration als Konstante. **Interne Events dürfen davon abweichen** (eigener Provisionsbetrag pro Event). Konsequenz: Provisionsregel als Datensatz (Standard + Ausnahme pro Termin/Event), und pro Buchung wird der zum Verkaufszeitpunkt gültige Betrag als **Snapshot** gespeichert, damit spätere Änderungen im Dashboard die Historie nicht umschreiben (RISKS Nr. 21).
3. **10+1-Gruppenregel: ab 11 Personen ist 1 Person gratis; Provision wird für 10 gezahlt.** Die Regel ist **durch Gabo pflegbar** (Schwelle und Anzahl Gratisplätze nicht hart codiert). Konsequenz: Der Gratisplatz belegt trotzdem Kontingent (11 Sitze werden reserviert), bezahlt und provisioniert werden 10. Offen: ob die Anzahlung für 10 oder 11 Personen fällig ist (F11).
4. **Kontingent: Gabo trägt im Promo-Dashboard manuell pro Termin/Event ein Kontingent ein.** Promoter verkaufen **atomar** gegen dieses Kontingent (Reserve-Funktion, Hard Rule 4). **Keine Cross-DB-Kopplung** — dieses System erfährt nichts automatisch aus der Boots-DB; die Sperre der Plätze auf der Boots-Seite bleibt Gabos manueller Schritt dort (ADR-0001).
5. **Storno-Provision: bewusst OFFEN.** Ob und wie Provision bei Stornierung entfällt/zurückgerechnet wird, ist nicht entschieden und wird **nicht erfunden** — offene Frage F10 in `docs/RISKS.md`. Bis zur Klärung kommt keine Storno-Provisionslogik in Code oder Migration.

Begründung: Marcos Vorgaben vom 16.09.2026 nach Rücksprache mit Gabo. Die Regeln waren zuvor nur unbestätigt aus dem Boots-`TASKS.md` bekannt (RISKS Nr. 15). Nichts davon ist bisher in Code oder Schema — die Verankerung hier geht der Datenmodell-Etappe voraus.

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
