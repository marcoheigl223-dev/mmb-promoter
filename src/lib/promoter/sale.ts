import { parseEuroToCents } from "../admin/money";
import {
  DEPOSIT_BASES,
  PAYMENT_TYPES,
  type DepositBasis,
  type PaymentType,
  type SaleAmountValues,
  type SaleValues,
} from "./types";

/**
 * Verkaufsformular (E5.4) lesen und vorprüfen — reine Funktionen, ohne
 * Server-Abhängigkeiten. Die verbindliche Prüfung (Beträge, Regeln, Kontingent,
 * Kundendaten) macht die DB in quote_promoter_sale()/reserve_promoter_seats();
 * hier wird nur abgefangen, was ohne Datenbank sicher falsch ist.
 */

/** Feldnamen, die zwischen Eingabe- und Bestätigungsschritt mitwandern. */
export const SALE_FIELDS = [
  "departure_id",
  "seats",
  "payment_type",
  "deposit_basis",
  "custom_deposit",
  "customer_name",
  "customer_phone",
  "customer_email",
] as const;

/** Felder, aus denen die DB die Beträge rechnet (Live-Übersicht, ohne Kundendaten). */
export const SALE_AMOUNT_FIELDS = [
  "departure_id",
  "seats",
  "payment_type",
  "deposit_basis",
  "custom_deposit",
] as const;

export const MAX_SEATS_PER_SALE = 200;

export function readSaleFields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of SALE_FIELDS) {
    const v = formData.get(name);
    out[name] = typeof v === "string" ? v : "";
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Nur die betragsrelevanten Felder prüfen — für die Live-Übersicht und als erster Teil von parseSaleFields(). */
export function parseSaleAmountFields(
  fields: Record<string, string>,
): { values: SaleAmountValues } | { error: string } {
  const seatsRaw = (fields.seats ?? "").trim();
  if (!/^\d+$/.test(seatsRaw)) return { error: "Bitte die Anzahl Personen als ganze Zahl angeben." };
  const seats = Number(seatsRaw);
  if (seats < 1) return { error: "Bitte mindestens 1 Person angeben." };
  if (seats > MAX_SEATS_PER_SALE) {
    return { error: `Höchstens ${MAX_SEATS_PER_SALE} Personen pro Verkauf.` };
  }

  const paymentType = fields.payment_type as PaymentType;
  if (!PAYMENT_TYPES.includes(paymentType)) {
    return { error: "Bitte Vollzahler oder Anzahlung wählen." };
  }

  // Bei Vollzahlung spielt die Basis keine Rolle; Standard bleibt „zahlende Köpfe".
  const basisRaw = (fields.deposit_basis ?? "").trim() || "paying_persons";
  const depositBasis = basisRaw as DepositBasis;
  if (!DEPOSIT_BASES.includes(depositBasis)) {
    return { error: "Bitte eine Anzahlungsart wählen." };
  }

  let customDepositCents: number | null = null;
  if (paymentType === "deposit" && depositBasis === "custom_total") {
    const raw = (fields.custom_deposit ?? "").trim();
    if (raw === "") return { error: "Bitte den Anzahlungsbetrag eingeben." };
    customDepositCents = parseEuroToCents(raw);
    if (customDepositCents === null) {
      return { error: "Anzahlungsbetrag: bitte als Euro-Betrag eingeben, z. B. 50 oder 50,00." };
    }
    if (customDepositCents <= 0) return { error: "Die Anzahlung muss größer als 0 € sein." };
  }

  return {
    values: {
      departure_id: (fields.departure_id ?? "").trim(),
      seats,
      payment_type: paymentType,
      deposit_basis: depositBasis,
      custom_deposit_cents: customDepositCents,
    },
  };
}

/**
 * Ganzes Verkaufsformular prüfen. Name + Handynummer sind bei JEDEM Verkauf
 * Pflicht — Anzahlung wie Vollzahler (F8, Marco 03.10.2026); E-Mail optional.
 */
export function parseSaleFields(
  fields: Record<string, string>,
): { values: SaleValues } | { error: string } {
  const amounts = parseSaleAmountFields(fields);
  if ("error" in amounts) return amounts;

  const name = (fields.customer_name ?? "").trim();
  if (name === "") return { error: "Bitte den Namen des Kunden eingeben." };
  if (name.length > 200) return { error: "Der Name ist zu lang (max. 200 Zeichen)." };

  const phone = (fields.customer_phone ?? "").trim();
  if ((phone.match(/\d/g) ?? []).length < 6 || phone.length > 40) {
    return { error: "Bitte eine gültige Handynummer eingeben (mindestens 6 Ziffern)." };
  }

  const email = (fields.customer_email ?? "").trim();
  if (email !== "" && (!EMAIL_RE.test(email) || email.length > 254)) {
    return { error: "Die E-Mail-Adresse ist ungültig — korrigieren oder leer lassen." };
  }

  return {
    values: {
      ...amounts.values,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
    },
  };
}
