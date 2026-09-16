# Recherchebericht: MyMallorcaBoats (boote-neutrale Buchungsplattform) + separates Promoter-Netzwerk — Fakten, Recht, Technik, Risiken

**Wichtiger Hinweis vorweg:** Dieser Bericht ist eine faktenbasierte Recherche, KEIN Rechtsrat. Alle rechtlichen Aussagen zu Spanien/Balearen (Gesellschaftsform, Reisevermittler-Lizenz, Handelsvertreterrecht, DSGVO) müssen zwingend mit einem spanischen Anwalt (abogado) und/oder einem Gestor auf Mallorca verifiziert werden, bevor Marco/Gabo live gehen.

## TL;DR
- **Rechtlich sauber trennbar, aber lizenzsensibel:** Zwei Geschäfte (A: boote-neutrale Vermittlung; B: Promoter-Netzwerk) lassen sich über getrennte Betreiber (autónomo/SL), getrennte Domains, getrennte Supabase-Projekte/DBs und getrennte AGB/Datenschutz sauber trennen. Das EU-Pauschalreise-Regime (RL 2015/2302, span. RDLeg 1/2007) greift NICHT bei einem einzelnen Bootsausflug <24h ohne Übernachtung — aber die *balearische* Tourismus-Lizenzfrage (Ley 8/2012) für gewerbliche Online-Vermittlung von Ausflügen ist eine SEPARATE, offene Frage, die zwingend mit der Conselleria de Turisme/Anwalt geklärt werden muss.
- **Boote-neutral ist ehrlich machbar** — genau wie GetYourGuide/Viator es tun: Als reiner Intermediär formulieren ("Vermittlung", "Partnerboot je nach Verfügbarkeit", "die Leistung erbringt der jeweilige Partner, nicht MyMallorcaBoats"). Für Wasseraktivitäten als Affiliate/Reseller sind GetYourGuide (Affiliate mind. 8%, Cookie 30 Tage), Viator (8% Affiliate; 20–30% Operator-Rate = Margen-Spielraum), Bókun-Marketplace (frei verhandelbar, Buchungsgebühr 1–1,5%) und Regiondo/TrekkSoft die realistischen Kanäle.
- **Technisch:** Page-Builder für Gabo als section-/block-basiertes System in Supabase (JSON-Schema-getriebene Sections, Supabase Storage für Bilder, Drag-and-Drop-Reihenfolge, feste Templates statt Freiform-Layout). Projekttrennung via pnpm-Workspace/Turborepo mit geteiltem `core`-Package für die atomare Reservierungslogik. Supabase Pro (25 $/Monat pro Organisation + Compute pro Projekt), Resend (3.000 Mails/Monat gratis, aber hartes 100/Tag-Limit), Stripe (1,5% + 0,25 € national in Spanien).

---

## Key Findings

1. **Pauschalreiserecht greift nicht bei Einzelleistung <24h.** Ein einzelner Bootsausflug ohne Übernachtung ist weder ein "viaje combinado" (mind. 2 Reiseleistungen) noch ein "servicio de viaje vinculado". Damit fallen die schärfsten Veranstalter-Haftungspflichten weg. ABER: Die balearische Lizenzfrage ist getrennt zu prüfen.
2. **Intermediär-Formulierung ist der Schlüssel.** GetYourGuide formuliert wörtlich: "We act as a commercial agent for the Suppliers... the actual Activities are provided by the Suppliers themselves, not by GetYourGuide". Genau dieses Muster sollte MyMallorcaBoats übernehmen.
3. **Führerscheinfreie Bootsvermietung endet zum 1. Oktober 2026** (RD 1188/2025, BOE-A-2025-27010) — für den *Vermiet*-Zweig relevant; skipperbegleitete Touren bleiben unberührt.
4. **10+ Affiliate-fähige Wasseraktivitäten** existieren auf Mallorca mit funktionierenden Reseller-/Provisionswegen.
5. **Page-Builder ist mit ~3–6 Wochen Aufwand realistisch** als Eigenbau in Supabase (block-basiert) — sicherer als Freiform-Layout.
6. **100+ Risiken** und **10 Verbesserungen** siehe unten.

---

## Details

### 1. Juristische Trennung zweier Geschäfte (Spanien/Mallorca) — KEIN Rechtsrat

**Grundprinzip:** Rechtssaubere Trennung entsteht durch (a) getrennte Betreiber/Rechtsträger, (b) getrennte Domains + Impressa (aviso legal), (c) getrennte Datenbanken, (d) getrennte AGB/Datenschutzerklärungen, (e) getrennte Zahlungsströme (idealerweise getrennte Stripe-Accounts).

**Gesellschaftsform (autónomo vs. SL):**
- **Autónomo** (Einzelunternehmer): günstig zu starten (Registrierung kostenlos bis ~300 €), Gestor 60–150 €/Monat, aber KEINE Haftungstrennung — persönliches Vermögen haftet. Progressiver IRPF bis 47%.
- **SL (Sociedad Limitada):** Mindestkapital seit Ley Crea y Crece (2022) 1 € (praktisch meist 3.000 €), Gründung ~500–3.000 € (Notar, Registro Mercantil, Gestor), laufend +1.000–2.400 €/Jahr mehr als autónomo. Körperschaftsteuer 25% (15% erste zwei Jahre für Neugründungen). Haftungsbeschränkung. Faustregel mehrerer Gestorías/Anwälte: SL lohnt ab **~50.000–60.000 € nachhaltigem Jahresgewinn**.
- **Für die Trennung zweier Geschäfte:** Die sauberste Haftungs- und DSGVO-Trennung erreicht man mit **zwei separaten Rechtsträgern** (z.B. zwei SLs oder eine SL + eine autónomo-Aktivität mit getrennten IAE-Epígrafes). Das ist genau der Punkt, den ein Gestor/Anwalt bewerten muss.

**Handelsvertreter-/Provisionsrecht (für das Promoter-Netzwerk, Projekt B):** Das spanische **Ley 12/1992 sobre Contrato de Agencia** (Umsetzung der EU-RL 86/653/CEE) regelt den *agente comercial* (stabile, dauerhafte Vermittlung gegen Provision im Namen des Prinzipals). Kritisch: Art. 28 — **indemnización por clientela** (Ausgleichsanspruch bei Vertragsende, bis zu einer Jahresprovision). Ein *comisionista* (punktuelle, sporadische Vermittlung) fällt NICHT unter dieses Regime. Für Strandpromoter, die dauerhaft gegen 10 €/Ticket vermitteln, ist die Abgrenzung agente vs. selbständiger comisionista vs. Scheinselbständigkeit (falso autónomo) juristisch heikel — Anwalt nötig. Provision, Zahlung und Verfall der Provision sind in Art. 11–17 geregelt; bei Fehlen einer Vereinbarung gilt die ortsübliche Vergütung.

**DSGVO-Trennung der Datenbestände:** Getrennte Verantwortliche (controller) pro Projekt, getrennte Supabase-Projekte (eigene Postgres-Instanz je Projekt), getrennte Auth-User-Pools, getrennte Verarbeitungsverzeichnisse (registro de actividades), getrennte Auftragsverarbeiter-Verträge (DPA) mit Supabase/Stripe/Resend. Keine gemeinsame Kundentabelle. Promoter-Daten (Projekt B) dürfen nicht ungefiltert in Projekt A fließen und umgekehrt — nur definierte, dokumentierte Schnittstellen mit Rechtsgrundlage.

### 2. Boote-neutrale Vermittlungs-Website — rechtlich ehrlich

**Wichtigste Erkenntnis (bestätigt am Gesetzestext):** Das EU-Pauschalreiserecht (RL 2015/2302; span. Umsetzung RDLeg 1/2007 TRLGDCU Libro IV, geändert durch RD-ley 23/2018) gilt NUR für "viajes combinados" (Kombination von **mindestens zwei** verschiedenen Reiseleistungstypen) und "servicios de viaje vinculados". Ein **einzelner Bootsausflug** ist keins von beidem. Zusätzlich schließt Art. 150 TRLGDCU alle Kombinationen **unter 24 Stunden ohne Übernachtung** ausdrücklich aus. Bestätigt durch die offizielle EU-Seite "Your Europe": Die Regeln decken keine unabhängigen Einzelreiseleistungen und keine Pauschalreisen unter 24h ohne Unterkunft ab.

**→ Konsequenz:** Solange MyMallorcaBoats nur einzelne Bootstouren (<24h, ohne Übernachtung) vermittelt, greifen die Veranstalter-Haftungspflichten des Pauschalreiserechts NICHT. **ABER Achtung:** Sobald man Touren mit Übernachtung oder mit einem zweiten Leistungstyp (z.B. Transfer + Tour als Paket, oder Tour + Unterkunft) bündelt, kann das Pauschalreiserecht/verbundene Reiseleistung greifen — dann Veranstalterpflichten inkl. Insolvenzabsicherung. Wichtig zudem: Laut RL 2015/2302 entbindet die bloße Selbstbezeichnung als "nur Vermittler" NICHT von Pflichten, falls faktisch ein Paket verkauft wird — die tatsächliche Leistungsgestaltung zählt.

**Offene, kritische Lizenzfrage (balearisch):** Die balearische **Ley 8/2012 del Turismo de las Illes Balears** (vigente, aktualisiert bis 2025/2026) definiert in Art. 3.m "actividades de intermediación turística" als "mediación **u organización** de servicios turísticos" — also Vermittlung von *Dienstleistungen*, nicht zwingend Paketen. Kapitel VI ("Empresas de intermediación turística", Art. 56–59 bis) erfasst laut BOE-Text ausdrücklich "los canales de intermediación a través de internet u otros sistemas de nuevas tecnologías". Das heißt: Die *administrative* Lizenzpflicht als "empresa de intermediación turística"/agencia de viajes könnte auf Balearen **breiter** sein als das Pauschalreiserecht und auch das gewerbliche Online-Wiederverkaufen einzelner Ausflüge erfassen. Der eigentliche Boot-Betreiber fällt dagegen typischerweise unter Kapitel VII (empresas de actividades turísticas de entretenimiento/deportivas). **Das ist die zentrale Risiko-/Klärungsfrage — zwingend mit Conselleria de Turisme + spezialisiertem Anwalt klären.** Zum Vergleich: Eine klassische Online-Reiseagentur in Spanien braucht dieselbe título-licencia wie ein Ladengeschäft plus Kaution/Garantie (in mehreren Regionen historisch ~60.000 € Mindestgarantie bzw. RC-Police ~150.153 €); für reine Online-Agenturen entfallen nur die Lokal-Anforderungen, nicht die Lizenz.

**Wie etablierte Vermittler es formulieren (Vorlage für ehrliche Texte):**
- **GetYourGuide (wörtlich, AGB):** "We operate the GetYourGuide Platform as an intermediary platform... We act as a commercial agent for the Suppliers. This means we facilitate the bookings, but the actual Activities are provided by the Suppliers themselves, not by GetYourGuide." Und: "We accept the offer in the name and on behalf of the Supplier."
- **Viator (Supplier-/Partner-Terms):** "each Experience is provided by a Supplier and not Viator"; Viator agiert als "limited payment collection agent" und "assumes no liability for any acts or omissions of the Supplier."
- **Civitatis (Eigenbeschreibung):** "Civitatis es una plataforma de intermediación entre el cliente final y los operadores de servicios turísticos."
- *Hinweis:* Eine explizite Klausel "das konkrete Boot wird je nach Verfügbarkeit zugewiesen" findet sich meist NICHT in den Plattform-AGB, sondern auf Produkt-/Betreiberebene. MyMallorcaBoats sollte diese Klausel bewusst in die eigenen AGB + auf die Produktseiten aufnehmen.

**Empfohlene, ehrliche Formulierungen für MyMallorcaBoats:**
- ✅ EHRLICH: "Bootstour / Wassererlebnis", "Sie werden je nach Verfügbarkeit einem unserer Partnerboote zugewiesen", "Die Tour wird vom jeweiligen Partner-Betreiber durchgeführt, nicht von MyMallorcaBoats", "Abfahrtszeit kann je nach eingesetztem Boot zwischen 13:00 und 14:30 Uhr variieren", "MyMallorcaBoats vermittelt die Buchung im Namen und für Rechnung des Partner-Betreibers."
- ❌ IRREFÜHREND/RISKANT: Ein konkretes Boot mit Namen/Foto garantieren, das nicht sicher eingesetzt wird; "unser Boot"; feste Garantien zu Ausstattung/Kapazität eines bestimmten Schiffs; Versprechen, die nur ein bestimmter Partner halten kann.

### 3. Wasser-/Wasseraktivitäten als Affiliate/Drittanbieter (Mallorca)

**Reseller-/Affiliate-Modelle im Überblick:**
- **GetYourGuide Affiliate:** Mindestens **8% Provision** auf abgeschlossene Buchungen (Basisrate teils 7% über Awin), Cookie **30 Tage** (31 bei Travelpayouts), Auszahlung monatlich (Bank/PayPal), Tools: Deeplinks (gyg.me-Kurzlinks), Widgets, API. Verwaltet u.a. über CJ Affiliate. Geringe Einstiegshürde, aber Kunde bucht auf GYG (nicht auf Marcos Seite) → weniger Kontrolle, kein eigener Marge-Aufschlag.
- **Viator/Tripadvisor:** Affiliate **8%** (Cookie 30 Tage; für Travel Agents 90 Tage seit 2025-Update), API-Zugang in Stufen (Basic/Full/Full+Booking), Widgets. Wichtig: die Operator-Provision (was Betreiber an Viator zahlen) liegt bei **20–30%** (Standard 20%, mit "Accelerate" effektiv 30–35%) — das ist der Spielraum, um als Reseller eine eigene Marge einzupreisen.
- **Bókun Marketplace (Tripadvisor):** B2B-Distribution — Marco kann als **Reseller** Partnerprodukte listen und verkaufen; Reseller-Provision **frei zwischen Supplier und Reseller verhandelbar**; Bókun-Buchungsgebühr gestaffelt **1% (Premium) / 1,25% (Plus) / 1,5% (Start)** des monatlichen Online-Buchungswerts, **0% bei Verkäufen über Viator**; Netzwerk mit >2.600 Resellern/OTAs. Das flexibelste Modell für "Kunde bucht bei Marco, zahlt mehr, Partner erbringt Leistung".
- **FareHarbor Distribution Network (FHDN):** Reseller verdienen typ. **15% Provision** pro Verkauf; Zugang zu ~2.500 Branchenmitgliedern.
- **Regiondo / TrekkSoft (TrekkConnect):** Channel-Manager/Unified-API — verbinden Supplier-Inventar mit Resellern in Echtzeit; TrekkConnect erlaubt, gleichzeitig Supplier UND Reseller zu sein.

**Technisches Reseller-Modell:** (1) **API-Anbindung** (Availability/Booking-Endpoints, z.B. GYG Supplier-API, Bókun-API, Viator-API) für Echtzeit-Verfügbarkeit + atomare Buchung; (2) **White-Label/Widget** (schnell, wenig Design-Kontrolle); (3) **Deeplink/Affiliate-Link** (einfachste Variante, aber Kunde verlässt die Seite). Für Awwwards-Niveau + eigene Marge ist **API-Anbindung mit eigenem Checkout** (Marco kassiert, Partner erhält Netto-Rate) das Ziel — juristisch aber am nächsten an "Reiseagentur", daher Lizenzfrage (Punkt 2) besonders relevant.

**10+ konkrete Wasseraktivitäten Mallorca (alle über GYG/Viator/Bókun als Affiliate/Reseller vermittelbar):**
1. **Jetski-Touren** (geführt, mit lizenziertem Guide — kein eigener Führerschein des Kunden nötig)
2. **Parasailing**
3. **Katamaran-Sunset-Cruise** (mit Getränken/Musik)
4. **Schnorchel-Trips**
5. **Tauchtrips / Discovery-Dives** (PADI-Partner)
6. **SUP (Stand-Up-Paddle) & Kajak-Touren**
7. **Flyboard**
8. **Bananenboot / Tow-Toys**
9. **Höhlen-Bootstouren** (Küstenhöhlen)
10. **Glasboden-Boote**
11. **Angeltouren / Fishing charters**
12. **Delfin-Watching / Wildlife-Bootstouren**
13. **Wasserski / Wakeboard**
14. **Speedboot-/RIB-Excursions**

**Was OHNE eigene Lizenz/Versicherung erlaubt ist zu vermitteln:** Als reiner Affiliate (Deeplink/Widget) vermittelt man nur Traffic — der Partner trägt Lizenz, Versicherung und Leistungserbringung. Sobald Marco selbst kassiert und als Vertragspartner/Reseller auftritt, steigt das Haftungs- und Lizenzrisiko (siehe Punkt 2). Eine eigene Wassersport-Betriebslizenz/Boots-Versicherung braucht Marco NICHT, solange er nicht selbst Boote/Ausrüstung/Personal stellt. **Aber:** Eine Betriebshaftpflicht (RC) für die Vermittlungstätigkeit und klare Reseller-Verträge (wer haftet wofür) sind dringend zu empfehlen — Anwalt/Versicherungsmakler.

### 4. Privatboote ohne Führerschein — Stand der Regelung

**Bestätigt (Primärquelle BOE):** **Real Decreto 1188/2025 vom 26.12.2025 (BOE-A-2025-27010, veröffentlicht 30.12.2025)** ändert Art. 10 des RD 875/2014 "con efectos desde el 1 de octubre de 2026" und beschränkt die führerscheinfreie Führung von Motorbooten bis 5 m Länge und max. 15 CV Nennleistung "a los usos privativos y deportivos". Bis **30. September 2026** dürfen solche Boote also führerscheinfrei gemietet/gefahren werden; ab **1. Oktober 2026** muss der Mieter bei **gewerblicher Vermietung** mindestens die "Licencia de Navegación" haben. Begründung des Gesetzgebers: hohe Zahl von Unfällen bei führerscheinfreien Vermietungen.

**Wichtig für Marco/Gabo:** Skipper-begleitete Touren (genau das Geschäftsmodell von MyMallorcaBoats) sind NICHT betroffen — der Skipper bringt die Qualifikation mit. Der Angebotszweig "führerscheinfreie Bootsvermietung an Endkunden" fällt ab Okt. 2026 weg; das reine Vermitteln geführter/geskipperter Touren bleibt voll möglich. (Zusatz-Kontext: Palma verbietet ab 2026 zudem Party-Boote am Seefront-Anleger in der Bucht von Palma — relevant für Positionierung als seriöse, nicht als "Party"-Marke.)

### 5. Shopify-artiger Seiten-Baukasten für Nicht-Programmierer (Next.js/Supabase)

**Empfehlung: Block-/Section-basiertes CMS als Eigenbau in Supabase** (nicht Freiform-Drag-and-Drop wie Builder.io, weil das ein Nicht-Programmierer leicht "kaputt macht").

**Architektur:**
- **Datenmodell (Supabase/Postgres):** Tabellen `pages`, `sections` (bzw. `blocks`), mit Feldern `type` (enum: hero, activity_grid, gallery, text, testimonial, cta …), `position` (integer für Reihenfolge), `visible` (bool), `content` (JSONB), `page_id` (FK). Jeder Section-Typ hat ein **festes JSON-Schema** — Gabo füllt nur definierte Felder (Name, Preis, Infos, Bilder), kann aber KEIN freies HTML/Layout bauen.
- **JSON-Schema-driven Sections:** Jeder Block-Typ ist eine getestete React-Server-Component mit klar definierten Props. Ein "BlockRegistry" mappt `type` → Komponente. So bleibt das Awwwards-Design intakt, egal was Gabo eingibt (Muster wie beim Open-Source-Projekt NextBlock CMS, das genau auf Next.js 16 + Supabase + Tailwind aufsetzt und "worry-free revisions" mit Versionshistorie bietet).
- **Bild-Upload:** **Supabase Storage** (im Pro-Tier bis 100 GB inkl.), Client-seitige Komprimierung vor Upload (spart Storage + Egress), signierte URLs, Bild-Transformationen. Empfehlung: Uploads auf definierte Seitenverhältnisse zuschneiden (Cropper im Admin), damit das Layout nie bricht.
- **Drag-and-Drop-Reihenfolge:** Bibliothek wie `dnd-kit` im Admin-Dashboard; beim Sortieren nur das `position`-Feld updaten. Optional Live-Preview (split view).
- **Kaputt-Schutz:** (a) feste Templates/Slots statt Freiform-Canvas; (b) Validierung der JSON-Inhalte (Zod-Schema) server-seitig; (c) Pflichtfelder + Zeichenlimits; (d) Vorschau vor Publish + Versions-/Undo-History (jede Änderung als neue Revision, Restore per Klick); (e) Rollen (Gabo = Editor, nicht Admin des Codes).

**Build vs. Buy:**
- **Eigenbau in Supabase** (empfohlen): volle Kontrolle, keine zusätzlichen Kosten, passt zum bestehenden Stack. Aufwand realistisch **~3–6 Wochen** für ein robustes MVP mit ~6–10 Block-Typen.
- **Payload CMS** (self-hosted, in Next.js einbettbar, Postgres; free self-hosted, Cloud ab 35 $/Monat): stärkste Fertig-Option. Achtung: 2025/2026 wurde eine kritische SQL-Injection-Lücke (CVSS 9.8) in Payloads Postgres/SQLite-Adaptern gepatcht — bei self-hosting IMMER aktuell halten.
- **Sanity** (hosted, ab 15 $/User/Monat): beste Editor-UX für Nicht-Techniker (30-Min-Onboarding), aber Content Lake nicht self-hostbar (DSGVO/Datenresidenz prüfen), metered API-Kosten.
- **Builder.io** (visuelles Drag-and-Drop): mächtig, aber genau das Freiform-Risiko, das man bei einem Nicht-Programmierer vermeiden will.
- **Verdikt:** Für Gabos Anforderung (neue Segmente wie "Jetski" anlegen, Fotos, Preis, Position bestimmen — OHNE Layout zu zerstören) ist der **block-basierte Eigenbau in Supabase** die beste Balance aus Kontrolle, Kosten und Awwwards-Design-Schutz.

### 6. Technische Projekt-Trennung (Monorepo vs. zwei Repos)

**Empfehlung: pnpm-Workspace + Turborepo mit geteiltem Core-Package.**
- **Warum:** Die getestete atomare Sitzplatz-Reservierungslogik ist der wertvollste Code. Sie gehört in ein **geteiltes `packages/core`** (npm-Workspace-Package, `workspace:`-Protokoll), das BEIDE Apps (`apps/mymallorcaboats`, `apps/promoter`) importieren. Änderung an der Logik wirkt sofort in beiden Apps, kein Publish-Zyklus.
- **2026-Konsens:** Turborepo ist Default für JS/TS-Monorepos (5–50 Pakete); pnpm-Workspace + TypeScript Project References ist die sichere Basis, Turborepo für Caching/Task-Orchestrierung obendrauf. Polyrepo ("polyrepo hell") führt bei geteiltem Code zu 15 PRs für ein Rename.
- **ABER — Achtung juristische Trennung (Punkt 1):** Geteilter *Code* ist okay; geteilte *Datenbank/Auth/Domain* NICHT. Also: Monorepo für Code, aber **zwei getrennte Supabase-Projekte** (eigene DB, eigener Auth-Pool), **zwei Domains**, **zwei Deployments**, **zwei Stripe-Accounts**. Der Core-Package-Code muss DB-agnostisch sein (DB-Verbindung wird pro App injiziert).

**Sauberes Heraustrennen des bestehenden Promoter-Systems (Reihenfolge):**
1. **Abhängigkeits-Analyse:** Mit `madge`/`dependency-cruiser` den Import-Graph des Promoter-Codes visualisieren; alle Kopplungen zum Boots-Code finden.
2. **Snapshot/Hash vorher:** Vollständige Test-Suite grün + Snapshot-Tests + Git-Tag + Hash der Build-Artefakte des Ursprungsprojekts festhalten (Referenzzustand).
3. **Core extrahieren:** Reservierungslogik + Typen in `packages/core` ziehen, beide Apps darauf umstellen.
4. **Promoter-App abspalten:** Promoter-Login/Account-Verwaltung in `apps/promoter` mit eigenem Supabase-Projekt.
5. **Regression prüfen:** Ursprungsprojekt neu bauen, Tests erneut laufen lassen, Snapshot/Hash-Vergleich vorher/nachher → identisches Verhalten der Boots-App verifizieren.
6. **CI-Gate:** Turborepo-Pipeline, die bei jeder Änderung beide Apps baut/testet; Remote-Caching (Vercel) für Tempo.

### 7. Dokumentations-System für KI-gestützte Entwicklung (2026)

**Belegte Best Practices:**
- **AGENTS.md als primäre Instruktionsdatei** (Standard, von 30+ Tools nativ gelesen, gestewardet von der Agentic AI Foundation/Linux Foundation, 60.000+ Repos). Claude Code liest weiterhin **CLAUDE.md** — daher CLAUDE.md anlegen und mit `@AGENTS.md` in erster Zeile importieren.
- **Kurz halten:** Root-Datei ~20–30 Zeilen (technisches Max 32 KiB, Ziel <150 Zeilen). Aus README dupliziertes Material *schadet* der Agent-Performance messbar. Vercel-Evals: statischer AGENTS.md-Kontext 100% Pass vs. 79% bei dynamischem Skill-Retrieval; akademische Studie (124 PRs, 10 Repos): AGENTS.md senkt Output-Tokens ~20% und Bearbeitungszeit 20–28%.
- **Nested files:** Datei am nächsten zum bearbeiteten Code gewinnt → pro App eine eigene AGENTS.md/CLAUDE.md + eine Root-Datei mit den geteilten Konventionen (Monorepo).
- **Claude-Code-Surfaces richtig zuordnen:** Harte Regeln → **Hooks/Permissions**; kontextuelles Wissen → **Skills** (`.claude/skills/<name>/SKILL.md`); Delegationsgrenzen → **Subagents** (`.claude/agents/`); Always-on-Guidance → knappe CLAUDE.md.

**Empfohlenes mehrschichtiges Doku-System (über beide Projekte konsistent):**
- `/AGENTS.md` (Root, Monorepo): Stack, Build/Test-Commands, Code-Style, Grenzen ("core-Logik nie duplizieren", "DB nie projektübergreifend teilen").
- `/apps/*/AGENTS.md`: app-spezifische Regeln (z.B. Promoter-App = getrennte DSGVO-Domäne).
- `/docs/decisions/` (**ADRs**, Architecture Decision Records): jede große Entscheidung nummeriert (Status, Datum, Kontext, Entscheidung, Konsequenzen) — Anthropic bietet ein offizielles ADR-Skill.
- `/docs/changelog.md`: Änderungsprotokoll ("nach jeder Aufgabe dokumentieren").
- `/docs/risk-register.md`: Risiko-Register (siehe Punkt 10), regelmäßig aktualisiert.
- **Regel "nach jeder Aufgabe":** Ein Hook oder eine CLAUDE.md-Regel, die Claude anweist, nach jeder abgeschlossenen Aufgabe Changelog + ggf. ADR + Risk-Register zu aktualisieren.

### 8. Awwwards-Niveau-Design ohne einzelnes Boot

**Grundidee:** Da kein konkretes Boot mehr gezeigt werden muss, ist die Ästhetik **frei** — abstrakte Meer-/Mittelmeer-Motive, generische Küsten-Drohnenaufnahmen, Wasser/Licht/Bewegung. Das ist auch rechtlich sauber (kein Fälschen eines realen Schiffs, keine Bildrechte-Probleme mit fremden Booten).

**Belegte Techniken (Awwwards SOTD 2026):**
- **Scrollytelling** mit **GSAP ScrollTrigger** (Scroll-Scrubbing: Animationen an Scroll-Position gebunden) + **Lenis** (Smooth Scrolling) — genau Marcos Stack. Progressive Enthüllung, Pinning, Parallax.
- **Three.js/WebGL** für Hero-Szenen (z.B. bewegte Wasseroberfläche mit GLSL-Shadern, Licht-Reflexe reagieren auf Mausbewegung). Muster aus SOTD 2026: "one confident centerpiece" statt überladener 3D-Welt; 60fps Desktop, 45–50fps Mobile als Zielmarke.
- **"One room per item":** Jedes Angebots-Segment (Tagestour, Sunset, Jetski …) als eigene Scroll-"Szene" — wirkt wie eine Ausstellung, nicht wie eine Liste.
- **Performance/Accessibility:** Horizontal-Scroll nur Desktop; Keyboard-Navigation; auto-scroll pausierbar (W3C). Nicht auf textlastigen/mobilen Views übertreiben; `prefers-reduced-motion` respektieren.

**KI-generierte Inhalte — legitim & stark hier:**
- **Abstrakte Wasser-/Meer-Szenen, generische türkise Buchten, Drohnen-Küstenästhetik, Licht/Kaustik-Texturen, Sonnenuntergangs-Farbverläufe** — generisch, nicht ein bestimmtes reales Boot fälschend.
- **Tools 2026:** Midjourney (v7-Klasse) und Flux für fotorealistische Bilder; Runway/Kling/Sora-Klasse für kurze Loop-Videos (Wasseroberfläche, Wellen); Upscaler (Topaz) für Auflösung; Ideogram/Nano-Banana-Klasse für Text-in-Bild.
- **"Nicht nach KI aussehen"-Regeln:** (1) echte Fotos + KI mischen (Grain, Farbkorrektur/LUT vereinheitlichen); (2) keine typischen KI-Artefakte (verzerrte Hände/Gesichter, unmögliche Reflexe) — daher Fokus auf Landschaft/Wasser statt Menschen-Nahaufnahmen; (3) konsistente Farbpalette/Lichtstimmung; (4) echte Details ergänzen (echte Küstennamen, echte Karten).
- **Rechtlich:** Keine Menschen-Gesichter generieren, die realen Personen ähneln; keine erkennbaren Marken/Bootsnamen; bei echten Gäste-Fotos Einwilligung einholen (Punkt 9); ggf. KI-Inhalte kennzeichnen (EU-KI-Transparenz).
- **Ehrlichkeits-Grenze:** KI-Bilder dürfen die *Stimmung* zeigen, aber nicht konkrete Leistungsmerkmale suggerieren, die der Partner nicht liefert (z.B. Luxusyacht zeigen, wenn ein einfaches Boot kommt) — sonst irreführende Werbung.

### 9. Vollständige Checkliste — was Marco selbst besorgen/einrichten muss

Priorität: **P0 = vor Launch zwingend, P1 = kurz nach Launch, P2 = später.**

| # | Was | Warum | Geschätzte Kosten | Prio |
|---|-----|-------|-------------------|------|
| 1 | **Anwalt (abogado) + Gestor auf Mallorca** | Lizenzfrage (Punkt 2), Gesellschaftsform, Verträge, Trennung der zwei Geschäfte, DSGVO | Erstberatung oft gratis; laufend Gestor 60–350 €/Monat | **P0** |
| 2 | **Gesellschaftsform klären** (autónomo vs. SL, 1 oder 2 Rechtsträger) | Haftung + Trennung + Steuer | SL-Gründung ~500–3.000 € | **P0** |
| 3 | **Supabase Cloud** — 2 getrennte Projekte (EU-Region, z.B. Frankfurt), Free zum Bauen, Pro vor Launch | DB, Auth, Storage; DSGVO-Trennung; Free pausiert nach 7 Tagen Inaktivität | Free 0 $; **Pro 25 $/Monat pro Organisation** (inkl. 10 $ Compute-Credit = eine Micro-Instanz); jede weitere Live-DB = zusätzliche Compute-Kosten → real ~35–75 $/Monat bei zwei aktiven Projekten | **P0** |
| 4 | **E-Mail-Dienst** — Resend (empfohlen, React-Email, ~15-Min-Setup) | Buchungsbestätigungen; Domain-Verifikation (SPF/DKIM/DMARC) zwingend | Free 3.000 Mails/Monat **aber hartes Limit 100 Mails/Tag & 1 Domain**; Pro 20 $/Monat (50.000) | **P0** |
| 5 | **Domains** — 2 getrennte (mymallorcaboats.* + Promoter-Domain) + DNS | Rechtliche/technische Trennung | ~10–40 €/Jahr je Domain | **P0** |
| 6 | **Stripe** — spanisches Geschäftskonto, Verifizierung (legal name, NIF/CIF, Bank, ID exakt wie in den Unterlagen), Live-Keys; idealerweise 2 Accounts | Zahlungen + Anzahlungen; getrennte Zahlungsströme | **1,5% + 0,25 €** (national); **3,25% + 0,25 €** intl. Karten; **+1%** Währungsumrechnung; **15 €** pro Chargeback | **P0** |
| 7 | **Hosting (AOVO-Server)** — Node-Runtime, Reverse-Proxy (Nginx/Caddy), TLS (Let's Encrypt), CI/CD-Deploy, Env-Vars/Secrets, Backups, Monitoring | Next.js 16 Deployment beider Apps | Serverkosten trägt Marcos Startup; Zeit | **P0** |
| 8 | **Rechtstexte finalisieren** — Impressum/aviso legal, AGB, Datenschutz, Cookie-Consent, Widerrufs-/Stornobedingungen — je Projekt getrennt | DSGVO + span. Recht + LSSI-CE (E-Commerce-Gesetz) | Anwalt (im Gestor-Paket) | **P0** |
| 9 | **WhatsApp Business** — für Kundenkommunikation | Kunden erwarten WhatsApp auf Mallorca | Business App gratis; API: seit 1.7.2025 per-message ~0,01–0,12 €/Nachricht je Land/Kategorie, Service-Antworten im 24h-Fenster frei; BSP-Aufschlag (Twilio/360dialog/Wati) ~0,003–0,01 € | **P1** |
| 10 | **Bildrechte/Einwilligungen** — KI-Lizenzen (kommerziell) prüfen, Gäste-Foto-Consent, keine fremden Marken/Boote | Vermeidung Urheber-/Persönlichkeitsrechtsverletzung | gering | **P1** |
| 11 | **Reseller-/Affiliate-Konten** — GetYourGuide, Viator, Bókun, ggf. Regiondo | Wasseraktivitäten-Angebot (Punkt 3) | 0 € Setup; Provision/Buchungsgebühr | **P1** |
| 12 | **Betriebshaftpflicht (RC)** für Vermittlung + ggf. Kaution/Garantie | Falls Lizenz als intermediación nötig | je nach Police/Kaution | **P1** |
| 13 | **Error-Monitoring** (Sentry), **Uptime-Monitoring**, **Backups-Test** | Betriebssicherheit | Sentry Free/ab ~26 $ | **P1** |
| 14 | **Analytics** (datenschutzkonform, z.B. Plausible/Umami) | Conversion-Optimierung | ~9 $/Monat oder self-hosted | **P2** |

### 10. Risiko-Register (~100 Risiken + Absicherung)

**Kritischste zuerst (P0):**

**Rechtlich/Compliance:**
1. Balearische Lizenzpflicht (intermediación turística) übersehen → Bußgeld/Schließung. *Absicherung: Conselleria de Turisme + Anwalt vor Launch.*
2. Ungewollt Pauschalreise-Veranstalter durch Bündelung (Tour+Transfer/Übernachtung) → Insolvenzabsicherungspflicht. *Nur Einzelleistungen <24h verkaufen; keine Bündel ohne Prüfung.*
3. Irreführende Werbung (Boot/Yacht gezeigt, das nicht kommt) → Abmahnung/Verbraucherschutz. *Nur generische Ästhetik + "Partnerboot je nach Verfügbarkeit".*
4. Keine saubere Trennung der zwei Geschäfte → Durchgriffshaftung. *2 Rechtsträger/Domains/DBs, dokumentiert.*
5. Promoter als Scheinselbständige (falso autónomo) → Nachzahlungen Seguridad Social. *Verträge + Anwalt.*
6. Handelsvertreter-Ausgleich (Ley 12/1992 Art. 28) bei Promoter-Kündigung. *Vertragsgestaltung comisionista vs. agente.*
7. DSGVO-Verstoß durch projektübergreifende Datennutzung → Bußgeld bis 4% Umsatz. *Strikte DB-Trennung, DPAs, Verarbeitungsverzeichnis.*
8. Fehlender/fehlerhafter Cookie-Consent (LSSI-CE/DSGVO). *CMP einbauen.*
9. AGB/Widerruf/Storno nicht rechtskonform. *Anwaltlich prüfen je Projekt.*
10. Stripe-Zahlungsströme vermischt → Buchhaltung/Steuer unklar. *2 Accounts.*
11. IVA/Steuer auf Provisionen falsch behandelt. *Gestor.*
12. Bildrechte (KI-Lizenz kommerziell? Gäste-Consent fehlt). *Lizenzen + Einwilligungen.*
13. Markenrecht: "MyMallorcaBoats" nicht geschützt/kollidiert. *Recherche + Registro Marca (OEPM).*
14. Barrierefreiheit (EU Accessibility Act ab 2025 für E-Commerce). *WCAG-Grundlagen umsetzen.*
15. Führerscheinfreie Vermietung ab Okt. 2026 verboten → Angebotszweig wegfällt. *Nur geskipperte Touren.*

**Technisch:**
16. Doppelbuchung trotz Schutz (Race Condition Edge Case). *Atomare Transaktion + Load-Tests + DB-Constraint.*
17. Supabase Free-Projekt pausiert (7 Tage) → Ausfall. *Pro-Tier vor Launch.*
18. Egress-/Compute-Limit überschritten → 402/Service-Stopp. *Spend-Cap + Monitoring.*
19. Beim Heraustrennen des Promoter-Codes bricht Boots-App. *Snapshot/Hash-Vergleich + Tests (Punkt 6).*
20. Geteilter Core-Package-Bug wirkt in beiden Apps. *Umfassende Unit-Tests im core.*
21. Payload/Dependency-Sicherheitslücke (SQL-Injection CVSS 9.8 Beispiel). *Dependabot + zeitnahe Updates.*
22. Secrets im Git/Client geleakt (Stripe/Supabase Service-Key). *Env-Vars server-only, Secret-Scanning.*
23. Kein Backup/Restore getestet. *Tägliche Backups + Restore-Drill.*
24. AOVO-Server Single Point of Failure (kein CDN/Redundanz). *CDN (Cloudflare) + Health-Checks + Failover-Plan.*
25. TLS-Zertifikat läuft ab. *Auto-Renew (Caddy/Let's Encrypt).*
26. GSAP/Three.js Performance killt Mobile/SEO. *Lazy-load, prefers-reduced-motion, LCP messen.*
27. Bild-Uploads sprengen Storage/brechen Layout. *Client-Komprimierung + Crop + Limits.*
28. Nicht-Programmierer (Gabo) zerstört Layout im Page-Builder. *Feste Blöcke + Zod-Validierung + Preview + Undo.*
29. RLS (Row Level Security) falsch → Datenleck zwischen Usern/Promotern. *RLS-Policies testen.*
30. Auth-Fehlkonfiguration (JWT/Session). *Supabase Auth Best Practices + Tests.*
31. Webhook (Stripe/Supabase) nicht idempotent → Doppelverarbeitung. *Idempotency-Keys + Queue.*
32. E-Mail landet im Spam (fehlendes SPF/DKIM/DMARC). *Domain verifizieren, warmup.*
33. Zeitzonen-Bug bei Abfahrtszeiten (13:00/14:00/14:30). *UTC speichern, Europe/Madrid rendern.*
34. Race bei Lagerbestand mehrerer Partnerboote. *Zentrale Verfügbarkeits-Logik + Locking.*
35. Next.js 16 / Tailwind 4 Breaking Changes bei Update. *Versions-Pinning + CI.*
36. API-Rate-Limits der OTA-Partner (GYG/Viator/Bókun). *Caching + Backoff.*
37. Kein Error-Monitoring → stille Fehler. *Sentry.*
38. Fehlende Tests für Buchungs-Flow. *E2E (Playwright) für Kern-Flow.*
39. Datenverlust bei Migration/Schema-Change. *Migrations versioniert + Backup vorher.*
40. Lenis/Smooth-Scroll bricht Anker-Links/Accessibility. *Fallbacks + Tests.*

**Geschäftlich/Finanziell:**
41. Provisionsmarge zu dünn (Affiliate 8% vs. Reseller 20–30%). *Reseller-Verträge mit Netto-Rate + eigenem Aufschlag.*
42. Abhängigkeit von 3–4 Partnerbooten → Ausfall eines Partners. *Mehr Partner akquirieren, Redundanz.*
43. Saisonalität (Sommer-Peak) → Cashflow. *Puffer + Nebensaison-Angebote.*
44. Stornoquote/No-Shows. *Anzahlung 30 € + klare Stornobedingungen.*
45. Chargebacks/Betrug (Stripe, 15 €/Chargeback). *3D-Secure/Radar.*
46. Promoter unterschlagen Bargeld ("Rest im Bus"). *Digitale Erfassung + Abrechnungskontrolle.*
47. Preis-Fehler durch Gabo im Admin. *Bestätigungsdialog + Plausibilitätscheck.*
48. Währungs-/Gebührenverluste (intl. Karten +3,25%, +1% FX). *Einpreisen.*
49. Fehlende KPIs → Blindflug. *Analytics + Dashboard.*
50. Klumpenrisiko OTA-Sperrung (GYG/Viator Account-Ban). *Diversifizieren + eigener Direktkanal.*

**Betrieblich:**
51. Gabo überfordert mit Admin-Dashboard. *Onboarding + einfache UI + Doku.*
52. Sprachfehler in 10 Sprachen (KI-Übersetzung). *Muttersprachler-Review Kernsprachen.*
53. Support-Last (WhatsApp) unterschätzt. *FAQ + Automatisierung + Service-Fenster (frei) nutzen.*
54. Wetterabhängige Absagen → Umbuchung-Chaos. *Automatische Umbuchungs-/Refund-Flows.*
55. Kapazitäts-Sync zwischen Partnern manuell/fehleranfällig. *API-Sync oder klare Prozesse.*
56. Kein Notfall-Kontakt bei Buchungsproblemen am Steg. *Hotline/WhatsApp-Bereitschaft.*

**Sicherheit/Datenschutz (zusätzlich):**
57. DDoS/Bot-Traffic. *Cloudflare WAF.*
58. Brute-Force auf Promoter-Login. *Rate-Limit + 2FA.*
59. XSS über CMS-Freitextfelder. *Sanitize + CSP.*
60. CSRF. *SameSite-Cookies + Tokens.*
61. Personendaten unverschlüsselt. *TLS + at-rest-Encryption (Supabase default).*
62. Log-Files enthalten PII. *PII-Masking.*
63. Aufbewahrungsfristen missachtet. *Data-Retention-Policy.*
64. Auskunfts-/Löschbegehren (DSGVO) nicht erfüllbar. *Prozess + Export/Delete-Funktion.*

**Weitere (65–100, komprimiert, je mit Kurz-Absicherung):**
65. Kein Impressum → Abmahnung (*aviso legal einbauen*). 66. Fehlende Preisangaben-Transparenz (*Endpreise inkl. Steuern*). 67. Keine Bestätigungsseite/Beleg (*PDF-Voucher*). 68. Kein AV-Vertrag mit Supabase/Stripe/Resend (*DPAs unterzeichnen*). 69. Server außerhalb EU (*EU-Region wählen*). 70. Kein Cookie-Log/Consent-Nachweis (*CMP mit Log*). 71. Uptime-SLA fehlt (*Monitoring + Statuspage*). 72. Keine Versionierung der Rechtstexte (*Timestamped ADR*). 73. Keine Rollen-/Rechte-Trennung im Admin (*RBAC*). 74. Gabo-Account kompromittiert (*2FA*). 75. Keine Audit-Logs (*Activity-Log*). 76. KI-Bild verletzt Persönlichkeitsrecht (*keine realen Gesichter*). 77. Falsche Verfügbarkeitsanzeige → Überbuchung (*Realtime-Sync*). 78. Refund-Prozess unklar (*automatisiert + dokumentiert*). 79. Steuerliche Behandlung Anzahlung vs. Restzahlung (*Gestor*). 80. Fehlende Rechnung an Kunden (*automatische factura*). 81. Promoter-Provisionsabrechnung intransparent (*Dashboard + Report*). 82. Vertrag mit Partnerbooten fehlt/unklar (*Reseller-Verträge*). 83. Haftung bei Unfall auf dem Boot (*klare Rollen: Partner haftet; RC-Police*). 84. Minderjährige/Alkohol an Bord (*AGB + Partnerpflicht*). 85. Barrierefreiheits-Klage (*WCAG*). 86. SEO-Verlust bei Relaunch (*Redirects 301*). 87. Markenverwechslung mit "Barca Samba" Altmarke (*klare Migration/Kommunikation*). 88. Negative Reviews wegen Boot-Wechsel-Erwartung (*klare Kommunikation vorab*). 89. Datenmigration von Alt-Projekt fehlerhaft (*Test-Migration*). 90. Abhängigkeit von einem Entwickler (Marco) (*Doku + ADRs*). 91. Kein Disaster-Recovery-Plan (*RTO/RPO definieren*). 92. Third-Party-JS bricht Datenschutz (*self-host wo möglich*). 93. Push/E-Mail ohne Opt-in (*Double-Opt-in*). 94. Überhöhte WhatsApp-Kosten bei Marketing (*Service-Fenster nutzen, Utility-Templates*). 95. Rate-Card-Änderungen WhatsApp/Stripe (*Kosten-Monitoring*). 96. Fehlende Tests nach Claude-Code-Änderung (*CI-Gate*). 97. Doku veraltet → Claude baut falsch (*"nach jeder Aufgabe dokumentieren"-Regel*). 98. Monorepo-Fehlkonfiguration koppelt DBs (*klare Package-Grenzen*). 99. Kein Rollback-Plan bei Deploy (*Blue-Green/Tags*). 100. Compliance mit EU-KI-Kennzeichnung generierter Inhalte (*ggf. KI-Bilder kennzeichnen*).

### 11. Zehn Verbesserungen, an die Marco/Gabo evtl. noch nicht gedacht haben

1. **Dynamische Verfügbarkeits-Engine über alle 3–4 Partnerboote** mit automatischer Zuweisung + Overbooking-Puffer: maximiert Auslastung, verhindert Doppelbuchung, ermöglicht "je nach Verfügbarkeit" auch technisch sauber.
2. **Upsell/Cross-Sell der Wasseraktivitäten (Punkt 3) im Checkout** (Jetski, Sunset, Schnorcheln als Add-on via Bókun/GYG-API) → zusätzliche Provisionsmarge pro Buchung ohne eigenes Personal.
3. **Digitale Promoter-App mit QR-Ticket + Live-Provisionsdashboard** statt Bargeld-Zettel: reduziert Unterschlagung, macht die 10+1-Gruppenregel und 30-€-Anzahlung nachvollziehbar, Echtzeit-Abrechnung.
4. **Wetter-API-Integration** mit automatischem Umbuchungs-/Refund-Flow bei Absage → weniger Support, bessere Reviews.
5. **Automatisierte mehrsprachige Review-Sammlung** (nach der Tour WhatsApp/E-Mail) + Anzeige auf der Seite → Social Proof + SEO; Google Things to Do (0% Provision) als zusätzlicher Kanal.
6. **Dynamic Pricing** (Auslastung/Saison/Wochentag) im Admin — Gabo setzt Regeln, System optimiert Preise wie eine Airline.
7. **Gutschein-/Geschenk-Voucher-System** (winterfester Umsatz, Cashflow in Nebensaison).
8. **Direktkanal-Loyalty statt OTA-Abhängigkeit:** eigener Newsletter/WhatsApp-Broadcast + Wiederkunden-Rabatt, um GYG/Viator-Provision langfristig zu umgehen.
9. **Barrierefreiheit + Core-Web-Vitals als Wettbewerbsvorteil** (EU Accessibility Act ist ohnehin Pflicht) — bessere SEO + größere Zielgruppe.
10. **"Trust-Layer":** transparente Anzeige "durchgeführt von geprüftem Partner mit gültiger Lizenz & Versicherung" + klare Boot-Wechsel-Erklärung → verwandelt die boote-neutrale Schwäche in ein Vertrauens-Feature.

---

## Recommendations

**Sofort (vor jeder weiteren Zeile Code am Live-Produkt):**
1. **Anwalt + Gestor auf Mallorca beauftragen** — zwei Fragen priorisiert klären: (a) Braucht die Vermittlung einzelner Ausflüge eine balearische intermediación-turística-/agencia-Lizenz? (b) Wie trennt man die zwei Geschäfte rechtlich (1 oder 2 Rechtsträger, autónomo vs. SL)? Benchmark, der die Entscheidung kippt: Wenn Lizenz nötig → Reseller-Modell (Marco kassiert) evtl. zugunsten reines Affiliate-Modell (GYG-Deeplink/Widget) zurückstellen, bis Lizenz vorliegt.
2. **Supabase: zwei getrennte Projekte in EU-Region**, Pro-Tier aktivieren bevor echte Kunden buchen (Free pausiert nach 7 Tagen).
3. **Monorepo aufsetzen** (pnpm + Turborepo), Core-Reservierungslogik in `packages/core` extrahieren — MIT Snapshot/Hash-Vergleich vorher/nachher, damit die Boots-App nachweislich unverändert läuft.

**Kurz danach (P1):**
4. Rechtstexte je Projekt finalisieren; Stripe (2 Accounts) + Resend + Domains einrichten (SPF/DKIM/DMARC).
5. Page-Builder als block-basiertes System in Supabase bauen (6–10 feste Block-Typen, Zod-Validierung, Preview, Undo, dnd-kit-Reihenfolge).
6. Affiliate-/Reseller-Konten (GYG, Viator, Bókun) eröffnen; mit reinen Deeplinks/Widgets starten (kein Lizenzrisiko), Reseller-API erst nach Lizenzklärung.

**Später (P2):**
7. WhatsApp Business API, Dynamic Pricing, Voucher-System, Review-Automation.

**Benchmarks, die Entscheidungen ändern:** SL statt autónomo ab ~50–60k € Jahresgewinn; Supabase-Compute hochstufen ab ~2.000 DAU / langsamen Queries; von Affiliate zu Reseller-Modell wechseln erst, wenn Lizenzfrage positiv geklärt ist und Buchungsvolumen die Marge rechtfertigt.

## Caveats
- **Kein Rechtsrat.** Alle rechtlichen Punkte (Lizenz, Gesellschaftsform, Handelsvertreter, DSGVO, Werbung, Steuern) sind mit spanischem Anwalt/Gestor zu verifizieren. Besonders die **balearische Lizenzfrage** (Ley 8/2012) ist NICHT abschließend geklärt und potenziell geschäftskritisch — die verfügbaren Quellen bestätigen die Nicht-Anwendung des Pauschalreiserechts bei Einzelleistungen, aber die regionale administrative Lizenzpflicht für gewerbliche Online-Vermittlung ist offen.
- Provisions-/Preisangaben (GYG mind. 8%, Viator 8% Affiliate / 20–30% Operator, Bókun 1–1,5%, Stripe 1,5%+0,25 €, Supabase Pro 25 $/Organisation, Resend 3.000/Monat gratis mit 100/Tag-Limit, WhatsApp per-message) sind Stand 2025/2026 und können sich ändern — vor Vertragsabschluss auf den Anbieterseiten prüfen.
- Marketing-Behauptungen der Tool-Anbieter (z.B. "worry-free", "best-in-class") sind als solche gekennzeichnet und nicht als belegte Fakten zu werten.
- Die Aussage "Privatboote ohne Führerschein ab 2026/2027 verboten" ist präzisiert: **RD 1188/2025 (BOE-A-2025-27010)**, Stichtag **1. Oktober 2026**, betrifft nur *gewerbliche Vermietung* an Endkunden ohne Qualifikation — geskipperte Touren sind ausgenommen.
- Wörtliche AGB-Zitate von GetYourGuide und Viator stammen aus deren offiziellen Terms/Partner-Agreements; die exakte Civitatis-Verbraucher-AGB-Formulierung und eine explizite "konkretes Boot je nach Verfügbarkeit"-Klausel in Plattform-AGB konnten nicht verbatim belegt werden (letztere existiert meist nur auf Produkt-/Betreiberebene).