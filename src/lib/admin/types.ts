/** Zeilen-Typen für den Admin-Bereich (Spiegel der Migrationen 0001 + 0004). */

export const DEPARTURE_STATUSES = ["open", "closed", "cancelled"] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];

export const STATUS_LABELS: Record<DepartureStatus, string> = {
  open: "offen",
  closed: "geschlossen",
  cancelled: "abgesagt",
};

export type Departure = {
  id: string;
  title: string;
  starts_at: string;
  /** Kontingent (DECISIONS 16.09.2026) */
  capacity_total: number;
  /** Nur die Reserve-/Release-Funktion schreibt diesen Wert (Hard Rule 4). */
  seats_booked_total: number;
  status: DepartureStatus;
  is_internal: boolean;
  note: string | null;
  /** E5.2 (0007): Herkunft — aus welcher Vorlage angelegt (null = von Hand). Nur Information, Werte sind kopiert. */
  template_id: string | null;
  /** E5.3 (0008): Pfad des Event-Bilds im privaten Bucket event-images (null = kein Bild). Aus der Vorlage kopiert oder eigenes. */
  image_path: string | null;
  created_at: string;
};

/** Was Gabo an einem Termin pflegen darf — exakt die Spalten des Spalten-Grants. */
export type DepartureInput = Pick<
  Departure,
  "title" | "starts_at" | "capacity_total" | "status" | "is_internal" | "note"
>;

export type CommissionRule = {
  id: string;
  /** null = Standard für alle Termine */
  departure_id: string | null;
  /** null (nur bei Ausnahme) = ab hier wieder Standard */
  commission_cents: number | null;
  valid_from: string;
  created_at: string;
  created_by: string | null;
};

export type GroupRule = {
  id: string;
  threshold_persons: number;
  free_persons: number;
  valid_from: string;
  created_at: string;
  created_by: string | null;
};

/** Rückgabe der Server Actions für useActionState. */
export type FormState = { error: string | null; ok: string | null };

export const INITIAL_FORM_STATE: FormState = { error: null, ok: null };

/** Migration 0005: Ticketpreis und Anzahlung pro Person als Regeln (append-only). */
export const PRICING_KINDS = ["ticket_price", "deposit"] as const;
export type PricingKind = (typeof PRICING_KINDS)[number];

export const PRICING_KIND_LABELS: Record<PricingKind, string> = {
  ticket_price: "Ticketpreis pro Person",
  deposit: "Anzahlung pro Person",
};

export type PricingRule = {
  id: string;
  kind: PricingKind;
  /** null = Standard für alle Termine */
  departure_id: string | null;
  /** null (nur bei Ausnahme) = ab hier wieder Standard */
  amount_cents: number | null;
  valid_from: string;
  created_at: string;
  created_by: string | null;
};

/** Beide Beträge pro Person in Cent; null = keine gültige Regel. */
export type PricingAmounts = Record<PricingKind, number | null>;

/**
 * Migration 0007 (E5.2): Eventvorlage — Stammdaten, aus denen Gabo Termine anlegt
 * (nur Datum/Uhrzeit kommen dazu). Beträge null = beim Event gilt der Standard.
 */
export type EventTemplate = {
  id: string;
  /** Bezeichnung der Vorlage (für die Liste) */
  name: string;
  /** Titel, den das Event bekommt */
  title: string;
  capacity_total: number;
  is_internal: boolean;
  note: string | null;
  ticket_price_cents: number | null;
  deposit_cents: number | null;
  commission_cents: number | null;
  /** E5.3 (0008): Pfad des Vorlagen-Bilds im privaten Bucket event-images (null = kein Bild); wird beim Event-Anlegen übernommen. */
  image_path: string | null;
  /** false = deaktiviert (statt löschen) */
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Was Gabo an einer Vorlage pflegt — die Spalten des UPDATE-Grants ohne `active`. */
export type EventTemplateInput = Pick<
  EventTemplate,
  | "name"
  | "title"
  | "capacity_total"
  | "is_internal"
  | "note"
  | "ticket_price_cents"
  | "deposit_cents"
  | "commission_cents"
>;
