/**
 * Fehler-Codes aus quote_promoter_sale(), reserve_promoter_seats() und
 * set_booking_payment_status() (Migration 0010) in Meldungen für den Promoter
 * übersetzen. Unbekanntes → allgemeine Meldung (Details stehen im Server-Log).
 */

const MESSAGES: [RegExp, string][] = [
  [/SOLD_OUT/, "Nicht mehr genug freie Plätze für dieses Event (oder es ist nicht mehr offen)."],
  [/QUOTE_CHANGED/, "Preise oder Regeln haben sich gerade geändert — bitte die Beträge neu prüfen."],
  [/NO_TICKET_PRICE/, "Für dieses Event ist noch kein Ticketpreis eingetragen — Verkauf nicht möglich. Bitte Gabo Bescheid geben."],
  [/NO_DEPOSIT_RULE/, "Für dieses Event ist keine Anzahlung pro Person eingetragen — bitte Vollzahler oder freien Betrag wählen."],
  [/NO_COMMISSION_RULE|NO_GROUP_RULE/, "Regeln für dieses Event fehlen — Verkauf nicht möglich. Bitte Gabo Bescheid geben."],
  [/DEPOSIT_NOT_BELOW_TOTAL/, "Die Anzahlung muss unter dem Gesamtpreis liegen. Wird alles bezahlt, bitte „Vollzahler“ wählen."],
  [/DEPOSIT_NOT_POSITIVE/, "Die Anzahlung muss größer als 0 € sein."],
  [/CUSTOM_DEPOSIT_REQUIRED/, "Bitte den Anzahlungsbetrag eingeben."],
  [/INVALID_SEATS/, "Bitte mindestens 1 Person angeben."],
  [/CUSTOMER_NAME_REQUIRED/, "Bitte den Namen des Kunden eingeben."],
  [/CUSTOMER_PHONE_REQUIRED/, "Bitte eine gültige Handynummer eingeben (mindestens 6 Ziffern)."],
  [/CUSTOMER_EMAIL_INVALID/, "Die E-Mail-Adresse ist ungültig — korrigieren oder leer lassen."],
  [/DEPARTURE_NOT_FOUND/, "Event nicht gefunden."],
  [/BOOKING_NOT_FOUND/, "Verkauf nicht gefunden."],
  [/BOOKING_CANCELLED/, "Dieser Verkauf ist storniert — der Zahlungsstatus kann nicht mehr geändert werden."],
  [/NOT_A_DEPOSIT_BOOKING/, "„Anzahlung erhalten“ gibt es nur bei Verkäufen mit Anzahlung."],
  [/IDEMPOTENCY_KEY_REUSED/, "Dieser Verkaufsvorgang gehört zu einem anderen Konto. Bitte neu beginnen."],
  [/NOT_ALLOWED/, "Keine Berechtigung."],
];

export function saleErrorMessage(error: { code?: string; message: string }): string {
  for (const [re, text] of MESSAGES) {
    if (re.test(error.message)) return text;
  }
  if (error.code === "42501") return "Keine Berechtigung.";
  return "Das hat nicht geklappt. Bitte noch einmal versuchen.";
}
