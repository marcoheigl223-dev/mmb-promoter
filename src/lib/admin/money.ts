/**
 * Geld-Helfer: Beträge werden in der DB als ganze Cent gespeichert
 * (integer, nie float). Eingabe im Formular in Euro mit Komma oder Punkt.
 * Reine Funktionen ohne Server-Abhängigkeiten.
 */

/** "10", "10,5", "10.50", " 10,00 € " → Cent (1000 / 1050 / 1050 / 1000); null bei Unsinn. */
export function parseEuroToCents(input: string): number | null {
  const cleaned = input.replace(/\s|€/g, "").replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const euros = Number(m[1]);
  const cents = Number((m[2] ?? "").padEnd(2, "0"));
  const total = euros * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/** 1000 → "10,00 €" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** 1050 → "10.50" (Wert für <input type="number" step="0.01">) */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}
