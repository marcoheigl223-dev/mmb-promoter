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
