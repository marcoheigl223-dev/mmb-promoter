# RISKS.md — Risiko-Register + offene Fragen mmb-promoter

Status: 🔴 offen · 🟡 in Arbeit / teilweise entschärft · 🟢 entschärft. Zeilen werden aktualisiert, nie gelöscht. Offene Fragen an Marco/Gabo stehen im letzten Abschnitt — **nicht raten** (Hard Rule 5).

## Technisch

| # | Risiko | Status | Gegenmaßnahme / Stand |
|---|---|---|---|
| 1 | **Doppelverkauf über zwei Datenbanken:** Das Boots-Projekt lässt den Online-Kanal heute bis `capacity_total` verkaufen; das dem Promoter-Netzwerk zugeteilte Kontingent ist dort **nicht** hart gesperrt. Solange das so ist, kann derselbe Platz online und am Strand verkauft werden. | 🔴 | Gehört ins Boots-Projekt (dort TASKS Phase 2, „harte Kontingent-Sperre"), braucht Marcos Entscheidung + Migration + Test **dort**. Hier: Kontingent pro Abfahrt ist die einzige Verkaufsgrenze; kein Verkauf ohne von Gabo eingetragenes Kontingent. |
| 2 | **Überbuchung innerhalb dieser DB** (zwei Promoter auf den letzten Kontingent-Platz) | 🔴 | Übernahme von `reserve_departure_seats()` aus `docs/handover/reserve-function-final.sql` als eigene Migration, Kontingent als zusätzliche `WHERE`-Bedingung im selben atomaren UPDATE (Hard Rule 4). 🟢 erst, wenn der 8-parallel-Test hier grün ist. |
| 3 | **Abweichung von der bewährten Reserve-Funktion beim Übernehmen** (abgetippt statt kopiert, Bedingung „verbessert") | 🔴 | Funktion per Datei einspielen, nicht abschreiben; Diff gegen `docs/handover/reserve-function-final.sql` als Teil der Verifikation; Test wie in Nr. 2. |
| 4 | Port-Kollision mit der Boots-Instanz (543xx / 3000) | 🟢 | Eigene Ports 4532x / 3001, eigene `project_id` → eigene Container-/Volume-Namen (`supabase_*_mmb-promoter`). Beide Instanzen liefen am 16.09. gleichzeitig. |
| 5 | `supabase/.env.local` fehlt auf einem anderen Rechner → `supabase start` scheitert wegen `env(SUPABASE_AUTH_JWT_SECRET)` | 🟡 | Vorlage `supabase/.env.example` + Anleitung in `AGENTS.md`. Bewusst so (Hard Rule 9). |
| 6 | Windows/Hyper-V-Portreservierungen verschieben sich nach Neustart und treffen einen unserer Ports | 🟢 | 4532x liegt unterhalb des dynamischen Bereichs (Start 49152) — nicht reservierbar. Diagnose: `netsh interface ipv4 show excludedportrange protocol=tcp`. |
| 7 | Next.js 16 weicht vom Trainingswissen ab (Proxy statt Middleware, Cache-Semantik, Async-APIs) | 🟡 | Vor jedem Code-Schritt Guide in `node_modules/next/dist/docs/` lesen (AGENTS.md). Das Boots-Projekt nutzt `--webpack` (dortige RISKS Nr. 20) — ob das hier nötig ist, wird beim ersten Feature-Schritt entschieden, nicht vorab (F9). |
| 8 | **Kein Testrunner, kein Sicherheitsnetz** — noch keine einzige automatische Prüfung | 🔴 | Erste Etappe: Vitest + Überbuchungstest **vor** dem ersten Feature. `test-promoter-accounts.mjs` aus der Boots-Git-Historie (bis `3109a01^`) als Vorlage für den ersten Regressionstest. |
| 9 | Promoter-Account-Sicherheit: geteilte/schwache Zugänge unter mehreren Promotern am Strand | 🔴 | Eigener Account pro Promoter, keine geteilten Logins, Mindest-Passwortlänge (Boots-Plan: ≥ 12 Zeichen), Deaktivieren durch Gabo. |
| 10 | Falsch gewählter Zahlungstyp (Anzahlung statt Vollzahlung) → Abrechnungsfehler mit dem Boot | 🔴 | Zahlungstyp pro Buchung exakt speichern (Hard Rule 7) + Bestätigungsschritt im Verkaufs-Flow mit ausgeschriebenen Beträgen. |
| 11 | Doppelklick/Netzwerk-Wiederholung erzeugt zwei Buchungen | 🔴 | Idempotenz-Token pro Verkaufsvorgang (aus Boots-Plan §8.5 übernehmen). |
| 12 | Deployment-Ziel, Domain, Zahlungskonto sind nicht festgelegt | 🔴 | Offene Frage F7. Bis dahin nur lokal. |

## Rechtlich / Business

| # | Risiko | Status | Gegenmaßnahme / Stand |
|---|---|---|---|
| 13 | **Rechtsstatus der Promoter** (spanisches Handelsvertreterrecht, Ley 12/1992), **Lizenz für touristische Vermittlung** (Ley 8/2012 Balearen), **DSGVO** (getrennte Verantwortliche/Zwecke) — Grundlage der Trennung, aber ungeprüft | 🔴 | Recherche in `docs/research/` ist **kein Rechtsrat**. Vor Live-Gang mit spanischem Anwalt/Gestor klären. Datenmodell so bauen, dass Promoter-Daten und Kundendaten getrennt exportierbar/löschbar sind. |
| 14 | **Abrechnung über zwei Datenbestände:** Es gibt keine Tabelle mehr, die „verkauft insgesamt" beantwortet (Online in Boots-DB, Promoter hier) | 🔴 | Offene Frage F6: Export/Abgleich/gemeinsamer Report. Hier: jede Buchung trägt Kanal, Zahlungstyp, kassierten Betrag, offenen Rest — exportierbar als CSV. |
| 15 | Provisions-/Anzahlungs-Regeln sind nicht schriftlich bestätigt (F1–F3) | 🔴 | Nichts davon in Code oder Migration, bevor Marco/Gabo bestätigt haben. |
| 16 | Kundendaten am Strand (Name, Telefon, Allergie) werden auf Promoter-Handys erfasst — Datenschutz-Hinweis/Einwilligung fehlt | 🔴 | Rechtstexte für dieses Projekt separat (nicht die Boots-Texte); vor Live-Gang. |

## Prozess

| # | Risiko | Status | Gegenmaßnahme / Stand |
|---|---|---|---|
| 17 | Zweites Projekt = doppelter Pflegeaufwand (Deployments, Env-Sätze, `config.toml`, Rechtstexte) | 🟡 | Bewusst in Kauf genommen (ADR-0001). Doku hier eigenständig, nichts aus dem Boots-Repo „mitbenutzen". |
| 18 | Boots-Promoter-Code wird 1:1 kopiert statt bewusst übernommen (Recherche empfiehlt Neubau mit den Erkenntnissen) | 🟡 | Jede Übernahme ist ein eigener TASKS-Schritt mit Begründung; Git-Historie des Boots-Repos (bis `3109a01^`) ist Referenz, nicht Copy-Quelle. |
| 19 | Recherche-/Übergabe-Dateien liegen noch nicht im Repo — Verweise in dieser Doku zeigen bis dahin ins Leere | 🟡 | Ablage-Anweisung in `docs/research/README.md` und `docs/handover/README.md`; Marco kopiert (TASKS „Manuelle Schritte"). Danach 🟢. |
| 20 | Kontext-Verlust zwischen Sessions | 🟢 | `PROGRESS.md` + `TASKS.md` werden über `CLAUDE.md` in jede Session geladen; Sitzungsende = beide aktualisieren + CHANGELOG. |

## Offene Fragen an Marco/Gabo (nicht raten — Hard Rule 5)

| # | Frage | Warum es wichtig ist | Stand |
|---|---|---|---|
| F1 | **Anzahlung: 30 € pro Person oder pro Buchung?** | Bestimmt Restbetrag im Bus und den Bestätigungsschritt | offen (Boots-Plan rechnete pro Platz, unbestätigt) |
| F2 | **Provision:** fester Betrag pro Platz (im Boots-TASKS ist „10 €" erwähnt) oder Prozent? Pro Tour/pro Promoter unterschiedlich? Gilt sie bei Storno? | Datenmodell `commission_rules`, Snapshot pro Buchung | offen, unbestätigt |
| F3 | **„10+1-Regel"** (im Boots-TASKS erwähnt): Was genau — 11. Platz gratis für die Gruppe, oder Bonus für den Promoter? | Preis-/Kapazitätslogik | offen, unbestätigt |
| F4 | **Interne Events** (im Boots-TASKS erwähnt): gehören sie in dieses Projekt? | Zuschnitt (ADR-0002?) | offen |
| F5 | **Wie teilt Gabo Kontingente zu?** Pro Abfahrt eine Zahl für das ganze Netzwerk, oder pro Promoter? Wie erfährt dieses System von Abfahrten (manuell anlegen, Import)? | Kern des Datenmodells | offen |
| F6 | **Gesamtsicht/Abrechnung** über beide Datenbanken: CSV-Export je Seite + manueller Abgleich, oder gemeinsamer Report? | Hard Rule 7, RISKS Nr. 14 | offen |
| F7 | **Domain, Hosting, Zahlungskonto** für dieses Projekt | Deployment, Stripe-Setup | offen |
| F8 | **Kunden-E-Mail am Strand Pflicht oder optional?** | Boots-Schema hatte `customer_email NOT NULL`; Boots-Plan empfahl: optional außer online | offen |
| F9 | **Braucht das Promoter-Projekt `--webpack`** wie das Boots-Projekt (dortige RISKS Nr. 20)? | Dev-Setup | wird beim ersten Feature-Schritt geprüft |
