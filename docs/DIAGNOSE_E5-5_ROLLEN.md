# DIAGNOSE_E5-5_ROLLEN.md — Dashboard, Rollen, Status-Logik, Nachrichten

**Datum:** 03.10.2026 · **Agent:** Claude · **Auftrag (Marco):** „DIAGNOSE, was zu Dashboard + Rollen + Status + E-Mail schon existiert — nur lesen, nichts bauen."
**Quellen:** Repo-Stand `b184675` (= `origin/main`) plus der uncommittete E5.5a-Arbeitsbaum (Migration 0011, `tests/sales-reporting.test.ts`, Doku). Gelesen: `src/app/promoter/**`, `src/lib/auth/{access,dal}.ts`, `src/proxy.ts`, Migrationen 0003, 0006, 0010, 0011, `supabase/config.toml`, `supabase/seed.sql`.

Diese Datei ist eine **Momentaufnahme** (Referenz), keine Regel-Datei. Sie entscheidet nichts. Verbindlich bleiben `AGENTS.md`, `docs/DECISIONS.md`, `docs/RISKS.md` und `TASKS.md`. Neue offene Fragen stehen unten als **G1–G12** und müssen von Marco in RISKS übernommen oder beantwortet werden.

---

## 0. Ergebnis zuerst

| # | Frage | Kurzantwort |
|---|---|---|
| 1 | Promoter-Dashboard schon gebaut? | **Nein.** E5.5a hat nur die **Rechenstelle in der DB** gebaut (4 Sichten, Migration 0011, 11 Tests). Die Sichten sind **uncommittet**, und **keine Seite liest sie**. Die Dashboard-Seite selbst (E5.5b) ist noch nicht gebaut. Deshalb sieht Marco nur die Event-Liste und „Meine letzten Verkäufe". |
| 2 | Rollen + dritte Rolle „guide" | Es gibt genau zwei Rollen: `network_operator` und `promoter` (Enum `user_role`). Die Rolle kommt nur aus `profiles` und wird an drei Stellen geprüft: in RLS-Policies, in DB-Funktionen und im App-Guard. **„guide" ist machbar, mittlerer Aufwand.** Riskant sind zwei Punkte: (a) `reserve_promoter_seats()` muss angepasst werden (Hard Rule 4), (b) die Auswertungs-Sichten würden für den Guide falsche „eigene" Summen liefern, sobald er fremde Buchungen sehen darf. |
| 3 | Wer ändert den Zahlungsstatus? Finaler Zustand? | Der Promoter ändert seine eigenen Buchungen, Gabo alle — **jederzeit, in jede Richtung** (auch „voll bezahlt" → „noch nichts kassiert"). Jede Änderung landet im Audit-Log. **Einen finalen, gesperrten Zustand gibt es nicht.** Gesperrt ist nur eine stornierte Buchung. |
| 4 | Nachrichten-Queue für E-Mail an den Gast? | **Die Tabelle gibt es** (`notifications`, Migration 0006): Arten Bestätigung / Erinnerung 4 h / 1 h, Status `pending`, Kanal-Feld, Empfänger-Snapshot, Payload. **Sie ist leer:** Es gibt keinen Auslöser, der Zeilen anlegt, keinen Versand, keinen Anbieter und keinen Text. Ein E-Mail-Auslöser lässt sich sauber einhängen, **ohne die Reserve-Funktion anzufassen** (Trigger auf `bookings`). |

---

## 1. Promoter-Dashboard

### 1.1 Was existiert

| Baustein | Ort | Stand |
|---|---|---|
| Auswertungs-Sichten `sales_totals`, `sales_by_day`, `sales_by_promoter`, `sales_by_departure` | `supabase/migrations/0011_sales_reporting_views.sql` | gebaut, lokal eingespielt, 11 Tests grün (`tests/sales-reporting.test.ts`: Summen gegen Einzelverkäufe, Isolation, Snapshot, Storno, Verkaufstag Mallorca). **Nicht committet**, weil Marcos Bestätigung zu E5.5a aussteht (PROGRESS.md, Hard Rule 3). |
| Promoter-Startseite | `src/app/promoter/page.tsx` | E5.4-Stand (committet `60ca6ab`): „Events verkaufen" + „Meine letzten Verkäufe" (die letzten 10, ohne Summen). Der Code-Kommentar sagt wörtlich: „Das volle Dashboard (Statistik, Provisionssumme) folgt in E5.5." |
| Lesen der Sichten in der App | — | **existiert nicht.** `grep sales_` über `src/` findet nichts, weder im Promoter- noch im Admin-Bereich. |
| Navigation im Promoter-Portal | `src/app/promoter/layout.tsx` | nur „Promoter · Name" + „Abmelden". Keine Nav-Links. Eine Dashboard-Seite, die man verlinken könnte, gibt es noch nicht. |
| Admin-Auswertung (E5.5c) | — | existiert nicht. Der Admin-Bereich liest heute **keine einzige Buchung** (kein `bookings` in `src/app/admin`, `src/lib/admin`). |

### 1.2 Warum Marco nur die Event-Liste sieht

Auf Marcos Auftrag hin wurde E5.5 zerlegt (a: DB, b: Promoter-Seite, c: Admin, d: Doku), mit Stopp nach jedem Teilschritt. Gebaut ist nur **E5.5a**, also die Rechenstelle **ohne UI**. Die Seite `/promoter` ist unverändert der Verkaufs-Kern aus E5.4. Es fehlt also kein Link und nichts ist kaputt: **Die Dashboard-Seite (E5.5b) ist noch nicht gebaut.** Sie wartet darauf, dass Marco E5.5a bestätigt.

### 1.3 Was E5.5b noch braucht

- Kennzahlen heute/gesamt aus `sales_totals`, Diagramm aus `sales_by_day`, alle eigenen Verkäufe (Liste ohne Limit).
- Nichts in der DB. Die Sichten liefern für den Promoter schon jetzt nur seine eigenen Daten (`security_invoker` + Policy `bookings_select_own_promoter`).
- **Abhängigkeit zu Abschnitt 2:** Diese Isolation hält nur, solange die Rolle, die die Seite benutzt, auf `bookings` ausschließlich eigene Zeilen sieht. Mit einer Guide-Rolle, die mehr sieht, gilt das nicht mehr (siehe 2.4, Punkt R2).

---

## 2. Rollen

### 2.1 Ist-Stand des Rollensystems

**Datenmodell (Migration 0003):**
- Enum `user_role` = `network_operator` | `promoter`.
- `profiles` 1:1 zu `auth.users` mit `role`, `active` und `display_name`.
- Die Rolle kommt **nur aus der DB**, nie aus dem JWT (DECISIONS 29.09.). Getestet in `tests/profiles-rls.test.ts`: Ein gefälschter Claim bleibt wirkungslos.

**DB-Helfer (security definer):**
- `current_profile_role()` — Rolle, wenn das Profil aktiv ist, sonst NULL
- `is_active_profile()`
- `is_network_operator()`

**Drei Prüf-Schichten:**

| Schicht | Wo | Wie die Rolle geprüft wird |
|---|---|---|
| App-Guard | `src/lib/auth/access.ts` (`AREAS`, `decideAccess`, `landingPathFor`), `src/lib/auth/dal.ts` (`requireArea`) in jedem Layout und jeder Server Action | **genau eine Rolle pro Bereich**: `admin → network_operator`, `promoter → promoter`, Vergleich `profile.role !== AREAS[area].role`. Ziel nach dem Login: Operator → `/admin`, sonst `/promoter`. |
| Proxy | `src/proxy.ts` | prüft nur, ob eine Session besteht (optimistisch), keine Rolle |
| RLS-Policies | 0003–0011 | Lesen: meist `is_active_profile()` (Termine, Regeln, Bilder). Schreiben: `is_network_operator()`. Buchungen: `promoter_id = auth.uid()` (eigene) oder `is_network_operator()` (alle). **Keine Policy fragt `role = 'promoter'` ab** — „eigene Buchung" hängt allein an `promoter_id`. |
| DB-Funktionen | 0007, 0008, 0010 | `reserve_promoter_seats()`: `current_profile_role() is distinct from 'promoter'` → `NOT_ALLOWED` (**hart auf promoter**). `set_booking_payment_status()`: `v_role = 'promoter'` → nur eigene, jede andere aktive Rolle → **alle** Buchungen. `quote_promoter_sale()`: jedes aktive Profil. Vorlagen/Bilder: `is_network_operator()`. |

### 2.2 Was ein Guide technisch bräuchte

„Kann alles, was ein Promoter kann, **plus** alle Tagesbestellungen sehen, Abkassier-Übersicht, eigene Provision."

| Baustein | Änderung | Art |
|---|---|---|
| Enum | `alter type user_role add value 'guide'` | **eigene Migration** (wie 0009: ein neuer Enum-Wert ist erst nach dem COMMIT benutzbar) |
| Verkaufen | `reserve_promoter_seats()`: Rollen-Prüfung von `= 'promoter'` auf „promoter oder guide" erweitern | `create or replace` mit gleicher Signatur. **Berührt die Funktion, die den wörtlichen UPDATE-Block enthält → Hard Rule 4:** Identitätstest + 8-parallel-Test müssen vor dem Commit grün sein. Der UPDATE-Block selbst bleibt unverändert. |
| Zahlungsstatus | `set_booking_payment_status()`: Achtung, ein Guide fiele heute in den `else`-Zweig und dürfte damit **alle Buchungen** ändern, wie Gabo. Das ist jetzt kein Problem, weil es die Rolle noch nicht gibt, aber beim Einführen **muss die Funktion mitgeändert werden**. Sonst bekommt der Guide automatisch Operator-Rechte beim Status. | `create or replace` |
| Eigene Buchungen lesen | Policy `bookings_select_own_promoter` greift schon (`promoter_id = auth.uid()`, keine Rollenprüfung) | nichts |
| „Alle Tagesbestellungen" | **neue** SELECT-Policy auf `bookings` (und ggf. `booking_audit_log`) für den Guide, eingeschränkt auf den Tag (siehe G2/G3) | neue Policy + Helfer `is_guide()` |
| App-Guard | `AREAS` von „eine Rolle" auf „Liste erlaubter Rollen" umstellen (`promoter: ["promoter","guide"]`, neuer Bereich `guide` oder Unterseiten unter `/promoter`), `landingPathFor` erweitern, `UserRole`-Typ ergänzen | TypeScript + `tests/access-guard.test.ts` |
| Konten anlegen | E4 (Konto-Verwaltung) existiert noch nicht. Ein Guide entsteht heute nur per Seed/SQL. | E4 |
| Tests | `access-guard` (15 Rollen-Stellen), `profiles-rls` (16), `bookings-rls`, `promoter-sale`, `sales-reporting`, `app-access` + neue Guide-Tests | Tests |

### 2.3 Aufwand

**Mittel:** zwei Migrationen (Enum allein, dann Policies und Funktionen), ein Umbau des Guards von 1 Rolle auf n Rollen, eine Guide-Seite, etwa 20–30 neue Tests. Das ist etwa so groß wie E5.4 ohne den Verkaufs-Flow. Die Rollen-Grundlage passt: Die Rolle kommt aus der DB, RLS ist deny-by-default, und die Buchungs-Policies hängen an `promoter_id`, nicht am Rollennamen.

### 2.4 Risiken (wichtig)

- **R1 — Hard Rule 4:** Der Guide darf nur verkaufen, wenn `reserve_promoter_seats()` geändert wird. Die Änderung betrifft nur die Rollenzeile, ist also klein. Trotzdem gilt die volle Pflicht: Identitätstest + 8-parallel-Test grün vor dem Commit. Eine Alternative ohne Funktionsänderung gibt es nicht: Ein Wrapper liefe mit derselben `auth.uid()` und derselben Rolle und würde ebenfalls abgewiesen.
- **R2 — Die Auswertungs-Sichten rechnen „alles, was der Aufrufer sehen darf".** Weil sie `security_invoker` nutzen, gilt: Bekommt der Guide eine Policy auf die Tagesbestellungen aller Promoter, dann summiert `sales_totals` für ihn **fremde Verkäufe mit**. Seine „eigene Provision" und sein „eigener Umsatz" wären falsch, und das ist Geld. Gegenmaßnahme: Die Kennzahlen für „eigene Zahlen" filtern ausdrücklich auf `promoter_id = auth.uid()` (z. B. zusätzliche Sicht `my_sales_*` oder `where`-Filter in der Abfrage). Dazu ein Test „Guide sieht fremde Tagesbuchungen, aber seine Provision enthält nur eigene". **Das sollte schon beim Bau von E5.5b feststehen**, sonst muss das Promoter-Dashboard später umgebaut werden.
- **R3 — `set_booking_payment_status()` (2.2):** Die neue Rolle bekäme stillschweigend Operator-Rechte. Diese Lücke muss in derselben Migration geschlossen werden, die die Rolle einführt (Enum-Migration → sofort danach die Funktions-Migration, vor jeder Guide-Seite).
- **R4 — Datenschutz (RISKS Nr. 13/16):** „Alle Tagesbestellungen" heißt, der Guide sieht **Name und Handynummer fremder Kunden**. Ob er die Telefonnummer braucht (oder nur Name, Personenzahl, offenen Rest), muss Marco entscheiden (G4).
- **R5 — F13** (darf Gabo in den Promoter-Bereich?) hängt am selben Guard-Umbau. Am besten zusammen entscheiden.

---

## 3. Status-Logik

### 3.1 Ist-Stand

- **Zahlungsstatus** (`payment_status`, drei Stufen): `not_collected` (kassiert 0) → `deposit_received` (kassiert = vereinbarte Anzahlung) → `fully_paid` (kassiert = Gesamt). Der kassierte Betrag wird von der Funktion **gesetzt**, nicht eingetippt. Der DB-Check `payment_status_matches_amounts` erzwingt die Übereinstimmung.
- **Wer ändert:** nur über `set_booking_payment_status()` (Migration 0010).
  - Promoter: nur eigene Buchungen. Fremde → `BOOKING_NOT_FOUND`.
  - `network_operator`: alle Promoter-Buchungen.
  - deaktiviert/anon: `NOT_ALLOWED`.
  - Direktes UPDATE auf `bookings` ist für `authenticated` gesperrt (nur SELECT-Grant).
- **Einschränkungen heute:**
  - storniert → `BOOKING_CANCELLED`
  - „Anzahlung erhalten" nur bei Zahlart Anzahlung
  - gleicher Status → keine Änderung, keine Audit-Zeile
- **Keine Einschränkung nach Zeit oder Richtung.** Ein Promoter kann eine Woche nach dem Event „voll bezahlt" auf „noch nichts kassiert" zurücksetzen. Die UI (`status-form.tsx`) zeigt immer alle erlaubten Stufen als Knöpfe.
- **Nachvollziehbarkeit:** jede Änderung = `booking_audit_log`-Zeile `payment_status_set` mit Handelndem, Rolle, Vorher/Nachher (Betrag + Status). Das Log ist append-only.

### 3.2 Was fehlt

- **Kein finaler Zustand** („abgeschlossen", „abgerechnet", „gesperrt"), ab dem der Promoter nichts mehr ändern darf.
- **Keine Zuordnung, wer welchen Betrag kassiert hat.** `amount_paid_cents` ist eine einzige Zahl. Wenn der Promoter die Anzahlung und der Guide den Rest im Bus kassiert, steht das nur indirekt im Audit-Log (wer zuletzt auf `fully_paid` gesetzt hat), nicht als Betrag pro Person. Für die Abrechnung Promoter ↔ Gabo (F25) und Guide ↔ Gabo reicht das voraussichtlich **nicht**.

### 3.3 Einschätzung

„Voll bezahlt" (der Kunde hat alles gezahlt) und „abgerechnet" (das Geld ist bei Gabo) sind **zwei verschiedene Dinge**. Ein finaler Zustand gehört deshalb eher als **eigener Abschluss-Vermerk** neben den Zahlungsstatus (z. B. `settled_at`, `settled_by`, Audit-Aktion `settled`), nicht als vierte Zahlungsstufe. Ab dem Vermerk lehnt `set_booking_payment_status()` Promoter- und Guide-Änderungen ab; Gabo kann ihn mit Audit-Zeile zurücknehmen. **Das ist ein Vorschlag, keine Entscheidung** — Fragen G6–G9.

---

## 4. E-Mail / Nachrichten

### 4.1 Ist-Stand

| Baustein | Stand |
|---|---|
| Tabelle `notifications` (0006) | **existiert**. Felder: `kind` (`booking_confirmation`, `reminder_4h`, `reminder_1h`), `channel` (`email`/`sms`/`whatsapp`, NULL bis F20), Empfänger-Snapshot (Name, Telefon, E-Mail), `scheduled_for`, `status` (`pending`/`sent`/`failed`/`cancelled`/`skipped`), `payload` jsonb, `attempts`, `last_error`, `sent_at`, `provider_message_id`. Pro Buchung und Art genau eine Zeile (unique). Index `notifications_due_idx` auf fällige `pending`-Zeilen. |
| Rechte | Promoter liest Nachrichten zu eigenen Buchungen, Operator alle; `authenticated` schreibt nichts. `service_role` darf INSERT/UPDATE (für den späteren Versand). |
| Auslöser (`enqueue_booking_notifications()`) | **existiert nicht.** Wurde aus E5.4 ausgelagert (TASKS „Storno-Funktion + Nachrichten-Auslöser"). Die Tabelle ist leer. |
| Versand (Worker, Anbieter, Vorlage) | **existiert nicht.** F20 (Kanal/Anbieter/Kosten) und F21 (Absender, Sprache, Einwilligung) sind offen. |
| Lokale Test-Mail | **Mailpit ist schon da** (Supabase-Instanz: Web 45324, SMTP 45325). Ein Versand-Prozess ließe sich lokal komplett testen, ohne echten Anbieter. |
| „Tickets" für den Gast | Es gibt **keine Buchungsnummer, keinen Code und keinen QR** — nur die UUID der Buchung. Was der Gast als „Ticket" bekommt, ist nicht definiert (G10). |
| Gast-E-Mail | optional (F8). Bei Verkäufen ohne E-Mail kann keine E-Mail gehen (G11). |

### 4.2 Wie sich ein E-Mail-Auslöser sauber einhängen lässt

Zwei Möglichkeiten:

1. **In `reserve_promoter_seats()`** (wie ursprünglich geplant). Nachteil: berührt wieder die Funktion mit dem UPDATE-Block → Hard Rule 4.
2. **AFTER-INSERT-Trigger auf `bookings`** (`channel = 'promoter'`): legt in derselben Transaktion die `pending`-Zeile(n) an. **Empfohlen.** Die Reserve-Funktion bleibt unberührt. Scheitert der Verkauf, entsteht auch keine Nachricht (Rollback). Ein Storno setzt später `pending` → `cancelled`.

Danach, getrennt davon, der **Versand**: Ein Prozess holt fällige `pending`-Zeilen, rendert den Text, schickt sie über den Anbieter (lokal Mailpit) und setzt `sent`/`failed`. Ort offen: Next.js-Route + Cron, Supabase Edge Function oder `pg_cron`. Für den Live-Betrieb braucht es Domain + Absender-DNS (SPF/DKIM) — hängt an F7.

---

## 5. Empfohlene Reihenfolge und Abhängigkeiten

```
E5.5a commit (wartet auf Marco)
   │
   ├─► [Entscheidung G1–G4: Guide ja/nein, was genau sieht er]  ← bestimmt E5.5b mit (R2)
   │
   ├─► E5.5b Promoter-Dashboard  (Kennzahlen „eigene" ausdrücklich auf promoter_id = auth.uid())
   ├─► E5.5c Admin-Auswertung Gabo
   │
   ├─► Status-Abschluss (G6–G9)          ── unabhängig von der Guide-Rolle, aber vor dem Guide sinnvoll,
   │                                         weil der Guide genau hier kassiert
   │
   ├─► Guide-Rolle
   │     1. Migration: Enum-Wert 'guide' (allein)
   │     2. Migration: is_guide(), Policy Tagesbestellungen, reserve_promoter_seats() Rollenzeile
   │        (Hard Rule 4: Identitäts- + 8-parallel-Test), set_booking_payment_status() Guide-Regel
   │     3. Guard n Rollen + Guide-Seite (Tagesbestellungen, Abkassier-Übersicht, eigene Provision)
   │     4. Tests (Isolation, Provision nur eigene, Status-Rechte)
   │     (Konto anlegen bis E4: per Seed/SQL)
   │
   └─► Nachrichten
         1. Trigger → pending-Zeilen (ohne Versand, ohne Anbieter) — sofort baubar
         2. Buchungsnummer/„Ticket" (G10) + Text (F21)
         3. Versand lokal über Mailpit
         4. echter Anbieter + Domain (F20, F7) — vor dem Live-Gang
```

**Begründung der Reihenfolge:**
- **E5.5b zuerst**, weil fertig vorbereitet und von Marco erwartet. Vorher aber die Guide-Grundentscheidung (G1), damit die „eigenen" Zahlen gleich richtig gefiltert werden (R2).
- **Status-Abschluss vor dem Guide**, weil die Abkassier-Übersicht des Guides genau diesen Status schreibt.
- **Nachrichten-Trigger** ist unabhängig und risikoarm (kein Eingriff in die Reserve-Funktion), braucht aber für den echten Versand drei offene Fragen (F20, F21, G10).
- **Storno-Funktion + Admin-Storno-UI** (TASKS) bleiben ebenfalls offen. Der Trigger-Weg passt dazu: Storno setzt die Nachrichten auf `cancelled`.

---

## 6. Neue offene Fragen (nicht raten — Hard Rule 5)

| # | Frage | blockiert |
|---|---|---|
| G1 | **Guide = eigene Rolle** (eigene Startseite, eigene Rechte) — oder ein Promoter mit Zusatz-Flag? Darf ein Konto zwischen Promoter und Guide wechseln? | Guide-Migration, E5.5b-Filter (R2) |
| G2 | **„Alle Tagesbestellungen" = welche?** Buchungen für Events, die **heute stattfinden** (`starts_at` heute), oder Buchungen, die **heute verkauft** wurden? Alle Events des Tages oder nur das Event/der Bus, auf dem der Guide ist? | Policy des Guides |
| G3 | **Ist ein Guide einem Event zugeordnet** (Gabo teilt Guide ↔ Event zu)? Falls ja, braucht es eine Zuordnungstabelle; falls nein, sieht jeder Guide alle Tagesbuchungen. | Datenmodell, Policy |
| G4 | **Welche Kundendaten sieht der Guide** bei fremden Buchungen: Name + Personen + offener Rest, oder auch die Handynummer? (Datenschutz, RISKS Nr. 13/16) | Policy/Sicht für den Guide |
| G5 | **Provision des Guides:** nur für eigene Verkäufe (wie ein Promoter) — oder auch etwas fürs Abkassieren/Begleiten? Gleicher Satz wie Promoter? | eigene Provision, Snapshot-Logik |
| G6 | **Finaler Zustand:** Wann ist eine Buchung „abgeschlossen" — wenn der Kunde voll bezahlt hat, wenn das Event vorbei ist, oder wenn mit Gabo abgerechnet ist? Wer setzt ihn (Guide, Gabo, automatisch)? | Status-Abschluss |
| G7 | **Ab dem finalen Zustand:** Darf nur Gabo noch etwas ändern (mit Audit), oder niemand? | `set_booking_payment_status()` |
| G8 | **Darf der Guide den Zahlungsstatus fremder Buchungen ändern** (Rest im Bus kassiert → „voll bezahlt")? Nur Richtung „mehr kassiert" oder auch zurück? | Guide-Rechte |
| G9 | **Muss festgehalten werden, wer welchen Betrag kassiert hat** (Promoter: Anzahlung; Guide: Rest)? Dann reicht `amount_paid_cents` nicht, es braucht eine Zahlungs-Zeile pro Kassiervorgang. Hängt eng mit F25 zusammen. | Abrechnung, Abkassier-Übersicht |
| G10 | **Was ist das „Ticket" für den Gast?** Buchungsnummer im Text, QR-Code zum Abhaken im Bus, PDF? Muss der Guide Tickets im Bus prüfen/abhaken („eingecheckt")? | Nachrichten-Inhalt, ggf. Check-in-Funktion für den Guide |
| G11 | **Gast ohne E-Mail** (E-Mail optional, F8): keine Nachricht (`skipped`), oder dann SMS/WhatsApp (F20)? Soll E-Mail für die Bestätigung doch Pflicht werden? | Nachrichten-Trigger |
| G12 | **Welche „Infos" gehören in die Bestellbestätigung?** Event, Datum/Uhrzeit, Treffpunkt, Personen, gezahlt/offen, Kontakt? Treffpunkt gibt es im Datenmodell noch nicht. | Payload, ggf. neues Feld am Event |

Bereits bekannte, hierfür relevante Fragen: **F7** (Domain → Absender-Adresse), **F13** (Gabo im Promoter-Bereich, gleicher Guard-Umbau), **F20** (Kanal/Anbieter), **F21** (Absender/Sprache/Einwilligung), **F25** (Abrechnung Promoter ↔ Gabo, gilt analog für den Guide).
