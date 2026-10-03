/**
 * Typen + Beschriftungen für den Promoter-Verkauf (E5.4, Migrationen 0009/0010).
 * Ohne Server-Abhängigkeiten — wird von Client-Formularen und Server Actions benutzt.
 */

export const PAYMENT_TYPES = ["deposit", "full"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  deposit: "Anzahlung",
  full: "Vollzahler",
};

export const DEPOSIT_BASES = ["paying_persons", "all_persons", "custom_total"] as const;
export type DepositBasis = (typeof DEPOSIT_BASES)[number];

export const DEPOSIT_BASIS_LABELS: Record<DepositBasis, string> = {
  paying_persons: "Pro zahlender Person (Standard)",
  all_persons: "Pro Person inkl. Gratisplätze",
  custom_total: "Freier Betrag",
};

/** Drei Stufen (Marco 02.10.2026, F22/F23); Storno ist bookings.status, nicht Teil davon. */
export const PAYMENT_STATUSES = ["not_collected", "deposit_received", "fully_paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_collected: "noch nichts kassiert",
  deposit_received: "Anzahlung erhalten",
  fully_paid: "voll bezahlt",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "offen",
  confirmed: "bestätigt",
  cancelled: "storniert",
  refunded: "erstattet",
};

/** Eingaben des Verkaufsformulars (bereits geprüft). */
export type SaleValues = {
  departure_id: string;
  seats: number;
  payment_type: PaymentType;
  deposit_basis: DepositBasis;
  /** nur bei deposit_basis = custom_total */
  custom_deposit_cents: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
};

/** Nur die betragsrelevanten Eingaben (Live-Übersicht, quote_promoter_sale()). */
export type SaleAmountValues = Omit<SaleValues, "customer_name" | "customer_phone" | "customer_email">;

/** Rückgabe von quote_promoter_sale() — was der Bestätigungsschritt zeigt. */
export type SaleQuote = {
  seats: number;
  paid_seats: number;
  free_persons: number;
  ticket_price_cents: number;
  deposit_per_person_cents: number | null;
  commission_per_ticket_cents: number;
  group_threshold: number;
  group_free: number;
  total_amount_cents: number;
  deposit_basis: DepositBasis | null;
  deposit_total_cents: number | null;
  amount_paid_cents: number;
  amount_due_cents: number;
  commission_total_cents: number;
  payment_status: PaymentStatus;
  seats_available: number;
};

/** Zustand des zweistufigen Verkaufsformulars (Eingabe → Bestätigung). */
export type SaleFormState = {
  step: "input" | "confirm";
  error: string | null;
  /** Rohwerte der Felder, damit nach Fehler/„Ändern" nichts verloren geht. */
  fields: Record<string, string>;
  quote: SaleQuote | null;
  /** Idempotenz-Schlüssel dieses Verkaufsvorgangs (RISKS Nr. 11). */
  key: string | null;
};

/**
 * Live-Übersicht im Eingabeschritt (previewSaleAction). Die Beträge kommen aus
 * quote_promoter_sale() — der Browser rechnet nichts (DECISIONS 03.10., Punkt c).
 */
export type SalePreview = {
  quote: SaleQuote | null;
  /**
   * Freier Anzahlungsbetrag fehlt oder passt nicht: quote ist dann als
   * Vollzahlung gerechnet (zeigt den Gesamtpreis), Anzahlung und Rest sind offen.
   */
  depositOpen: boolean;
  /** Hinweis/Fehler zur Eingabe; bei quote = null kann nichts gerechnet werden. */
  error: string | null;
};

export type StatusFormState = { error: string | null; ok: string | null };
