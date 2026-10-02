/** Datenbank-/PostgREST-Fehler in eine Meldung für Gabo übersetzen. */
export function dbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23514" && /total_within_capacity/.test(error.message)) {
    return "Kontingent kann nicht unter die bereits gebuchten Plätze gesenkt werden.";
  }
  // E5.2 (0007): Vorlagen-Check, wenn Preis UND Anzahlung in der Vorlage stehen.
  if (error.code === "23514" && /template_deposit_within_price/.test(error.message)) {
    return "Die Anzahlung pro Person darf den Ticketpreis pro Person nicht übersteigen.";
  }
  if (error.code === "23514") {
    return "Eingabe verletzt eine Regel der Datenbank (Prüfbedingung).";
  }
  // E5.2 (0007): Meldungen aus create_departure_from_template().
  if (/TEMPLATE_INACTIVE/.test(error.message)) {
    return "Diese Vorlage ist deaktiviert — erst wieder aktivieren oder eine andere wählen.";
  }
  if (/TEMPLATE_NOT_FOUND/.test(error.message)) {
    return "Vorlage nicht gefunden.";
  }
  if (error.code === "42501") {
    return "Keine Berechtigung für diese Änderung.";
  }
  return `Speichern fehlgeschlagen: ${error.message}`;
}
