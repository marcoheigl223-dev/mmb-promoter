import { parseEuroToCents } from "./money";
import { PRICING_KINDS, type PricingAmounts, type PricingKind, type PricingRule } from "./types";

/**
 * Reine Logik für Preis/Anzahlung pro Termin (F14, Migration 0005) — ohne
 * Server-Abhängigkeiten, damit sie in Vitest läuft.
 *
 * Die Felder im Termin-Formular sind optional: leer = Standard gilt. Weil
 * pricing_rules append-only ist, wird beim Speichern nicht „der Wert gesetzt",
 * sondern nur dann eine NEUE Zeile geschrieben, wenn sich gegenüber der gerade
 * aktiven Ausnahme etwas ändert:
 *   * Feld gefüllt, aktive Ausnahme fehlt oder hat einen anderen Betrag → Zeile mit Betrag
 *   * Feld leer, aktive Ausnahme mit Betrag vorhanden → Zeile mit NULL („wieder Standard")
 *   * sonst nichts (kein Rauschen in der Historie)
 */

/** Formular-Eingabe eines optionalen Euro-Betrags: leer → null (= Standard). */
export function parseOptionalEuro(
  input: string,
): { cents: number | null } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { cents: null };
  const cents = parseEuroToCents(trimmed);
  if (cents === null) return { error: "Bitte einen Betrag in Euro eingeben (z. B. 45,00) oder das Feld leer lassen." };
  return { cents };
}

/**
 * Betrag der gerade aktiven Ausnahme-Zeile (jüngste mit valid_from <= now).
 * null = keine aktive Ausnahme ODER aktive Zeile sagt „wieder Standard".
 * `rules` sind die Ausnahmen EINES Termins und EINER Art, jüngste zuerst
 * (wie listPricingRules sie liefert).
 */
export function activeOverrideCents(rules: PricingRule[], now = Date.now()): number | null {
  const active = rules.find((r) => new Date(r.valid_from).getTime() <= now);
  return active?.amount_cents ?? null;
}

export type PricingWrite = { kind: PricingKind; amount_cents: number | null };

/** Welche Zeilen müssen geschrieben werden, damit die Eingabe gilt? (siehe Kopf) */
export function planPricingWrites(
  input: PricingAmounts,
  activeOverride: PricingAmounts,
): PricingWrite[] {
  const writes: PricingWrite[] = [];
  for (const kind of PRICING_KINDS) {
    const wanted = input[kind];
    const active = activeOverride[kind];
    if (wanted !== null && wanted !== active) writes.push({ kind, amount_cents: wanted });
    else if (wanted === null && active !== null) writes.push({ kind, amount_cents: null });
  }
  return writes;
}

/**
 * Plausibilität: Die Anzahlung darf den Ticketpreis nicht übersteigen, sonst
 * wäre der „Rest im Bus" negativ. Geprüft mit den Werten, die nach dem
 * Speichern gelten würden (Eingabe, sonst Standard). Fehlt ein Wert, wird
 * nicht geprüft (kein Ticketpreis-Standard → F15).
 */
export function depositAbovePriceError(
  input: PricingAmounts,
  standard: PricingAmounts,
): string | null {
  const price = input.ticket_price ?? standard.ticket_price;
  const deposit = input.deposit ?? standard.deposit;
  if (price === null || deposit === null) return null;
  if (deposit > price) {
    return "Die Anzahlung pro Person darf den Ticketpreis pro Person nicht übersteigen.";
  }
  return null;
}
