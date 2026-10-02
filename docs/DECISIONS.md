# DECISIONS.md — Entscheidungs-Log mmb-promoter

Format: Datum · Entscheidung · Begründung. **Neue Einträge oben anhängen**, alte nie löschen. Große Architektur-Entscheidungen bekommen zusätzlich einen ADR in `docs/decisions/` — hier steht dann nur der Kurz-Eintrag mit Verweis (Regel in `docs/decisions/README.md`).

---

**02.10.2026 — E5.2 Eventvorlagen: Vorlage = editierbare Stammdaten, „Event aus Vorlage" kopiert die Werte, nur `network_operator`, deaktivieren statt löschen (Migration `0007_event_templates.sql`)**

Entscheidung (Marco, Auftrag 02.10.2026: „Gabo speichert eine Vorlage (Titel, Beträge/Anzahlung, Ticketzahl/Kontingent, Provision, später Bild) und legt daraus neue Events an, bei denen er nur Datum/Uhrzeit ändert. Additiv, RLS deny-by-default (nur network_operator schreibt), als DB-Daten."; Ausgestaltung Claude):

1. **Reihenfolge geändert:** Eventvorlagen sind jetzt **E5.2 / Migration 0007** (im Plan vom 30.09. waren sie E5.8 / 0011). Der frühere Schritt E5.2 „Anzahlungsbasis + 10+1-Option" rückt nach hinten, bis F11/F16/F18 entschieden sind; die Nummern der Folge-Migrationen verschieben sich entsprechend.
2. **Eine Vorlage ist ein Datensatz in `event_templates`** mit `name` (Bezeichnung für Gabos Liste) **und** `title` (der Titel, den das Event bekommt) — beide Pflicht, kein Eindeutigkeits-Zwang auf den Namen (zwei Vorlagen dürfen gleich heißen; Gabo unterscheidet sie selbst). Dazu Kontingent, `is_internal`, Notiz und drei optionale Beträge (Ticketpreis, Anzahlung, Provision; **NULL = Standard**, derselbe Sinn wie leere Felder am Termin).
3. **Vorlagen sind editierbare Stammdaten, kein append-only** (Plan D7): Sie tragen keine Abrechnungs-Historie; die kommt aus den Snapshots pro Buchung (0006) und den append-only-Regeln (0004/0005). Änderungen an einer Vorlage betreffen deshalb nur künftige Events.
4. **„Event aus Vorlage" kopiert** (`create_departure_from_template()`, eine Transaktion): Termin-Zeile mit Titel/Kontingent/intern/Notiz + `template_id` als Herkunft, und für jeden gesetzten Betrag eine Ausnahme-Zeile in `pricing_rules` bzw. `commission_rules` — exakt wie beim Anlegen von Hand. **Kein Live-Bezug:** Eine spätere Vorlagen-Änderung ändert kein bestehendes Event; `template_id` ist nur Information (nur INSERT-Grant, `on delete set null`).
5. **Die Funktion ist `security invoker`:** Sie schafft keine Rechte, die Policies und Spalten-Grants aus 0004/0005/0007 gelten unverändert für Gabos Session. Ein Promoter bekommt `NOT_ALLOWED` (42501), bevor etwas geschrieben wird.
6. **Nur `network_operator` sieht und pflegt Vorlagen** (SELECT/INSERT/UPDATE auf Pflege-Spalten, Policies mit `created_by = auth.uid()`). Promoter brauchen sie nicht — sie sehen Events, nicht deren Herkunft. **Kein DELETE-Grant:** `active = false` statt löschen; eine deaktivierte Vorlage erzeugt keine Events (`TEMPLATE_INACTIVE`), bleibt aber als Herkunft lesbar.
7. **Plausibilität Anzahlung ≤ Preis** zweistufig wie beim Termin: DB-Check nur, wenn beide Beträge in der Vorlage stehen; die App prüft zusätzlich gegen den Standard, wenn nur einer gesetzt ist (DECISIONS 30.09., Punkt 4). Ein Standard, der sich später ändert, wird beim Anlegen des Events erneut mit den dann gültigen Werten wirksam — nicht beim Speichern der Vorlage.
8. **Nicht enthalten, nicht geraten (Hard Rule 5):** Bild („später Bild" → E5.7 mit Storage-Bucket, F19), Anzahlungsbasis/Gesamtbetrag (F16), 10+1-Mehrfachblock und Anzahlung beim Gratisplatz (F11/F18), keine Startwerte — Vorlagen legt Gabo selbst an.

Begründung: Marcos Auftrag (oben), Plan `docs/ETAPPE5_PLAN.md` D7 („Werte werden kopiert"), Hard Rules 1 (0001–0006 unberührt), 4 (Reserve-Funktion nicht angefasst, 8-parallel-Test grün), 5, 8 (18 RLS-/Funktionstests + Round-Trip durch die Server Actions, `npm test` 167/167).

---

**02.10.2026 — Etappe 5 freigegeben: vier Entscheidungen Marco (Zahlart frei wählbar, Zahlungsstatus manuell, alle Events sichtbar, Storno nur Gabo) + Ausgestaltung E5.1 (Datenmodell, Migration `0006_promoter_sales_model.sql`)**

Entscheidung (Marco, 02.10.2026 — Freigabe von `docs/ETAPPE5_PLAN.md`, D1–D8 bestätigt; verbindlich):

1. **Zahlart frei pro Verkauf:** Der Promoter wählt bei jedem Verkauf zwischen **Vollzahler** und **Anzahlung**. Kein Event schreibt eine Zahlart vor → **F17 beantwortet: nein**, kein `full_only`-Wert, keine Radio-Sperre im Verkaufs-Flow.
2. **Zahlungsstatus manuell:** Der Promoter markiert selbst „**Anzahlung erhalten**" bzw. „**voll bezahlt**". Ein echtes Zahlungssystem kommt später; bis dahin ist der Status eine manuelle Angabe und **jede Änderung steht im Audit-Log**.
3. **Promoter sehen ALLE freigegebenen Events** — auch interne (`is_internal`). Das Flag bleibt Kennzeichnung (kein öffentlicher Kanal), es versteckt nichts vor dem Netzwerk.
4. **Storno ist Teil von E5:** Der Promoter kann **nicht** stornieren (nur Anzeige). **Nur Gabo (`network_operator`) storniert im Admin-Bereich** — mit Sitz-Freigabe zurück ins Kontingent und Audit-Log-Zeile. **Keine Rückerstattung**, außer wenn **wir** das Event absagen. (Provision beim Storno bleibt F10 — nicht Teil dieser Entscheidung.)

Ausgestaltung E5.1 (Claude, Migration `0006_promoter_sales_model.sql`, nur Strukturen — Funktionen folgen in E5.3):

a. **Ein Promoter-Verkauf ist eine `bookings`-Zeile mit `channel = 'promoter'`** (Plan D5) — keine zweite Tabelle `promoter_sales`. Grund: Kontingent-Zähler, Beträge und Buchung bleiben an einem Ort; ein zweiter Bestand könnte vom Zähler in `tour_departures` abweichen; die Handover-Funktion schreibt in dieselbe Tabelle (`channel = 'online'`).
b. **`seats` bleibt die Personenzahl (= belegtes Kontingent).** Dazu `paid_seats` + `free_persons` mit Check `seats = paid_seats + free_persons` (RISKS Nr. 22: 11 Personen → 11 Sitze, 10 bezahlt, 1 gratis).
c. **Snapshots pro Buchung** (Hard Rule 7, RISKS Nr. 21): Ticketpreis, Anzahlung, Provision pro Ticket, Gruppenschwelle, Gratisplätze, `commission_total_cents`; `amount_due_cents` (Rest im Bus) ist **generiert** = Gesamt − kassiert und kann nicht abweichen. Check `promoter_booking_complete` erzwingt bei `channel = 'promoter'`, dass Promoter, Idempotenz-Schlüssel, alle Snapshots, Zahlungsstatus und `sold_at` gesetzt sind; bei Zahlart Anzahlung zusätzlich der Anzahlungs-Snapshot. Online-Buchungen bleiben frei → alle neuen Spalten nullable, **Handover-Funktion aus 0002 unverändert** (Hard Rule 4, Identitätstest + 8-parallel-Test grün).
d. **Enum `payment_status` = `deposit_received` | `fully_paid`** (Entscheidung 2) mit Checks: `fully_paid` ⇔ kassiert = Gesamt; `deposit_received` ⇒ Zahlart Anzahlung und kassiert < Gesamt. Bewusst **kein** Wert „noch nichts kassiert" — ob es den braucht, ist nicht entschieden → **F23**.
e. **Storno-Felder** `cancelled_at`, `cancelled_by` (→ `profiles`), `cancellation_reason` + Check (beide Zeitpunkt/Person zusammen; `cancelled_at` nur bei Status `cancelled`/`refunded`). Die Status-Werte aus 0001 reichen: `cancelled` = Storno ohne Rückerstattung, `refunded` = nur bei Event-Absage durch uns (Entscheidung 4). `release_departure_seats()` (setzt nur `status`) bleibt verträglich.
f. **`booking_audit_log`** append-only (Aktionen `sold`, `payment_status_set`, `cancelled`; Handelnder, Rolle, Vorher/Nachher als JSON). **`notifications`** (Plan E5.6) schon jetzt als Datenmodell: Bestätigung + Erinnerung 4 h/1 h pro Buchung, `status = 'pending'` = ausstehend, Kanal NULL bis F20, **kein Versand**.
g. **RLS/Grants:** `authenticated` hat auf `bookings`, `booking_audit_log`, `notifications` **nur SELECT**; Policies: Promoter liest eigene Buchungen (`is_active_profile() and promoter_id = auth.uid()`) und deren Audit/Nachrichten, `network_operator` alles, deaktiviert/anon nichts. **Geschrieben wird ausschließlich über SECURITY-DEFINER-Funktionen (E5.3)** — kein INSERT/UPDATE/DELETE für `authenticated`, auch nicht für den Operator.
h. **Idempotenz:** `idempotency_key uuid` + eindeutiger Teilindex (RISKS Nr. 11, Plan D4); die Auswertung (zweiter Aufruf liefert die bestehende Buchung) kommt mit `reserve_promoter_seats()` in E5.3.
i. **Nicht entschieden, nicht geraten (Hard Rule 5):** `customer_email` bleibt NOT NULL (F8), Anzahlungsbasis/Gesamtbetrag (F16) und 10+1-Fragen (F11/F18) → E5.2, Buchungsstatus bei Bar-Anzahlung (F22) → E5.3.

Begründung: Marcos Auftrag 02.10.2026 („vier Entscheidungen … additiv in DECISIONS.md", „E5.1 Datenmodell-Erweiterung … additiv, RLS deny-by-default, nur passende Rollen schreiben", „8-parallel-Überbuchungstest gegen das Event-Kontingent grün halten"), Hard Rules 1, 4, 5, 7; Plan `docs/ETAPPE5_PLAN.md` D1–D8.

---

**30.09.2026 — F14: Eigener Ticketpreis und eigene Anzahlung pro Termin/Event als append-only-Daten (`pricing_rules`), jeder Termin darf überschreiben, kein geratener Ticketpreis-Standard**

Entscheidung (Marco, Auftrag 30.09.2026, Schritt A; Ausgestaltung Claude, Migration `0005_pricing_rules.sql`):

1. **Ticketpreis und Anzahlung sind Datensätze in derselben Tabelle `pricing_rules`, unterschieden durch `kind` (`ticket_price` | `deposit`)** — gleiches Muster wie `commission_rules` (DECISIONS 29.09., Punkte 1–3): Standard-Zeile mit `departure_id NULL`, Ausnahme pro Termin, `valid_from`, append-only (authenticated nur SELECT/INSERT), Ausnahme mit `amount_cents NULL` = „ab hier wieder Standard". `effective_price_cents(kind, termin, zeitpunkt)` liefert den gültigen Betrag pro Person; E5 speichert ihn pro Buchung als Snapshot (Hard Rule 7, RISKS Nr. 21).
2. **Jeder Termin/Event darf beides überschreiben, nicht nur interne Events.** Marco: „ein Event/Termin optional einen EIGENEN Preis und eine EIGENE Anzahlung … Interne Events können beides frei setzen." Ein Flag-abhängiges Verbot wäre eine erfundene Regel; das `is_internal`-Flag bleibt reine Kennzeichnung.
3. **Startwerte als Daten:** Anzahlung 30,00 €/Person ab 16.09.2026 (DECISIONS 16.09., Regel 1). **Kein Startwert für den Ticketpreis** — der reguläre Preis steht in keiner Entscheidung; er wird nicht geraten (Hard Rule 5), sondern von Gabo unter `/admin/regeln` eingetragen (RISKS F15). Bis dahin liefert `effective_price_cents('ticket_price', …)` NULL, `/admin/regeln` warnt, und E5 darf einen Termin ohne Preis nicht verkaufen.
4. **App-seitige Plausibilität (Ausgestaltung Claude):** Die Anzahlung pro Person darf den Ticketpreis pro Person nicht übersteigen, sonst wäre der „Rest im Bus" negativ. Geprüft in `createDeparture`/`updateDeparture` mit den Werten, die nach dem Speichern gälten (Eingabe, sonst Standard); fehlt ein Wert, wird nicht geprüft. Bewusst kein DB-Constraint, weil Standard und Ausnahme in verschiedenen Zeilen liegen und Gültig-ab-Zeitpunkte sich kreuzen können. Anzahlung = Preis (Vollzahlung) ist erlaubt.
5. **Pflege im Termin-Formular, nicht in einem separaten Dialog:** zwei optionale Felder (leer = Standard) beim Anlegen und auf der Detailseite. `planPricingWrites` schreibt nur dann eine neue Zeile, wenn sich gegenüber der gerade aktiven Ausnahme etwas ändert (leeres Feld bei aktiver Ausnahme → NULL-Zeile); erneutes Speichern ohne Änderung erzeugt keine Historie-Zeile.
6. **Lesen dürfen alle aktiven Profile** (Promoter brauchen Preis und Anzahlung im Verkaufs-Flow E5); schreiben nur `network_operator`, `created_by = auth.uid()`. Reserve-Funktion unverändert (Hard Rule 4, Tests grün).

Begründung: Marcos Auftrag 30.09.2026 („eigener Preis + eigene Anzahlung … DB-Daten, nicht Code-Konstanten … RLS: nur network_operator schreibt"), F14 aus RISKS, Vorbedingung für E5 (Beträge pro Buchung, Hard Rule 7). Ersetzt die E3-Vorentscheidung „interne Events vorerst nur eigene Provision" (DECISIONS 29.09., Punkt 5) durch Marcos neue Vorgabe.

---

**29.09.2026 — Etappe 3: Termine/Events, Kontingent und Regeln als Daten (append-only), internes Event = Flag, nur network_operator schreibt**

Entscheidung (Marco, Auftrag 29.09.2026; Ausgestaltung Claude, Migration `0004_events_and_rules.sql`):

1. **Provisions-Standard und 10+1-Parameter sind Datensätze, keine Konstanten.** `commission_rules` (Standard-Zeile mit `departure_id NULL`; Ausnahme pro Termin/Event) und `group_rules` (Schwelle, Gratisplätze) tragen `valid_from`. Die Startwerte aus DECISIONS 16.09. (10,00 €/Ticket, ab 11 Personen 1 gratis) stehen als **Daten in der Migration**, gültig ab 16.09.2026.
2. **Regeln sind append-only — auch in der DB erzwungen.** `authenticated` hat auf beiden Regel-Tabellen nur SELECT und INSERT, kein UPDATE/DELETE. Jede Änderung durch Gabo ist eine neue Zeile mit neuem Gültig-ab; die Historie bleibt vollständig (Grundlage für die Snapshots in E5, RISKS Nr. 21). `effective_commission_cents(termin, zeitpunkt)` und `effective_group_rule(zeitpunkt)` liefern die zu einem Zeitpunkt gültige Regel (neuestes `valid_from <= zeitpunkt`, bei Gleichstand die zuletzt angelegte).
3. **Ausnahme pro Termin/Event:** Eine `commission_rules`-Zeile mit `departure_id` schlägt den Standard. Eine Ausnahme-Zeile mit `commission_cents NULL` bedeutet „ab hier wieder Standard" — so lässt sich eine Ausnahme beenden, ohne etwas zu löschen. Standard-Zeilen ohne Betrag sind per Check verboten.
4. **Gruppenregel nur global**, keine Ausnahme pro Event — Marco hat nur „10+1-Parameter pflegbar" beauftragt; eine Event-Ausnahme wäre eine erfundene Regel (Hard Rule 5).
5. **Internes Event = Flag `tour_departures.is_internal`** (Marco: „interne Events (nur intern, nie öffentlich) als Flag"). Bedeutung: Verkauf nur im Promoter-Netzwerk, nie auf einem öffentlichen Kanal; eigene Provisions-Ausnahme möglich. Preis/Anzahlung interner Events sind nicht entschieden (F14). Dazu `note` (Freitext für Gabo). **Bestätigt von Marco am 29.09.2026:** Interne Events bekommen vorerst **nur eine eigene Provision**, keinen eigenen Preis und keine eigene Anzahlung; eigener Preis + Anzahlung bleiben als F14 offen.
6. **`capacity_total` bleibt das Kontingent** (DECISIONS 16.09.), Gabo setzt es direkt. Die Absenkung unter `seats_booked_total` scheitert am bestehenden Check `total_within_capacity` aus 0001 — kein Trigger, keine neue Logik. Termine werden **nicht gelöscht** (kein DELETE-Grant), Absage = `status = 'cancelled'`.
7. **Nur der network_operator schreibt, und nur die Pflege-Spalten:** Spalten-Grants INSERT/UPDATE auf `title, starts_at, capacity_total, status, is_internal, note`; `seats_booked_total` ist für `authenticated` unschreibbar — der Zähler gehört allein der Reserve-Funktion (Hard Rule 4, Funktion unverändert, E1-Tests weiter grün). Policies prüfen `is_network_operator()`; Regel-Zeilen zusätzlich `created_by = auth.uid()`.
8. **App schreibt über den RLS-Client des Nutzers, nie über `service_role`.** Jede Server Action prüft selbst `requireArea("admin")` (Next.js-16-Guide: der Layout-Guard deckt Actions nicht). Zeiten werden in **Ortszeit Mallorca (Europe/Madrid)** eingegeben/angezeigt und als `timestamptz` (UTC) gespeichert; Beträge als ganze Cent.
9. **Supabase-Default-Privilegien gehärtet:** `anon` verliert alle Tabellenrechte in `public`, `authenticated` TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, jeweils auch als Default für künftige Tabellen/Funktionen (RISKS Nr. 25). Additiv in 0004, weil die Migration noch nicht committet war; Befund betrifft auch die Tabellen aus E1/E2.
10. Der E2-Platzhalter `src/app/admin/page.tsx` („Test-Operator (Gabo)"-Begrüßung) wurde durch die Terminliste ersetzt — die einzige nicht-additive Code-Änderung, im CHANGELOG begründet.

Begründung: Marcos Auftrag E3 („alles als DATEN in der DB, nicht als Konstante im Code (Gabo-pflegbar)", „RLS-Policies … deny-by-default, nur network_operator schreibt", „capacity_total = das Kontingent"), DECISIONS 16.09. (Geschäftsregeln 2–4), RISKS Nr. 21/22, Hard Rules 1, 4, 5.

---

**29.09.2026 — Etappe 2: Rollenname `network_operator`, Rolle nur aus der DB, deny-by-default, keine Selbstregistrierung**

Entscheidung (Marco, Auftrag 29.09.2026; Ausgestaltung Claude):

1. **Rollen heißen `network_operator` (Gabo) und `promoter`** — nicht „admin" wie in TASKS E2.1 skizziert. Der Bereich in der App heißt weiterhin `/admin`.
2. **Die Fachrolle wird ausschließlich serverseitig aus `profiles` gelesen, nie aus dem JWT.** Das Token trägt nur die Supabase-Rolle `authenticated`; Policies nutzen `security definer`-Helfer (`current_profile_role()` u. a.), die App liest das Profil über den RLS-geschützten Client (Policy `id = auth.uid()`). Ein gefälschter Rollen-Claim im Token hat nachweislich keine Wirkung (`tests/profiles-rls.test.ts`).
3. **RLS ist auf allen drei Tabellen aktiv (deny-by-default).** `authenticated` bekommt nur SELECT auf `profiles` (eigene Zeile; Operator alle) und `tour_departures` (nur aktive Profile). `bookings` hat für `authenticated` weder Grant noch Policy — Zugriff bis E5 nur serverseitig über `service_role`. Schreib-Policies kommen erst mit den Features, die sie brauchen.
4. **Keine Selbstregistrierung** (`enable_signup = false` in `[auth]`), **Passwort-Mindestlänge 12**. Konten legt nur Gabo an (E4; die Admin-API ist von der Sperre nicht betroffen). `[auth.email] enable_signup` bleibt `true`, weil dieser Schalter in GoTrue den E-Mail-Provider samt Login abschalten würde.
5. **Strikt eine Rolle je Bereich:** Operator kommt nicht in `/promoter/*`, Promoter nicht in `/admin/*` (F13 offen, ob Gabo die Promoter-Sicht braucht).
6. **Lokale Test-Konten in `supabase/seed.sql`** (drei feste UUIDs, Passwörter sind Testwerte) — läuft nur bei `supabase db reset`, nie bei `db push`; in einer Cloud-Instanz landen sie nicht.
7. **Autorisierung liegt in der DAL (`requireArea()` in jedem Layout), der Proxy prüft nur optimistisch** auf eine Session — nach Next.js-16-Guide, weil Server Actions den Proxy-Matcher nicht zuverlässig treffen.

Begründung: Marcos Auftrag („Rolle serverseitig aus der DB, nie aus dem Token", „RLS deny-by-default … in diese Etappe, nicht später", „Passwort-Mindestlänge auf 12"), Diagnose-Befunde B2 und B7, RISKS Nr. 9. Der Name `network_operator` beschreibt Gabos Rolle (Netzwerk-Betreiber) genauer als „admin" und vermeidet die Verwechslung mit Supabase-Admin-Rechten.

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
