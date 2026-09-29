/** Datenbank-/PostgREST-Fehler in eine Meldung für Gabo übersetzen. */
export function dbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23514" && /total_within_capacity/.test(error.message)) {
    return "Kontingent kann nicht unter die bereits gebuchten Plätze gesenkt werden.";
  }
  if (error.code === "23514") {
    return "Eingabe verletzt eine Regel der Datenbank (Prüfbedingung).";
  }
  if (error.code === "42501") {
    return "Keine Berechtigung für diese Änderung.";
  }
  return `Speichern fehlgeschlagen: ${error.message}`;
}
