# ETAPPE5_PLAN.md — Etappe 5: Promoter-Verkauf + vollwertiges Promoter-Dashboard

**Status: Vorschlag (Claude, 30.09.2026) — nichts davon ist gebaut oder entschieden.** Auftrag Marco 30.09.2026 („PLANE Etappe 5 … baue noch NICHTS"). Verbindlich werden Teile erst, wenn Marco sie bestätigt; dann wandern die Schritte als Haken-Liste nach `TASKS.md` und die Entscheidungen nach `docs/DECISIONS.md`. Diese Datei ist ein Plan-Dokument (Referenz), keine Regel-Datei.

Vorbedingung erledigt: E3.4/F14 committet (`7055ac3`, `7affad4`, `719fc38`, `8b6d723`, 30.09.2026), `npm test` 125/125.

---

## 0. Umfang (Marcos sechs Punkte) und was NICHT dazugehört

| # | Marco (30.09.2026) | Im Plan als |
|---|---|---|
| 1 | Vollwertiges Promoter-Dashboard: Übersicht (heute/gesamt verkauft, verdiente Provision), Liste verfügbarer Events inkl. interne, pro Event verkaufen | E5.4 (Dashboard lesend), E5.5 (Verkauf) |
| 2 | Verkauf pro Buchung: Ticketzahl, Vollzahler ODER Anzahlung, Gesamtpreis/Anzahlung/Rest klar sichtbar, 10+1 automatisch, Provision als Snapshot, atomar gegen Kontingent (8-parallel-Test) | E5.1 (Spalten), E5.3 (Funktionen + Tests), E5.5 (Flow) |
| 3 | Flexible Beträge: 30 €/Person ODER Gesamtbetrag ODER Vollzahlung, je nach Promoter/Event; interne Events mit eigenem Preis/Anzahlung (F14) | E5.2 (Anzahlungsbasis als Daten) + F14 (fertig) |
| 4 | Eventvorlagen: Titel, Beträge, Kontingent, Provision, Bild → neues Event nur mit Datum/Uhrzeit | E5.8 |
| 5 | Bilder pro Event/Vorlage (Supabase Storage), Anzeige im Promoter-Dashboard, nur network_operator lädt hoch, Größenlimit | E5.7 |
| 6 | Nachrichten-Auslöser ohne Versand: Bestätigung + Erinnerung 4 h/1 h als „ausstehend" in der DB | E5.6 |

**Nicht Teil von E5** (bleibt in den bestehenden Etappen): Konto-Verwaltung durch Gabo (E4 — E5 braucht sie nicht, lokal reicht der Seed-Promoter), Storno/Freigabe und Storno-Provision (E7, F10 — im Dashboard nur der Hinweis „Storno, Provision ungeklärt"), CSV-Export/Auswertung für Gabo (E7), echter Nachrichtenversand (eigener Schritt nach F20), Cloud/Domain (E8). Operator im Promoter-Bereich (F13) bleibt strikt getrennt, bis Marco es anders sagt.

---

## 1. Tragende Designentscheidungen (zur Bestätigung durch Marco)

### D1 — Ein Rechenweg in der Datenbank: `quote_promoter_sale()`

Alle Beträge einer Buchung (Gesamtpreis, Anzahlung, Rest, Gratisplätze, Provision) werden **an genau einer Stelle** berechnet: in einer SQL-Funktion `quote_promoter_sale(termin, personen, zahlart, zeitpunkt)`. Der Bestätigungsschritt zeigt ihr Ergebnis; die Reservierungsfunktion ruft **dieselbe** Funktion erneut auf und vergleicht mit dem, was der Promoter bestätigt hat (Abweichung → Fehler `QUOTE_CHANGED`; der Promoter sieht die neuen Beträge und bestätigt erneut). Damit gibt es keine zweite Implementierung in TypeScript, die auseinanderlaufen kann, und eine Regeländerung durch Gabo zwischen Anzeige und Klick wird nie still übernommen. TypeScript formatiert nur.

Eingaben der Quote: `effective_price_cents('ticket_price')`, `effective_deposit()` (neu, E5.2: Betrag **und** Basis), `effective_commission_cents()`, `effective_group_rule()` — alles vorhandene bzw. additive Regel-Funktionen. **Kein Zugriff auf `seats_booked_total`/`capacity_total`** — die Quote rechnet Geld, nie Kapazität; die Kapazität prüft ausschließlich das atomare UPDATE (Hard Rule 4).

### D2 — F12: neue Funktion `reserve_promoter_seats()` **neben** der Handover-Funktion (Option B) — Empfehlung geändert

Bisheriger Vorschlag (TASKS E5.1, RISKS F12) war Option A: `CREATE OR REPLACE` mit erweiterten Parametern. Das trägt bei genauem Hinsehen nicht: Postgres legt bei geänderter Parameterliste **eine zweite Überladung** an und ersetzt nichts. Entweder müsste die Original-Funktion per `DROP` weg (dann bricht `tests/reserve-function-unchanged.test.ts`, und Hard Rule 4 verlöre ihren Nachweis), oder es existieren zwei `reserve_departure_seats`, zwischen denen `supabase.rpc()`/PostgREST anhand der Parameternamen wählen muss (Fehlerquelle „could not choose the best candidate function"). Deshalb **Option B**:

- `reserve_departure_seats()` aus 0002 bleibt **byteidentisch** stehen; `tests/reserve-function-unchanged.test.ts` bleibt unverändert grün und ist weiterhin die Referenz.
- `reserve_promoter_seats(...)` ist eine eigene Funktion. Ihr Kapazitätsblock ist **wörtlich** der aus der Handover-Datei (dasselbe eine UPDATE, dieselbe WHERE-Klausel, kein SELECT davor, kein Locking). Ein neuer Test extrahiert den UPDATE-Block aus `pg_get_functiondef` beider Funktionen und vergleicht ihn textgleich (Hard Rule 4, RISKS Nr. 3/23). Der 8-parallel-Test läuft zusätzlich gegen die neue Funktion.
- `release_departure_seats()` bleibt unverändert und wird in E7 für Storno wiederverwendet (sie kennt nur `booking_id` und `seats`, das passt auch für Promoter-Buchungen).

### D3 — Reservieren als eingeloggter Promoter, nicht mit `service_role`

`reserve_promoter_seats()` ist `security definer` (wie das Original), aber **für `authenticated` ausführbar**; die Handover-Funktion bleibt `service_role`-only. In der Funktion: `promoter_id := auth.uid()`, Abbruch mit `NOT_A_PROMOTER`, wenn `current_profile_role() <> 'promoter'` (inaktives Profil → NULL → Abbruch, damit ist TASKS E4.2 „deaktivierter Promoter kann nicht verkaufen" DB-seitig erfüllt). Vorteile: Der Verkaufs-Pfad braucht keinen Service-Key im App-Prozess (RISKS Nr. 9; DECISIONS 29.09. Punkt 8: „nie über service_role"), die Promoter-ID ist nicht fälschbar, RLS-Tests können die Funktion direkt als Promoter aufrufen. Die Server Action prüft trotzdem zuerst `requireArea("promoter")` (Next.js-16-Guide: Actions sind eigene Einstiegspunkte).

### D4 — Idempotenz: Schlüssel pro Bestätigungsseite + eindeutiger Index (RISKS Nr. 11)

Beim Rendern des Bestätigungsschritts entsteht ein `idempotency_key` (UUID, hidden field). `bookings.idempotency_key` bekommt einen eindeutigen Index. Ablauf in der Funktion: (1) `select … where idempotency_key = p_key` → gefunden = dieselbe Buchung zurückgeben, nichts tun; (2) sonst normal weiter. Rennen zwei identische Doppelklick-Anfragen gleichzeitig durch (1), erhöhen beide den Zähler, aber der zweite `INSERT` scheitert am Index → seine ganze Transaktion inkl. UPDATE rollt zurück. Ergebnis: eine Buchung, Zähler genau einmal erhöht — **ohne Änderung am UPDATE-Block**. Die App fängt `23505` ab und lädt die Buchung per Schlüssel. Test: 2 parallele Aufrufe mit gleichem Schlüssel → 1 Buchung, `seats_booked_total` +Personen genau einmal.

### D5 — Snapshots pro Buchung (Hard Rule 7, RISKS Nr. 21/22)

Jede Promoter-Buchung speichert, was zum Verkaufszeitpunkt galt: Ticketpreis/Person, Anzahlung (Betrag + Basis), Provision/Ticket, Gruppenregel (Schwelle, Gratis), Personen, bezahlte Plätze, Gratisplätze, Gesamtbetrag, kassierter Betrag, offener Rest (generierte Spalte `total − paid`, kann nicht abweichen), Provision gesamt. Auswertung (E6/E7) rechnet **nur** mit Snapshots, nie mit der aktuellen Regel.

### D6 — Nachrichten als Datensätze in derselben Transaktion, kein Trigger

Die Nachrichten-Zeilen (Bestätigung sofort, Erinnerung 4 h und 1 h vor `starts_at`) entstehen **innerhalb** von `reserve_promoter_seats()` nach dem `INSERT` in `bookings` (Aufruf einer eigenen Funktion `enqueue_booking_notifications(booking_id)`), damit Buchung und Nachrichten atomar zusammen existieren. Kein Trigger auf `bookings` (unsichtbare Nebenwirkung) und keinesfalls auf `tour_departures` (0004-Kopf: „Kein Trigger auf tour_departures"). Versand ist ein späterer, getrennter Prozess, der `status = 'pending' and scheduled_for <= now()` abarbeitet.

### D7 — Vorlagen sind editierbare Stammdaten, Events kopieren die Werte

`event_templates` darf Gabo ändern/deaktivieren (kein append-only nötig — Vorlagen sind keine Abrechnungs-Historie). „Event aus Vorlage" **kopiert** alle Werte in `tour_departures` + `pricing_rules`-/`commission_rules`-Ausnahmen; spätere Vorlagen-Änderungen berühren bestehende Events nie. `tour_departures.template_id` (nullable) merkt nur die Herkunft.

### D8 — Bilder: privater Bucket, signierte URLs, nur network_operator schreibt

Bucket `event-images` (privat, 5 MiB, `image/jpeg|png|webp`). Storage-Policies: INSERT/UPDATE/DELETE nur `is_network_operator()`, SELECT für aktive Profile. Das Promoter-Dashboard bekommt serverseitig signierte URLs (1 h gültig). Alternative „öffentlicher Bucket" wäre einfacher (kein Signieren), macht die Bilder aber für jeden mit Link lesbar → F19.

---

## 2. Rechenregel einer Buchung (was `quote_promoter_sale()` liefert)

```
personen           = Eingabe (>= 1)
schwelle, gratis   = effective_group_rule()               (heute 11 / 1)
gratisplaetze      = personen >= schwelle ? gratis : 0     (Mehrfach-Blöcke → F18)
bezahlte_plaetze   = personen − gratisplaetze
preis_pp           = effective_price_cents('ticket_price') (NULL → Termin NICHT verkaufbar, F15)
gesamt             = bezahlte_plaetze × preis_pp
provision          = bezahlte_plaetze × effective_commission_cents()   (DECISIONS 16.09.: „Provision für 10")

zahlart 'full':     kassiert = gesamt, rest = 0
zahlart 'deposit':  basis = effective_deposit().basis
    'per_person':   kassiert = (personen ODER bezahlte_plaetze, F11) × anzahlung_pp
    'per_booking':  kassiert = fester Betrag pro Buchung (Gabo-Vorgabe, F16)
                    kassiert = min(kassiert, gesamt)   (nie mehr als der Gesamtpreis)
                    rest     = gesamt − kassiert
sitze fuer reserve = personen   (IMMER Personen, nie bezahlte Plätze — RISKS Nr. 22)
```

Beispiele (angenommen Preis 40,00 €, Anzahlung 30,00 €/Person, Provision 10,00 €, Regel 11/1 — der Preis ist ein Rechenbeispiel, kein Vorschlag für F15):

| Fall | Sitze | bezahlt | Gesamt | kassiert | Rest im Bus | Provision |
|---|---|---|---|---|---|---|
| 3 Personen, Anzahlung | 3 | 3 | 120,00 | 90,00 | 30,00 | 30,00 |
| 3 Personen, Vollzahlung | 3 | 3 | 120,00 | 120,00 | 0,00 | 30,00 |
| 11 Personen, Anzahlung | 11 | 10 | 400,00 | 300,00 **oder** 330,00 (F11) | 100,00 / 70,00 | 100,00 |
| 3 Personen, Event mit Anzahlung „100 € pro Buchung" | 3 | 3 | 120,00 | 100,00 | 20,00 | 30,00 |
| Termin ohne Ticketpreis (F15) | — | — | nicht verkaufbar | | | |

---

## 3. Teilschritte — Reihenfolge, Abhängigkeiten, DB-Erweiterungen

Jeder Schritt = ein prüfbarer Commit (gezielt per Pfad), verifiziert bevor abgehakt (Hard Rule 3/8). Migrationen fortlaufend ab **0006**, nur additiv. Jede Migration mit `create table` läuft durch die gehärteten Default-Privilegien (RISKS Nr. 25) — Grant-Erwartungsliste in `tests/events-rules-rls.test.ts` jeweils ergänzen.

```
E5.0 Entscheidungen ─┬─► E5.1 bookings-Spalten + RLS ─► E5.2 Anzahlungsbasis/10+1-Option ─► E5.3 quote + reserve_promoter_seats + Tests
                     │                                                                                   │
                     │                                          E5.4 Dashboard (lesend) ◄────────────────┘
                     │                                                    │
                     │                                          E5.5 Verkaufs-Flow  ◄── erster echter Verkauf möglich
                     │                                                    │
                     ├─► E5.6 Nachrichten (Tabelle + enqueue in reserve_promoter_seats + Admin-Sicht)
                     ├─► E5.7 Bilder (Bucket, Policies, Upload, Anzeige)
                     └─► E5.8 Eventvorlagen (braucht E5.7 für das Vorlagen-Bild)
                                                                          │
                                                                E5.9 Doku-Abschluss + Browser-Test Marco
```

E5.6, E5.7, E5.8 hängen nur an E5.0/E5.1 und könnten parallel zu E5.4/E5.5 laufen; empfohlene Reihenfolge ist trotzdem linear (erst verkaufen können, dann Komfort).

### E5.0 — Entscheidungen einholen (kein Code) · Gate

Antworten von Marco/Gabo, die in Migrationen landen und deshalb **vorher** feststehen müssen: **F8, F11, F12 (D2), F15, F16, F18** — plus Bestätigung von D1–D8. F13, F17, F19, F20, F21, F22 dürfen bis zum jeweiligen Schritt offen bleiben (Abschnitt 5). Ergebnis: DECISIONS-Eintrag „Etappe 5", RISKS-Fragen auf „geklärt", Schritte nach `TASKS.md`.

### E5.1 — Migration `0006_bookings_promoter_columns.sql` + Lese-Policies

DB (additiv auf `bookings`):
- `promoter_id uuid references profiles(id)` (NULL bei Nicht-Promoter-Buchungen; Index)
- `idempotency_key uuid` + eindeutiger Index (partiell `where idempotency_key is not null`)
- `persons integer` (= `seats`, ausgeschrieben zur Lesbarkeit), `paid_seats integer`, `free_persons integer`, Check `persons = paid_seats + free_persons`
- Snapshots: `ticket_price_cents_snapshot`, `deposit_basis_snapshot` (Text oder Enum aus E5.2), `deposit_amount_cents_snapshot`, `commission_per_ticket_cents_snapshot`, `group_threshold_snapshot`, `group_free_snapshot`, `commission_total_cents`
- `amount_due_cents integer generated always as (total_amount_cents − amount_paid_cents) stored` (Rest im Bus)
- `sold_at timestamptz` (= Zeitpunkt der Quote; `created_at` bleibt der technische Zeitstempel)
- Check: für `channel = 'promoter'` müssen `promoter_id`, Snapshots und `idempotency_key` gesetzt sein (Hard Rule 7 DB-seitig erzwungen)
- `customer_email` → je nach F8 `alter column … drop not null` (0001 bleibt unberührt); die Handover-Funktion ist davon nicht betroffen (sie übergibt weiterhin einen Wert)
- RLS: `bookings_select_own_promoter` (`promoter_id = auth.uid()` und aktiv), `bookings_select_network_operator`; `grant select on bookings to authenticated`. **Kein INSERT/UPDATE/DELETE-Grant** — Schreiben nur über die Funktionen.

Tests (`tests/bookings-rls.test.ts`): Promoter sieht nur eigene Zeilen, Operator alle, inaktiv nichts, anon nichts, INSERT/UPDATE als authenticated → `permission denied`, Check-Constraints greifen, `amount_due_cents` rechnet. E1-Tests unverändert grün (der Handover-INSERT trägt nur seine 16 Spalten — neue Spalten sind nullable bzw. haben Defaults; der Check gilt nur für `channel = 'promoter'`).

### E5.2 — Migration `0007_deposit_basis_group_option.sql` + Admin-Felder

DB (additiv):
- `create type deposit_basis as enum ('per_person', 'per_booking')`
- `pricing_rules.basis deposit_basis not null default 'per_person'` (nur für `kind = 'deposit'` relevant; Check: `kind <> 'ticket_price' or basis = 'per_person'`)
- `effective_deposit(termin, zeitpunkt) returns table(amount_cents, basis)` — gleiche Auflösung wie `effective_price_cents`, liefert zusätzlich die Basis; `effective_price_cents('deposit', …)` bleibt für Altcode gültig
- `group_rules.deposit_for_free_persons boolean not null` — die Gabo-steuerbare Option aus F11 (PROGRESS: „Anzahlung pro Person **oder** Gesamtbetrag mit Gruppenbonus-Option, Gabo-steuerbar"); **der Startwert ist F11** und wird nicht geraten
- F17 (Event erlaubt nur Vollzahlung?) → falls ja: dritter Enum-Wert `full_only` gleich hier, sonst nicht

App: Termin-Formular und `/admin/regeln` bekommen „Anzahlung: pro Person / pro Buchung (Gesamtbetrag)" neben dem Betrag; Gruppenregel-Formular bekommt die Option. `planPricingWrites` um die Basis erweitern (neue Zeile auch bei Basis-Wechsel). `depositAbovePriceError` gilt nur für Basis `per_person`.

Tests: `pricing-rules-rls` + `pricing-logic` erweitern (Basis wird historisch korrekt aufgelöst; Ausnahme pro Termin mit anderer Basis; Check greift), `admin-helpers`.

### E5.3 — Migration `0008_reserve_promoter_seats.sql` + Überbuchungs-/Idempotenz-/10+1-Tests · **Kern von E5**

DB:
- `quote_promoter_sale(p_departure_id, p_persons, p_payment_type, p_at default now())` — `security invoker`, `stable`, Rechenregel aus Abschnitt 2, Fehler `NO_TICKET_PRICE`, `NO_GROUP_RULE`, `INVALID_PERSONS`. Für aktive Profile ausführbar (`authenticated`, RLS der Regel-Tabellen gilt).
- `reserve_promoter_seats(p_departure_id, p_persons, p_payment_type, p_idempotency_key, p_expected_total_cents, p_expected_paid_cents, p_customer_name, p_customer_email, p_customer_phone)` — `security definer`, `set search_path = public`, ausführbar für `authenticated`, **nicht** für anon/public. Ablauf: Rolle prüfen (D3) → Idempotenz-Fast-Path (D4) → Quote (D1) und Vergleich mit `p_expected_*` (`QUOTE_CHANGED`) → **das eine atomare UPDATE, wörtlich aus der Handover-Datei** (`p_seats` := Personen) → `SOLD_OUT` bei 0 Zeilen → `INSERT` mit `channel = 'promoter'`, `payment_type`, Snapshots, `status` nach F22 → Rückgabe `bookings`. Kein Stripe, kein Shuttle, keine Allergie (Spalten bleiben mit ihren Defaults).
- `revoke execute … from public, anon`, `grant execute … to authenticated, service_role`.

Tests:
- `tests/reserve-promoter-unchanged-update.test.ts`: UPDATE-Block beider Funktionen aus `pg_get_functiondef` extrahieren (von `update tour_departures` bis `returning id into v_departure_id;`) → textgleich; die Zeile `and seats_booked_total + p_seats <= capacity_total` steht wörtlich darin; kein `select … for update`, kein `pg_advisory` in der Funktion.
- `tests/overbooking-promoter.test.ts`: **8 parallel auf 1 freien Platz → genau 1 Erfolg, 7× `SOLD_OUT`**, Zähler 1; Kontingent 5 → genau 5; Kontingent 0 / Status closed → `SOLD_OUT`; 11 Personen → 11 Sitze belegt, `paid_seats = 10`, Provision 10 × Snapshot; 2 parallele Aufrufe mit gleichem Schlüssel → 1 Buchung; `QUOTE_CHANGED`, wenn Gabo den Preis zwischen Quote und Reservierung ändert; Aufruf als Operator/inaktiv → `NOT_A_PROMOTER`; anon → `permission denied`; `release_departure_seats` gibt eine Promoter-Buchung korrekt frei.
- `tests/quote.test.ts`: Beispieltabelle aus Abschnitt 2 als Fälle, plus Zeitpunkt-Abfrage liefert historische Beträge.
- Vorher wie nachher: `reserve-function-unchanged` grün (Beweis, dass 0002 unberührt ist).

### E5.4 — Promoter-Dashboard (lesend)

`/promoter`:
- **Übersicht**: heute (Ortszeit Mallorca) und gesamt — Buchungen, Personen, kassiert, offener Rest, **verdiente Provision (Summe `commission_total_cents`, nur Status ≠ cancelled; stornierte separat als „Storno, Provision ungeklärt" bis F10)**. Alles aus den eigenen `bookings`-Zeilen über den RLS-Client.
- **Verfügbare Events**: `status = 'open'` und `starts_at` in der Zukunft, inkl. interner Events (Badge „intern"), je mit Datum/Uhrzeit, Titel, Bild (ab E5.7), Ticketpreis, Anzahlung (+Basis), Provision (aus den `effective_*`-Funktionen), **frei = Kontingent − gebucht**, Button „Verkaufen"; ausverkauft → Badge statt Button; ohne Ticketpreis → „kein Preis hinterlegt" statt Button (F15).
- **Meine Verkäufe**: Liste der eigenen Buchungen (Zeit, Event, Personen, Zahlart, kassiert, Rest, Provision, Kunde).

Code: `src/lib/promoter/queries.ts` (getrennt von `lib/admin`), reine Aggregations-Helfer testbar in Vitest. Tests: `app-access` E2E (Promoter sieht Übersicht, Operator → `/kein-zugang`), Aggregations-Helfer.

### E5.5 — Verkaufs-Flow · **erster echter Verkauf**

`/promoter/verkauf/[departureId]`:
1. **Eingabe**: Personen (Zahl, 1…frei), Zahlart (Radio „Anzahlung" / „Vollzahlung" — Anzahlungs-Option nur, wenn das Event eine hat, F17), Kundendaten nach F8 (Name; Telefon/E-Mail Pflicht/optional).
2. **Bestätigung** (eigener Schritt, Server-gerendert): Quote per `quote_promoter_sale()` — Personen, Gratisplätze, Gesamtpreis, **kassiert jetzt**, **Rest im Bus**, Provision — alle Beträge ausgeschrieben in Euro (RISKS Nr. 10); hidden `idempotency_key` + erwartete Beträge; Button „Verbindlich buchen" (deaktiviert nach Klick).
3. **Server Action** `sellSeats`: `requireArea("promoter")`, Validierung, `rpc('reserve_promoter_seats')` über den RLS-Client des Promoters; Fehler-Mapping `SOLD_OUT` → „Ausverkauft — Kontingent inzwischen belegt", `QUOTE_CHANGED` → Bestätigung neu anzeigen, `23505` → Buchung per Schlüssel laden und als Erfolg zeigen.
4. **Erfolgsseite**: Buchungsnummer (kurz), Beträge, Hinweis „Rest im Bus: X €", zurück zum Dashboard.

Tests: reine Parser/Mapper (`tests/sell-logic.test.ts`), E2E über Server-Action-POST (wie der Round-Trip in E3.4): Verkauf → 303 Erfolg, Doppel-POST mit gleichem Schlüssel → eine Buchung, Kontingent 0 → Fehlertext sichtbar (TASKS E5.3), Operator-POST → `/kein-zugang`. Guides vorher lesen: `server-actions.md`, `forms.md`, `data-security.md`.

### E5.6 — Nachrichten-Auslöser (ohne Versand)

DB `0009_notifications.sql`:
- Enums `notification_kind` (`booking_confirmation`, `reminder_4h`, `reminder_1h`), `notification_channel` (`email`, `sms`, `whatsapp` — welcher tatsächlich, entscheidet F20; bis dahin NULL erlaubt), `notification_status` (`pending`, `sent`, `failed`, `cancelled`, `skipped`)
- Tabelle `notifications`: `booking_id` (`on delete cascade`), `kind`, `channel`, `recipient_name`, `recipient_phone`, `recipient_email` (Snapshots aus der Buchung), `scheduled_for`, `status`, `payload jsonb` (vorgerenderter Text, Sprache F21), `attempts`, `last_error`, `sent_at`, `provider_message_id`, Zeitstempel; eindeutig `(booking_id, kind)`
- `enqueue_booking_notifications(booking_id)`: Bestätigung `scheduled_for = now()`, Erinnerungen `starts_at − 4 h` / `− 1 h`; liegt ein Zeitpunkt schon in der Vergangenheit → Zeile mit `skipped` (nachvollziehbar, nicht stumm weggelassen)
- `create or replace function reserve_promoter_seats(...)` — **einzige** Änderung: Aufruf von `enqueue_…` nach dem INSERT; UPDATE-Block-Test und 8-parallel-Test laufen erneut
- RLS: Operator liest alle; Promoter liest die zu eigenen Buchungen; niemand schreibt aus der App (nur Funktionen bzw. der spätere Versand-Prozess mit `service_role`)

App: `/admin/nachrichten` — Liste ausstehend/gesendet/übersprungen mit Filter, **kein Senden-Button** (Versand ist ein späterer Schritt „E5.6b Versand-Adapter" nach F20). Tests: `notifications-rls`, „Verkauf erzeugt genau 3 Zeilen mit korrekten Zeitpunkten in UTC", „Termin in < 1 h → Erinnerungen `skipped`", RLS.

**Was der spätere Versand braucht (F20):** Konto + API-Key je Dienst, Absender-Identität (F21), Cron/Worker (Vercel Cron, Supabase Edge Function oder pg_cron), Opt-in-Text am Strand (RISKS Nr. 16). Der Adapter muss nur `pending` → `sent/failed` setzen — die Tabelle ist dafür vollständig.

### E5.7 — Bilder (Supabase Storage)

DB `0010_event_images.sql`: Bucket `event-images` (privat, `file_size_limit` 5 MiB, `allowed_mime_types` jpeg/png/webp) per `insert into storage.buckets … on conflict do nothing`; Policies auf `storage.objects` (INSERT/UPDATE/DELETE `is_network_operator()` und `bucket_id = 'event-images'`, SELECT `is_active_profile()`); `tour_departures.image_path text` (Spalten-Grant für authenticated INSERT/UPDATE erweitern).

App: Upload-Feld im Termin-Formular (Server Action, `FormData` → `File`; Pfad `departures/<id>/<uuid>.<ext>`, Dateiname nie vom Nutzer; App-seitige Prüfung Größe + MIME zusätzlich zur Bucket-Grenze); `next.config` `serverActions.bodySizeLimit` von 1 MB auf 6 MB (Guide `server-actions.md`, Zeile „Action requests are capped at 1MB by default"); Anzeige in `/admin` und im Promoter-Dashboard über `createSignedUrl` (D8, F19). Kein Bild-Transformations-API (Pro-Plan) — Promoter-Handys laden max. 5 MiB; optionales clientseitiges Verkleinern später.

Tests: Storage-RLS (Promoter/anon können nicht hochladen, anon nicht lesen), 6-MiB-Datei wird abgelehnt, Grant-Liste (`storage.objects` liegt nicht in `public`, deshalb eigener Test).

### E5.8 — Eventvorlagen

DB `0011_event_templates.sql`: `event_templates` (`id`, `name`, `title`, `note`, `is_internal`, `capacity_total`, `ticket_price_cents`, `deposit_cents`, `deposit_basis`, `commission_cents` (NULL = Standard), `image_path`, `active`, `created_by`, `updated_at`); RLS nur `network_operator` (SELECT/INSERT/UPDATE, kein DELETE — deaktivieren statt löschen); `tour_departures.template_id uuid references event_templates` (nullable, Spalten-Grant).

App: `/admin/vorlagen` (Liste, anlegen, bearbeiten, deaktivieren), auf `/admin/termine/neu` oben „Aus Vorlage: [Auswahl]" → Formular vorbefüllt, Gabo setzt nur Datum/Uhrzeit → `createDeparture` schreibt wie bisher Termin + Preis-/Provisions-Ausnahmen (D7). Tests: RLS, „Event aus Vorlage übernimmt alle Werte; spätere Vorlagen-Änderung ändert das Event nicht".

### E5.9 — Doku-Abschluss + Browser-Test

CHANGELOG je Schritt (bereits Pflicht), DECISIONS „Etappe 5", RISKS Nr. 10/11/22/23 auf 🟢 (mit Testbeleg), F-Status, TASKS abgehakt, PROGRESS mit Browser-Anleitung für Marco (Verkauf als Seed-Promoter, Ausverkauft-Fall, Doppelklick, Vorlage, Bild).

---

## 4. Vollständige Liste der DB-Erweiterungen (alle additiv)

| Migration | Inhalt | Berührt Reserve-Logik? |
|---|---|---|
| 0006 | `bookings` + Promoter-/Snapshot-Spalten, `amount_due_cents` generiert, Idempotenz-Index, Lese-Policies; ggf. `customer_email` nullable (F8) | nein |
| 0007 | `deposit_basis`, `pricing_rules.basis`, `effective_deposit()`, `group_rules.deposit_for_free_persons` (F11) | nein |
| 0008 | `quote_promoter_sale()`, `reserve_promoter_seats()` (UPDATE-Block wörtlich aus Handover) | **neue Funktion daneben; 0002 unverändert** |
| 0009 | `notifications` + Enums, `enqueue_booking_notifications()`, `create or replace reserve_promoter_seats` (nur Aufruf ergänzt) | UPDATE-Block erneut per Test verifiziert |
| 0010 | Bucket `event-images`, Storage-Policies, `tour_departures.image_path` | nein |
| 0011 | `event_templates`, `tour_departures.template_id` | nein |

Keine Änderung an 0001–0005. `seats_booked_total` bleibt für `authenticated` unschreibbar. Keine Trigger auf `tour_departures`. Jede Migration auf diesem Rechner weiterhin per `docker exec … psql` + Historie-Zeile (RISKS Nr. 24).

---

## 5. Neue offene Fragen (→ `docs/RISKS.md`, nicht raten)

| # | Frage | Blockiert | Vorschlag Claude (nur Vorschlag) |
|---|---|---|---|
| F8 (alt) | Kundendaten am Strand: Name Pflicht? Telefon Pflicht (für SMS/WhatsApp)? E-Mail optional (Spalte heute NOT NULL)? | E5.1 | Name + Telefon Pflicht, E-Mail optional |
| F11 (alt) | 10+1: Anzahlung für 10 oder 11 Personen — und ist die Gabo-Option `deposit_for_free_persons` so gemeint? Startwert? | E5.2 | Option als Daten, Startwert von Gabo |
| F12 (alt) | Option A oder **B** (D2) — Empfehlung jetzt B | E5.3 | B |
| F15 (alt) | Regulärer Ticketpreis-Betrag | erster Verkauf (nicht der Code) | Gabo trägt unter `/admin/regeln` ein |
| F16 | „Gesamtbetrag" = fester Anzahlungsbetrag **pro Buchung**, den Gabo am Event/Standard vorgibt — oder darf der Promoter am Strand einen beliebigen Betrag eintippen? Und: Anzahlung > Gesamtpreis kappen oder ablehnen? | E5.2 | Gabo-Vorgabe pro Event (keine freie Eingabe am Strand → weniger Abrechnungsfehler); kappen auf Gesamtpreis |
| F17 | Darf ein Event Anzahlung **verbieten** (nur Vollzahlung, z. B. interne Events)? | E5.2 | ja, als dritte Basis `full_only` |
| F18 | 10+1 bei 22 Personen: 2 gratis (pro vollem Block) oder weiterhin 1? | E5.3 | pro Block; ist in `quote` eine Zeile |
| F19 | Event-Bilder privat (signierte URLs) oder öffentlich lesbar (einfacher, per Link für jeden sichtbar)? | E5.7 | privat |
| F20 | Nachrichtendienste: E-Mail (z. B. Resend/Postmark), SMS (z. B. Twilio), WhatsApp Business (Meta über Twilio/360dialog, Vorlagen-Freigabe nötig) — welche Kanäle, welche Konten, wer trägt die Kosten? Kosten sind vor der Entscheidung beim Anbieter zu prüfen; hier bewusst keine Zahlen | Versand (nach E5.6) | erst E-Mail + WhatsApp, SMS als Fallback |
| F21 | Absender/Inhalt der Kundennachrichten: im Namen von MyMallorcaBoats oder des Promoter-Netzwerks? Sprache(n)? Einwilligungstext am Strand (RISKS Nr. 16)? | E5.6 (Payload-Text) | Platzhalter-Text, Sprache DE/EN/ES als Feld |
| F22 | Promoter-Buchung mit Bar-Anzahlung: Status sofort `confirmed` oder `pending` bis Gabo bestätigt? | E5.3 | `confirmed` (Geld ist kassiert) |
| F13 (alt) | Operator im Promoter-Bereich | E5.4 nicht, nur UX | offen lassen |

---

## 6. Risiken dieser Etappe (Kandidaten für RISKS.md, sobald bestätigt)

- **Quote-Drift**: Anzeige und Reservierung rechnen unterschiedlich → durch D1 ausgeschlossen (eine Funktion + Vergleich).
- **Sitze vs. bezahlte Plätze** (Nr. 22): `p_seats` = Personen ist im Funktionscode fest, Test „11 → 11 Sitze" sichert es.
- **Handy-Uploads**: 5 MiB reicht für Fotos aus Kamera-Apps oft nicht ohne Verkleinern → Fehlermeldung mit Hinweis; clientseitiges Verkleinern als Folgeschritt.
- **Nachrichten-PII**: `notifications` trägt Telefon/E-Mail — gleiche Löschbarkeit wie `bookings` (RISKS Nr. 13); `on delete cascade` auf `booking_id`.
- **Migrationen ohne CLI** (Nr. 24): sechs weitere Migrationen per `docker exec psql` + Historie-Zeile von Hand — fehleranfällig; die Smart-App-Control-Entscheidung wird dringender.
- **`storage.objects`-Policies in Migrationen**: lokal als `postgres` möglich; auf der Cloud-Instanz prüfen, dass die Migration dort dieselben Rechte hat (sonst Policies über das Dashboard und als Doku festhalten) — vor E8.
