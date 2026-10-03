"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { saleErrorMessage } from "@/lib/promoter/errors";
import {
  SALE_AMOUNT_FIELDS,
  parseSaleAmountFields,
  parseSaleFields,
  readSaleFields,
} from "@/lib/promoter/sale";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  type SaleAmountValues,
  type SaleFormState,
  type SalePreview,
  type SaleQuote,
  type StatusFormState,
} from "@/lib/promoter/types";

/**
 * Server Actions Promoter-Verkauf (E5.4). Jede Action prüft selbst
 * requireArea("promoter") (Next.js 16: Layout-Guard deckt Actions nicht).
 * Geschrieben wird nur über die SECURITY-DEFINER-Funktionen aus 0010 mit dem
 * RLS-Client des Promoters — nie über service_role. Beträge rechnet allein die DB.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = Awaited<ReturnType<typeof createClient>>;

function rpcArgs(v: SaleAmountValues) {
  return {
    p_departure_id: v.departure_id,
    p_seats: v.seats,
    p_payment_type: v.payment_type,
    p_deposit_basis: v.deposit_basis,
    p_custom_deposit_cents: v.custom_deposit_cents,
  };
}

/** quote_promoter_sale() aufrufen — ohne Verfügbarkeitsprüfung, ohne Logging. */
async function rawQuote(
  supabase: Supabase,
  v: SaleAmountValues,
): Promise<{ quote: SaleQuote } | { error: { message: string; code?: string } }> {
  const { data, error } = await supabase.rpc("quote_promoter_sale", rpcArgs(v));
  if (error) return { error };
  const row = (Array.isArray(data) ? data[0] : data) as SaleQuote | undefined;
  if (!row) return { error: { message: "" } };
  return { quote: row };
}

async function fetchQuote(
  supabase: Supabase,
  v: SaleAmountValues,
): Promise<{ quote: SaleQuote } | { error: string }> {
  const q = await rawQuote(supabase, v);
  if ("error" in q) {
    console.error("quote_promoter_sale", q.error);
    return { error: saleErrorMessage(q.error) };
  }
  const row = q.quote;
  if (row.seats_available < v.seats) {
    return {
      error:
        row.seats_available === 0
          ? "Für dieses Event sind keine Plätze mehr frei."
          : row.seats_available === 1
            ? "Nur noch 1 Platz frei."
            : `Nur noch ${row.seats_available} Plätze frei.`,
    };
  }
  return { quote: row };
}

/**
 * Live-Übersicht im Eingabeschritt (Marco 03.10.2026: „Beträge vorrechnen“).
 * Wird bei jeder Änderung von Personen/Zahlart/Anzahlungsart aus dem Browser
 * aufgerufen; rechnet über dieselbe DB-Funktion wie Bestätigung und Buchung
 * (eine Rechenstelle) und schreibt nichts. Kundendaten werden nicht übertragen.
 */
export async function previewSaleAction(input: Record<string, string>): Promise<SalePreview> {
  await requireArea("promoter");

  const fields: Record<string, string> = {};
  for (const name of SALE_AMOUNT_FIELDS) {
    const v = input?.[name];
    fields[name] = typeof v === "string" ? v : "";
  }
  if (!UUID_RE.test(fields.departure_id)) {
    return { quote: null, depositOpen: false, error: "Ungültiges Event." };
  }

  const supabase = await createClient();
  const isCustomDeposit =
    fields.payment_type === "deposit" && fields.deposit_basis === "custom_total";

  // Freier Anzahlungsbetrag fehlt/ungültig/zu hoch: Gesamtpreis trotzdem zeigen
  // (als Vollzahlung gerechnet), Anzahlung und Rest bleiben offen.
  const fullQuote = async (error: string): Promise<SalePreview> => {
    const parsedFull = parseSaleAmountFields({ ...fields, payment_type: "full", custom_deposit: "" });
    if ("error" in parsedFull) return { quote: null, depositOpen: false, error: parsedFull.error };
    const q = await rawQuote(supabase, parsedFull.values);
    if ("error" in q) return { quote: null, depositOpen: false, error: saleErrorMessage(q.error) };
    return { quote: q.quote, depositOpen: true, error };
  };

  const parsed = parseSaleAmountFields(fields);
  if ("error" in parsed) {
    if (isCustomDeposit && !("error" in parseSaleAmountFields({ ...fields, payment_type: "full" }))) {
      return fullQuote(parsed.error);
    }
    return { quote: null, depositOpen: false, error: parsed.error };
  }

  const q = await rawQuote(supabase, parsed.values);
  if ("error" in q) {
    if (isCustomDeposit && /DEPOSIT_NOT_BELOW_TOTAL|DEPOSIT_NOT_POSITIVE/.test(q.error.message)) {
      return fullQuote(saleErrorMessage(q.error));
    }
    return { quote: null, depositOpen: false, error: saleErrorMessage(q.error) };
  }
  return { quote: q.quote, depositOpen: false, error: null };
}

/**
 * Zweistufiger Verkauf mit einem Formular-Zustand:
 * intent=quote   → Eingaben prüfen, Angebot aus der DB, neuer Idempotenz-Schlüssel → Bestätigung
 * intent=edit    → zurück zur Eingabe (Felder bleiben)
 * intent=confirm → reserve_promoter_seats() mit Schlüssel + erwarteten Beträgen → Verkaufs-Detail
 */
export async function saleAction(
  _prev: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  await requireArea("promoter");

  const intent = formData.get("intent");
  const fields = readSaleFields(formData);
  const back = (error: string | null): SaleFormState => ({
    step: "input",
    error,
    fields,
    quote: null,
    key: null,
  });

  if (!UUID_RE.test(fields.departure_id)) return back("Ungültiges Event.");
  if (intent === "edit") return back(null);

  const parsed = parseSaleFields(fields);
  if ("error" in parsed) return back(parsed.error);
  const values = parsed.values;

  const supabase = await createClient();

  if (intent === "quote") {
    const q = await fetchQuote(supabase, values);
    if ("error" in q) return back(q.error);
    return { step: "confirm", error: null, fields, quote: q.quote, key: randomUUID() };
  }

  if (intent !== "confirm") return back("Unbekannte Aktion.");

  const key = String(formData.get("idempotency_key") ?? "");
  const expectedTotal = Number(formData.get("expected_total_cents"));
  const expectedPaid = Number(formData.get("expected_amount_paid_cents"));
  if (!UUID_RE.test(key) || !Number.isSafeInteger(expectedTotal) || !Number.isSafeInteger(expectedPaid)) {
    return back("Bitte die Beträge erneut prüfen lassen.");
  }

  const { data, error } = await supabase.rpc("reserve_promoter_seats", {
    ...rpcArgs(values),
    p_customer_name: values.customer_name,
    p_customer_phone: values.customer_phone,
    p_customer_email: values.customer_email === "" ? null : values.customer_email,
    p_idempotency_key: key,
    p_expected_total_cents: expectedTotal,
    p_expected_amount_paid_cents: expectedPaid,
  });

  let bookingId: string | null = typeof data === "string" ? data : null;

  if (error) {
    // Zwei gleichzeitige Absendungen mit demselben Schlüssel (Doppel-Tipp):
    // die zweite scheitert am eindeutigen Index — es gibt die Buchung aber schon.
    if (error.code === "23505" && error.message.includes("bookings_idempotency_key_key")) {
      const { data: existing } = await supabase
        .from("bookings")
        .select("id")
        .eq("idempotency_key", key)
        .maybeSingle();
      bookingId = existing?.id ?? null;
    }
    if (!bookingId) {
      console.error("reserve_promoter_seats", error);
      if (/QUOTE_CHANGED/.test(error.message)) {
        // Regeln haben sich zwischen Angebot und Bestätigung geändert:
        // neues Angebot zeigen, derselbe Schlüssel (es wurde nichts gebucht).
        const q = await fetchQuote(supabase, values);
        if ("error" in q) return back(q.error);
        return {
          step: "confirm",
          error: saleErrorMessage(error),
          fields,
          quote: q.quote,
          key,
        };
      }
      return back(saleErrorMessage(error));
    }
  }

  if (!bookingId) return back(saleErrorMessage({ message: "" }));

  revalidatePath("/promoter");
  redirect(`/promoter/verkaeufe/${bookingId}?neu=1`);
}

/** Zahlungsstatus ändern (3 Stufen) — Audit-Zeile schreibt die DB-Funktion. */
export async function setPaymentStatusAction(
  _prev: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  await requireArea("promoter");
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!UUID_RE.test(bookingId)) return { error: "Ungültiger Verkauf.", ok: null };

  const status = String(formData.get("payment_status") ?? "") as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(status)) return { error: "Unbekannter Zahlungsstatus.", ok: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_booking_payment_status", {
    p_booking_id: bookingId,
    p_payment_status: status,
  });
  if (error) {
    console.error("set_booking_payment_status", error);
    return { error: saleErrorMessage(error), ok: null };
  }

  revalidatePath(`/promoter/verkaeufe/${bookingId}`);
  revalidatePath("/promoter");
  return { error: null, ok: `Zahlungsstatus: ${PAYMENT_STATUS_LABELS[status]}.` };
}
