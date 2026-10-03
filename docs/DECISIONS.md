# DECISIONS.md — Entscheidungs-Log mmb-promoter

Format: Datum · Entscheidung · Begründung. **Neue Einträge oben anhängen**, alte nie löschen. Große Architektur-Entscheidungen bekommen zusätzlich einen ADR in `docs/decisions/` — hier steht dann nur der Kurz-Eintrag mit Verweis (Regel in `docs/decisions/README.md`).

---

**03.10.2026 — Teil 2: Guide als dritte Rolle, Konto-Verwaltung durch Gabo, neue Reihenfolge Teil 2–6 (Migrationen `0012_user_role_guide.sql`, `0013_guide_role_accounts.sql`)**

Entscheidung (Marco, 03.10.2026 — nach Bestätigung von Teil 1, verbindlich):

1. **Guide = dritte Rolle mit allen Promoter-Funktionen plus Extras.** Der Guide verkauft wie ein Promoter und hat ein eigenes Dashboard mit eigenen Zahlen. Die Extras (Tagesbestellungen, Abkassier-Übersicht, eigene Provision) kommen in Teil 4.
2. **Gabo legt Promoter- und Guide-Profile an** und kann sie im Admin aktivieren, deaktivieren und ihr Passwort setzen. Promoter und Guides werden getrennt geführt.
3. **Status-Fluss neu wie besprochen** (bestätigt die Entscheidung „Nach der Diagnose“, Punkt 1): Bestellung → Mail → Gast bestätigt → kassiert → final. Ab „final“ kann der Promoter nichts mehr ändern.
4. **E-Mail nur als Logik** (bestätigt dort Punkt 3): Die Mail liegt als „ausstehend“ in der Queue. Der echte Versand kommt beim Live-Setup.
5. **Neue Reihenfolge, ersetzt „Teil 3–5 nach Bestätigung“:**
   - Teil 2 = Guide-Rolle (nur Rolle, Verkaufen, Anlegen)
   - Teil 3 = Gabos Auswertungs-Dashboard (= E5.5c, pro Promoter **und** pro Guide, „was Gabo an wen abgibt“)
   - Teil 4 = Guide-Extras
   - Teil 5 = Status-Fluss neu
   - Teil 6 = E-Mail-Logik
   - Ein Teil nach dem anderen, keine parallelen Subagenten, `git diff` vor jedem Commit, Stopp nach jedem Teil.

Ausgestaltung Teil 2 (Claude):

a. **Zwei Migrationen wie 0009/0010:** 0012 enthält nur `alter type user_role add value 'guide'`. Der neue Wert ist erst nach dem COMMIT benutzbar, deshalb steht alles, was ihn benutzt, in 0013.
b. **Verkaufen:**
   - Neuer Helfer `is_selling_profile()` (aktiver Promoter oder Guide, Rolle aus `profiles`).
   - `reserve_promoter_seats()` wird per `create or replace` mit **gleicher Signatur** ersetzt. Geändert sind nur die Rollenprüfung (promoter|guide) und `actor_role` der Audit-Zeile (die echte Rolle).
   - Das atomare UPDATE bleibt **wörtlich** (Hard Rule 4). Identitätstest und 8-parallel-Test sind grün.
   - Die Lese-Policies aus 0006/0011 passen unverändert (`promoter_id = auth.uid()`). Ein Guide sieht deshalb genau seine eigenen Verkäufe, auch in den Summen der Sichten.
c. **Lücke geschlossen in `set_booking_payment_status()`:** 0010 hat „fremde Buchung“ nur für `role = 'promoter'` geprüft. Ein Guide wäre dort wie Gabo behandelt worden. Jetzt gilt eine Positivliste: Nur `network_operator` darf fremde Buchungen ändern, jede andere Rolle nur eigene. Eine fremde Buchung liefert `BOOKING_NOT_FOUND`, verrät also nicht, dass es sie gibt.
d. **Bereichszugang über eine Positivliste** (`AREAS` in `src/lib/auth/access.ts`): `/admin` nur für `network_operator`, `/promoter` für `promoter` und `guide`. Jede künftige Rolle kommt nirgends hinein, bis sie ausdrücklich eingetragen ist (Test „unbekannte Rolle“). Gabo bleibt außerhalb von `/promoter` (F13 unverändert offen).
e. **Konto-Verwaltung `/admin/konten`:**
   - Promoter und Guides in getrennten Abschnitten, je „Neuen Promoter/Guide anlegen“.
   - Detailseite mit Status (aktivieren/deaktivieren), Name und Passwort setzen. Das eigene Operator-Konto ist dort nicht erreichbar (404).
   - Passwort 12–72 Byte (Mindestlänge wie `config.toml`, Obergrenze von bcrypt).
f. **`service_role` nur für die GoTrue-Admin-API** (`createAuthAdminClient()` gibt nur `auth.admin` heraus): Konto anlegen, Passwort setzen und Rollback. Es ist die einzige Stelle, an der die App den Schlüssel benutzt (Abweichung von DECISIONS 29.09. E3, Punkt 8, nur für Auth-Konten).
   - Jede Action prüft vorher `requireArea("admin")`.
   - Beim Passwortsetzen prüft die Action das Zielkonto zuerst über Gabos RLS-Client (nur promoter/guide).
   - Das **Profil** schreibt Gabo über seinen RLS-Client und die neuen Policies.
   - Scheitert das Profil, wird das gerade angelegte Auth-Konto wieder gelöscht.
g. **`profiles`-Rechte (0013):**
   - INSERT nur für `network_operator` und nur mit Rolle promoter|guide. Über die App entsteht also kein zweiter Operator.
   - UPDATE nur auf `active` und `display_name`, nur bei Zeilen mit Rolle promoter|guide. Gabos eigenes Profil ist nicht änderbar.
   - **Die Rolle ist unveränderlich**, auch für Gabo (kein Spalten-Grant). Ob ein Konto zugleich Promoter und Guide sein kann, ist offen (F29).
   - **Kein DELETE**, stattdessen deaktivieren.
   - `updated_at` per Trigger.
h. **Test-Guide im Seed:** `guide@mmb-promoter.test` / `guide-test-2026`, feste UUID `44444444-…`, nur lokal (`supabase/seed.sql`).
i. **Nicht in Teil 2 (bewusst):** Guide-Extras und Guide-Rechte pro Event (Teil 4, F29/F30/F31), Guide-Provision anders als beim Promoter (F31; heute gilt derselbe Snapshot), Status-Fluss (Teil 5).
j. **Tests robuster statt Daten löschen:** `bookings-rls` und `profiles-rls` grenzen ihre Erwartungen auf die eigenen Test- bzw. Seed-Zeilen ein. Marcos Browser-Verkauf in der lokalen DB bleibt stehen.

Begründung: Marcos Auftrag 03.10.2026 („Rolle "guide" einführen … RLS deny-by-default, Rollenprüfung serverseitig … Gabo kann im Admin Promoter- UND Guide-Profile anlegen/aktivieren/deaktivieren/Passwort setzen (getrennt) … Guide NICHT in /admin … jede Rolle nur Eigenes … Nur die Rolle + Verkaufen + Anlegen“). Hard Rules 1, 3, 4, 5, 8, 9.

---

**03.10.2026 — Nach der Diagnose E5.5 (Marco): neuer Status-Fluss ersetzt den alten, Guide als dritte Rolle, E-Mail nur als Queue-Logik; fünf Teile nacheinander, Teil 1 = Dashboard erreichbar**

Entscheidung (Marco, 03.10.2026 — nach Lesen von `docs/DIAGNOSE_E5-5_ROLLEN.md`, verbindlich):

1. **Status-Fluss NEU, ersetzt den alten.** Ein Verkauf startet **nicht mehr** sofort mit „Anzahlung erhalten“. Neuer Ablauf:
   Bestellung angelegt → Ticket-Mail an den Gast (Logik) → Gast hat den Erhalt bestätigt → kassiert → final.
   **Ab „final/kassiert“ kann der Promoter nichts mehr ändern** — nur noch Guide oder Gabo.
   Damit überholt: der Startstatus aus DECISIONS 02.10. (F22/F23, Punkt 2: „startet direkt mit Anzahlung erhalten“) und DECISIONS 03.10. E5.4 Punkt 1 (F24: Vollzahlung startet `fully_paid`, Anzahlung `deposit_received`). Diese Einträge bleiben als Historie stehen; umgesetzt ist bis zum Umbau weiter der alte Fluss (Migration 0010).
2. **Guide ist eine dritte Rolle.** Er kann alles, was ein Promoter kann (Tickets verkaufen), **plus** Guide-Extras (aus der Diagnose: alle Tagesbestellungen sehen, Abkassier-Übersicht, eigene Provision). **Gabo legt Promoter- und Guide-Profile an** und **stellt pro Event ein, was der Guide darf**.
3. **E-Mail jetzt nur als Logik:** Die Ticket-Mail wird als „ausstehend“ (`notifications.status = 'pending'`) in die Queue gelegt. **Echter Versand und DSGVO kommen beim Live-Setup** (F7, F20, F21, RISKS Nr. 16).
4. **Vorgehen:** fünf Teile, einer nach dem anderen, keine parallelen Subagenten, `git diff` vor jedem Commit, Stopp nach jedem Teil. **Teil 1 = Dashboard-Link**, **Teil 2 = Guide-Rolle**. Teil 3–5 hat Marco in diesem Auftrag nicht einzeln benannt — vermutlich Status-Fluss, E-Mail-Queue, Profil-/Guide-Verwaltung; die Reihenfolge wird vor Teil 3 bestätigt, nicht geraten.

Ausgestaltung Teil 1 (Claude):

a. **Die Dashboard-Seite existierte noch nicht.** E5.5a hatte nur die Sichten gebaut (Diagnose Abschnitt 1). Teil 1 baut deshalb die Seite E5.5b in schlichter Form und verlinkt sie: neue Route `/promoter/dashboard` („Mein Dashboard“), im Promoter-Kopf eine Navigation „Events“ (`/promoter`) · „Mein Dashboard“. `/promoter` bleibt die Startseite nach dem Login (Verkaufen zuerst).
b. **Echte Zahlen, keine Konstanten:** Kennzahlen kommen aus `sales_by_promoter`, das Diagramm aus `sales_by_day`, die Liste aus `bookings` — alles DB-Sichten aus 0011 über den RLS-Client. Die App summiert keine Beträge (DECISIONS 03.10. E5.5, Punkt 2).
c. **Schon jetzt ausdrücklich „nur eigene“ (Diagnose R2):** Kennzahlen und Verkaufsliste filtern zusätzlich auf `promoter_id = <eigene ID>`, nicht nur über RLS. So bleiben „meine Provision“ und „mein Umsatz“ richtig, wenn ein Guide später fremde Tagesbestellungen sehen darf. `sales_by_day` hat keine Promoter-Spalte; für die heutige Promoter-Rolle ist es durch RLS exakt. Bekommt der Guide eine breitere Lese-Policy, braucht das Diagramm eine Tages-Sicht pro Promoter — Aufgabe von Teil 2, dort mit Test.
d. **Diagramm:** serverseitiges SVG ohne Bibliothek, die letzten 14 Verkaufstage (Ortszeit Mallorca), Tage ohne Verkauf als 0 (der Kommentar der Sicht sagt, die App füllt sie auf). Balken = Abschlüsse, darunter der Umsatz je Tag als Text.

Begründung: Marcos Auftrag 03.10.2026 („Status-Fluss NEU ersetzt den alten … Guide ist dritte Rolle … E-Mail: jetzt nur Logik … Starte mit TEIL 1 (Dashboard-Link) … Prüfen dass die echten Zahlen (keine Hardcodes) angezeigt werden“). Hard Rules 1, 3, 5, 8. Offene Detailfragen zu Status-Fluss und Guide → RISKS F26–F33.

---

**03.10.2026 — E5.5 Dashboards: Zerlegung in E5.5a–d, eine Rechenstelle in der DB (Migration `0011_sales_reporting_views.sql`), Begriffs-Definitionen (Vorschlag Claude — von Marco zu bestätigen)**

Auftrag (Marco, 03.10.2026): volles Promoter-Dashboard und Admin-Dashboard für Gabo. Provision immer aus dem Snapshot, Summen gegen Einzelverkäufe getestet, Promoter sieht nur eigene Daten. Design bleibt schlicht, die Optik-Runde kommt nach E5.5. Zerlegen, Stopp zwischen den Teilschritten.

Ausgestaltung (Claude):

1. **Teilschritte:**
   - E5.5a: Auswertungs-Sichten in der DB + Summen-Tests, keine UI
   - E5.5b: Promoter-Dashboard `/promoter` (Kennzahlen, leichtes SVG-Diagramm ohne Bibliothek, alle eigenen Verkäufe, Weg zum Verkaufen)
   - E5.5c: Admin-Auswertung für Gabo (gesamt, pro Promoter, pro Event, offene Restbeträge, Diagramm + Tabelle)
   - E5.5d: Doku-Abschluss
2. **Eine Rechenstelle:** Beide Dashboards lesen dieselben vier Sichten (`sales_totals`, `sales_by_day`, `sales_by_promoter`, `sales_by_departure`). Die App summiert keine Beträge — wie beim Verkauf (DECISIONS 03.10. E5.4, Punkt c).
3. **`security_invoker = true`:** Die Sichten laufen mit den RLS-Policies des Aufrufers. Ein Promoter bekommt dieselbe Sicht wie Gabo, aber nur über seine eigenen Buchungen. Keine zweite Rechte-Logik.
4. **Begriffe (zur Bestätigung):**
   - **Umsatz** = Gesamtpreis der nicht stornierten Verkäufe (`total_amount_cents`, zum Verkaufszeitpunkt festgeschrieben). Daneben immer **kassiert** (vom Promoter eingenommen) und **offen** (Rest im Bus).
   - **Provision** = Summe der Provisions-Snapshots (`commission_total_cents`), nie neu gerechnet.
   - **Abschlüsse** = Anzahl Verkäufe; **Tickets** = Personen (inkl. Gratisplätze, bezahlt/gratis getrennt ausweisbar).
   - **Heute / Verkaufstag** = Kalendertag in Ortszeit Mallorca nach `sold_at`.
   - **Storno** (`cancelled`/`refunded`) zählt nicht in Umsatz, Tickets und Provision. Es wird separat mit Anzahl und Provisions-Snapshot ausgewiesen („Provision ungeklärt“, F10).
   - **Gabos Sicht** zeigt zusätzlich „Umsatz abzüglich Provision“ — eine reine Differenz, keine Abrechnungsregel (siehe F25).

Begründung: Marcos Auftrag 03.10.2026 („Zahlen müssen stimmen (Geld!)“, „NUR seine eigenen Daten“, „Provisionsbeträge immer aus dem gespeicherten Snapshot“). Hard Rules 5, 7, 8.

---

**03.10.2026 — E5.4 Nachbesserung: Live-Übersicht der Beträge rechnet die DB (Server Action), Name + Handynummer bei jedem Verkauf Pflicht**

Entscheidung (Marco, 03.10.2026): Das Verkaufsformular zeigt die Beträge sofort und aktualisiert sie bei jeder Änderung. Angezeigt werden:
- Gesamtpreis (Gratisplätze nach Gruppenregel abgezogen)
- Anzahlung jetzt
- Restbetrag im Bus
- bei Vollzahler: Anzahlung = Gesamt, Rest 0

Name + Handynummer sind **immer** Pflicht, egal ob Anzahlung oder Vollzahler; E-Mail optional (bestätigt F8).

Ausgestaltung (Claude):

1. **Weiterhin eine Rechenstelle:** Die Live-Übersicht ruft über die Server Action `previewSaleAction()` dieselbe DB-Funktion `quote_promoter_sale()` auf wie Bestätigungsschritt und Buchung (DECISIONS 03.10. E5.4, Punkt c). Der Browser rechnet keine Beträge — kein zweiter Rechenweg, der von der DB abweichen könnte.
2. **Die Vorschau bekommt keine Kundendaten** (nur Event, Personen, Zahlart, Anzahlungsart, freier Betrag) und schreibt nichts. Aufruf 250 ms nach der letzten Änderung; veraltete Antworten werden verworfen.
3. **Ohne JavaScript bleibt der bisherige Weg:** Die Übersicht bleibt leer, die Beträge erscheinen im Bestätigungsschritt. Der Button heißt deshalb „Weiter zur Bestätigung“.
4. **Freier Anzahlungsbetrag noch leer oder ≥ Gesamt:** Gesamtpreis und Gratisplätze werden trotzdem gezeigt, die Anzahlung bleibt offen („—“) mit Hinweis — gebucht werden kann so nicht (F16 unverändert).
5. **Test-Preise 74,90 € / 30 € stehen nur in der lokalen DB** (Termin-Ausnahmen), nicht in einer Migration — F15 (echter Standard-Ticketpreis) bleibt offen.

Begründung: Marcos Auftrag 03.10.2026 („BETRÄGE VORRECHNEN + ÜBERSICHTLICH … VOLLZAHLER BRAUCHT AUCH KONTAKTDATEN“). Hard Rules 5, 7, 8, 9.

---

**03.10.2026 — E5.4 Promoter-Verkauf: Antworten F8/F16/F18/F22/F24 (Marco) + Ausgestaltung (Migrationen `0009_payment_status_not_collected.sql`, `0010_promoter_sale_functions.sql`)**

Entscheidung (Marco, 03.10.2026 — Antworten auf die vor E5.4 gestellten Fragen, verbindlich):

1. **F24 — Vollzahlung startet als „voll bezahlt“, Anzahlung als „Anzahlung erhalten“.** „Noch nichts kassiert“ entsteht nur durch eine spätere Statusänderung.
2. **F18 — 10+1 pro vollem Block:** Gratisplätze = ⌊Personen / Schwelle⌋ × Gratisplätze der Regel (bei 11/1: 11 → 1, 21 → 1, 22 → 2).
3. **F16 — Freier Anzahlungsbetrag ≥ Gesamtpreis wird mit Meldung abgelehnt**, nicht gekappt (dann ist es eine Vollzahlung).
4. **F22 — Ein Promoter-Verkauf ist sofort `bookings.status = 'confirmed'`.**
5. **F8 — Kundendaten minimal: Name + Handynummer Pflicht, E-Mail optional.**
6. Auftrag: **nur der Verkaufs-Kern** — kein volles Dashboard (E5.5), keine Nachrichten (E5.6).

Ausgestaltung (Claude):

a. **Zwei Migrationen:** 0009 enthält nur `alter type payment_status add value 'not_collected'` — Postgres erlaubt einen neuen Enum-Wert erst nach dem COMMIT; Check und Funktionen, die ihn benutzen, stehen in 0010. Der Check `payment_status_matches_amounts` aus 0006 wird in 0010 unter gleichem Namen durch die Drei-Stufen-Fassung ersetzt (Korrektur = neue Migration, 0006 unverändert).
b. **Option B (F12):** `reserve_promoter_seats()` steht neben der Handover-Funktion; 0002 bleibt byteidentisch. Das atomare UPDATE ist **wörtlich** übernommen (eigener Identitätstest + eigener 8-parallel-Test, Hard Rule 4). Sitze = alle Personen; Preis/Provision = bezahlte Plätze (RISKS Nr. 22).
c. **Eine Rechenstelle:** `promoter_sale_amounts()` (nur intern ausführbar) rechnet Gratisplätze, Gesamt, Anzahlung, Provision, Startstatus; `quote_promoter_sale()` (Angebot, schreibt nichts) und `reserve_promoter_seats()` rufen beide sie auf. Die App rechnet keine Beträge.
d. **Anzahlung pro Buchung:** `deposit_basis` (`paying_persons` Standard / `all_persons` / `custom_total`) + `deposit_total_cents` = vereinbarte Anzahlung. Sie bleibt stehen, wenn der Status wechselt, damit „Anzahlung erhalten“ wieder genau diesen Betrag setzt. Checks: Anzahlung ⇒ Basis + 0 < Betrag < Gesamt; Vollzahlung ⇒ keine Anzahlungsangaben; `deposit_received` ⇒ kassiert = vereinbarte Anzahlung.
e. **Angebot → Bestätigung mit Schutz gegen Doppelklick und Regeländerung:** Beim Angebot erzeugt der Server einen Idempotenz-Schlüssel und gibt die angezeigten Beträge als versteckte Felder mit. `reserve_promoter_seats()` liefert bei gleichem Schlüssel die bestehende Buchung (auch 8× parallel) und bricht mit `QUOTE_CHANGED` ab, wenn Gesamt oder kassierter Betrag nicht mehr der Anzeige entsprechen — die App zeigt dann das neue Angebot, gebucht wird nichts.
f. **Zahlungsstatus ändern:** `set_booking_payment_status()` — Promoter nur eigene, `network_operator` alle Promoter-Buchungen; nicht bei Storno oder Online-Buchungen; „Anzahlung erhalten“ nur bei Zahlart Anzahlung; jede Änderung eine Audit-Zeile `payment_status_set` mit Vorher/Nachher und Rolle; gleicher Status = keine Zeile.
g. **Routen:** `/promoter` (Events inkl. interner mit frei/Kontingent, eigene Verkäufe), `/promoter/verkaufen/[id]` (Eingabe → Bestätigungsschritt), `/promoter/verkaeufe/[id]` (Beträge, Status, Verlauf). Handy zuerst (volle Breite, große Tipp-Flächen, Layout-Rand `px-4` statt `px-6` auf schmalen Bildschirmen). Formulare funktionieren auch ohne JavaScript — deshalb überträgt das Status-Formular die Buchungs-ID als verstecktes Feld statt über `action.bind()` (gebundene Action hing beim POST ohne JS).
h. **Nicht in E5.4:** Storno-Funktion und `enqueue_booking_notifications()` (eigener TASKS-Schritt), Provision beim Storno (F10), Standard-Ticketpreis (F15).

Begründung: Marcos Nachricht 03.10.2026 („Dann E5.4 — das Herzstück: der Promoter-Verkauf … Baue NUR den Verkaufs-Kern (E5.4) … Committe erst nach meiner Bestätigung. Danach Stopp.“) und seine Antworten auf F8/F16/F18/F22/F24. Hard Rules 1, 4, 5, 7, 8.

---

**02.10.2026 — F22/F23: Zahlungsstatus in drei Stufen, neuer Promoter-Verkauf startet mit „Anzahlung erhalten"; F11/F18: Anzahlungsbasis bei 10+1 = Standard „nur zahlende Köpfe", pro Verkauf umstellbar; E5.3 = Event-Bilder (Migration `0008_event_images.sql`), Funktionen → E5.4 / 0009**

Entscheidung (Marco, 02.10.2026 — Antworten auf die vor E5.3 gestellten Fragen, verbindlich):

1. **F22/F23 — Der Zahlungsstatus einer Buchung hat drei Stufen:** „noch nichts kassiert" → „Anzahlung erhalten" → „voll bezahlt". **Storno ist ein separater Status/Flag, nicht Teil dieser Kette.**
2. **F23 — Ein neuer Promoter-Verkauf startet direkt mit Status „Anzahlung erhalten"** (der Promoter kassiert am Strand). Promoter und Gabo können ihn danach ändern. **Jede Änderung ins Audit-Log.**
3. **F11/F18 — Anzahlungsbasis bei 10+1: alle drei Varianten sind immer möglich. STANDARD = Anzahlung nur für die zahlenden Köpfe (ohne Gratisplätze)**, umstellbar pro Verkauf; die anderen Varianten: alle Köpfe inkl. gratis / freier Gesamtbetrag. Als wählbare Option beim Verkauf.
4. **Reihenfolge: E5.3 = Bild-Upload für Events/Vorlagen (Migration 0008).** Bild pro Event + pro Vorlage (Supabase Storage, lokal), Anzeige im Admin + später im Promoter-Dashboard; nur `network_operator` lädt hoch, Größenlimit ~5 MB, Formate jpg/png/webp, web-optimiert, Vorlagen-Bild wird beim Event-Anlegen übernommen; additiv, Storage-Policies deny-by-default. Die Funktionen (`quote_promoter_sale()`, `reserve_promoter_seats()`, Zahlungsstatus, Storno, Nachrichten — bisher „E5.3 / 0008") rücken auf **E5.4 / Migration 0009**.

Konsequenzen für Schema und Code (Ausgestaltung Claude — Punkte a–d werden erst in E5.4/E5.5 gebaut):

a. **Enum `payment_status` bekommt additiv einen dritten Wert** für „noch nichts kassiert" (`alter type … add value`, E5.4); der Check aus 0006 wird um diese Stufe ergänzt (kassiert = 0). Das ersetzt die Zwei-Werte-Annahme aus E5.1 (Punkt d dort). `cancelled`/`refunded` bleiben Werte von `bookings.status` — Storno ist nicht Teil der Zahlungs-Kette (Punkt 1).
b. **`reserve_promoter_seats()` setzt beim Anlegen `deposit_received`** (Punkt 2). Ob ein Verkauf mit Zahlart **Vollzahlung** direkt als „voll bezahlt" startet, hat Marco nicht gesagt — der Check `fully_paid ⇔ kassiert = Gesamt` aus 0006 verlangt es → **F24** in RISKS, nicht geraten. Statusänderung = eigene SECURITY-DEFINER-Funktion für Promoter (nur eigene Buchung) und Gabo (alle), jede mit `booking_audit_log`-Zeile `payment_status_set` (Vorher/Nachher).
c. **Anzahlungsbasis wird ein Feld pro Buchung** (drei Werte: zahlende Köpfe / alle Köpfe inkl. gratis / freier Gesamtbetrag; Default „zahlende Köpfe" im Verkaufs-Flow; bei „freier Gesamtbetrag" tippt der Promoter den Betrag). Damit ist die frühere Idee „Gabo gibt die Basis am Event vor" (Plan E5.2 alt, F16) überholt: die Wahl liegt beim Verkauf. Offen bleiben F16-Rest (freier Betrag über dem Gesamtpreis: kappen oder ablehnen?) und **F18** (Mehrfach-Block 22 Personen → 2 gratis?) — Marcos Antwort betrifft die Basis, nicht die Blockzahl.
d. **Buchungsstatus (`bookings.status`) bei Bar-Anzahlung (F22):** Marco hat die Zahlungsstufen genannt, nicht den Buchungsstatus. Interpretation Claude: Verkauf mit kassiertem Geld = `confirmed`, nicht `pending` — in RISKS F22 so protokolliert, leicht änderbar, bevor E5.4 baut.

Ausgestaltung E5.3 — Event-Bilder (Claude, Migration `0008_event_images.sql`, Storage-Bucket `event-images`):

e. **Bucket privat (F19 → privat):** „deny-by-default" schließt einen öffentlichen Bucket aus. Lesen nur für aktive Profile (`is_active_profile()`) über **signierte URLs (1 h)**, die der Server mit dem RLS-Client des Nutzers erzeugt; Hochladen/Ändern/Löschen nur `is_network_operator()` — alles als Policies auf `storage.objects`, jeweils auf `bucket_id = 'event-images'` begrenzt. Zusätzlich Bucket-Limit 5 MiB und MIME-Liste `image/jpeg`, `image/png`, `image/webp` in `storage.buckets` (zweite Schranke neben der App-Prüfung).
f. **Pfad statt URL in der DB:** `image_path text` (nullable, max. 500 Zeichen, kein `..`) auf `event_templates` **und** `tour_departures`; Objektpfade `templates/<vorlagen-id>/<uuid>.webp` bzw. `departures/<termin-id>/<uuid>.webp`. **Jeder Upload ist ein neues Objekt** (nie überschreiben — kein veralteter Browser-Cache, kein Wettlauf); das vorherige Objekt wird nur gelöscht, wenn keine Vorlage und kein Termin es mehr referenziert.
g. **„Vorlagen-Bild wird beim Event-Anlegen übernommen" = Pfad kopieren**, kein zweites Objekt: `create_departure_from_template()` (gleiche Signatur, `create or replace` in 0008) kopiert `image_path` wie Titel/Kontingent/Beträge. Kein Live-Bezug (wie Punkt 4 der E5.2-Entscheidung): bekommt die Vorlage später ein anderes Bild, behält das Event seins — deshalb Regel f (altes Objekt nur löschen, wenn unreferenziert). Das Event-Bild lässt sich am Termin einzeln ersetzen oder entfernen.
h. **Web-optimiert serverseitig, immer WebP:** die Server Action prüft Größe (≤ 5 MB) und MIME (jpg/png/webp), dann wandelt `sharp` das Bild um — EXIF-Ausrichtung angewendet, längste Kante max. 1600 px (nie vergrößert), WebP Qualität 80, Metadaten entfernt. Gespeichert wird nur das Ergebnis; das Original verlässt den Request nicht. `experimental.serverActions.bodySizeLimit` auf 6 MB (Multipart-Overhead über dem 5-MB-Limit).
i. **Grants minimal:** `authenticated` darf `image_path` auf `tour_departures` INSERT+UPDATE und auf `event_templates` UPDATE (Spalten-Grants wie 0004/0007); Policies unverändert (`is_network_operator()`). Promoter lesen das Bild über die bestehenden SELECT-Policies (Termin) + Storage-SELECT-Policy; Vorlagen bleiben für sie unsichtbar.

Begründung: Marcos Nachricht 02.10.2026 (Antworten F22/F23/F11/F18 wörtlich wie oben, E5.3-Auftrag „Bild-Upload für Events/Vorlagen … Additiv, Storage-Policies deny-by-default. git diff + Test, committe erst nach meiner Bestätigung. Danach Stopp vor E5.4."). Hard Rules 1 (0001–0007 unberührt, Funktion per `create or replace` additiv erweitert), 4 (Reserve-Funktion nicht angefasst), 5 (F16-Rest, F18, F24 offen), 7, 8.

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
