"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/admin/errors";
import { parseEuroToCents } from "@/lib/admin/money";
import {
  depositAbovePriceError,
  parseOptionalEuro,
  planPricingWrites,
} from "@/lib/admin/pricing";
import { activePricingOverrides, standardPricing } from "@/lib/admin/queries";
import { madridLocalToIso } from "@/lib/admin/time";
import {
  DEPARTURE_STATUSES,
  type DepartureInput,
  type DepartureStatus,
  type FormState,
  type PricingAmounts,
} from "@/lib/admin/types";

/**
 * Server Actions für Termine/Events (E3.2). Jede Action prüft selbst
 * requireArea("admin") — der Layout-Guard reicht nicht, Actions sind eigene
 * Einstiegspunkte (Next.js-Guide data-security). Geschrieben wird über den
 * RLS-Client des Nutzers: Policies + Spalten-Grants aus 0004 sind die zweite
 * Schranke (seats_booked_total ist dort gar nicht schreibbar, Hard Rule 4).
 *
 * E3.4 (F14): Das Formular trägt zusätzlich zwei optionale Felder — eigener
 * Ticketpreis und eigene Anzahlung pro Person. Sie landen NICHT in
 * tour_departures, sondern als append-only-Zeilen in pricing_rules (0005);
 * leer = Standard. planPricingWrites() entscheidet, ob überhaupt eine neue
 * Zeile nötig ist.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDeparture(fd: FormData): { values: DepartureInput } | { error: string } {
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "Bitte einen Titel eingeben." };
  if (title.length > 200) return { error: "Titel ist zu lang (max. 200 Zeichen)." };

  const starts_at = madridLocalToIso(String(fd.get("starts_at") ?? ""));
  if (!starts_at) return { error: "Bitte Datum und Uhrzeit angeben (Ortszeit Mallorca)." };

  const capacityRaw = String(fd.get("capacity_total") ?? "").trim();
  if (!/^\d{1,6}$/.test(capacityRaw)) {
    return { error: "Kontingent muss eine ganze Zahl ab 0 sein." };
  }
  const capacity_total = Number(capacityRaw);

  const status = String(fd.get("status") ?? "open");
  if (!(DEPARTURE_STATUSES as readonly string[]).includes(status)) {
    return { error: "Ungültiger Status." };
  }

  const noteRaw = String(fd.get("note") ?? "").trim();
  if (noteRaw.length > 2000) return { error: "Notiz ist zu lang (max. 2000 Zeichen)." };

  return {
    values: {
      title,
      starts_at,
      capacity_total,
      status: status as DepartureStatus,
      is_internal: fd.get("is_internal") === "on",
      note: noteRaw || null,
    },
  };
}

/** Optionale Felder „eigener Ticketpreis" / „eigene Anzahlung" (leer = Standard). */
function parsePricing(fd: FormData): { pricing: PricingAmounts } | { error: string } {
  const price = parseOptionalEuro(String(fd.get("ticket_price_euro") ?? ""));
  if ("error" in price) return { error: `Eigener Ticketpreis: ${price.error}` };
  const deposit = parseOptionalEuro(String(fd.get("deposit_euro") ?? ""));
  if ("error" in deposit) return { error: `Eigene Anzahlung: ${deposit.error}` };
  return { pricing: { ticket_price: price.cents, deposit: deposit.cents } };
}

/** Neue pricing_rules-Zeilen für einen Termin schreiben (nur die nötigen). */
async function writePricing(
  departureId: string,
  pricing: PricingAmounts,
  activeOverride: PricingAmounts,
): Promise<string | null> {
  const writes = planPricingWrites(pricing, activeOverride);
  if (writes.length === 0) return null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing_rules")
    .insert(writes.map((w) => ({ ...w, departure_id: departureId })));
  return error ? dbErrorMessage(error) : null;
}

/** Termin/Event anlegen → danach zur Detailseite. */
export async function createDeparture(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const parsed = parseDeparture(formData);
  if ("error" in parsed) return { error: parsed.error, ok: null };
  const pricing = parsePricing(formData);
  if ("error" in pricing) return { error: pricing.error, ok: null };
  const plausibility = depositAbovePriceError(pricing.pricing, await standardPricing());
  if (plausibility) return { error: plausibility, ok: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_departures")
    .insert(parsed.values)
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error), ok: null };
  const id = (data as { id: string }).id;

  const pricingError = await writePricing(id, pricing.pricing, {
    ticket_price: null,
    deposit: null,
  });
  revalidatePath("/admin");
  if (pricingError) {
    return {
      error: `Termin wurde angelegt, aber Preis/Anzahlung nicht gespeichert: ${pricingError} — bitte auf der Terminseite nachtragen.`,
      ok: null,
    };
  }
  redirect(`/admin/termine/${id}`);
}

/** Termin/Event ändern (Titel, Zeit, Kontingent, Status, intern, Notiz, Preis/Anzahlung). */
export async function updateDeparture(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Ungültiger Termin.", ok: null };
  const parsed = parseDeparture(formData);
  if ("error" in parsed) return { error: parsed.error, ok: null };
  const pricing = parsePricing(formData);
  if ("error" in pricing) return { error: pricing.error, ok: null };
  const plausibility = depositAbovePriceError(pricing.pricing, await standardPricing());
  if (plausibility) return { error: plausibility, ok: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tour_departures")
    .update(parsed.values)
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), ok: null };
  if (!data || data.length === 0) return { error: "Termin nicht gefunden.", ok: null };

  const pricingError = await writePricing(id, pricing.pricing, await activePricingOverrides(id));

  revalidatePath("/admin");
  revalidatePath(`/admin/termine/${id}`);
  if (pricingError) {
    return { error: `Termin gespeichert, aber Preis/Anzahlung nicht: ${pricingError}`, ok: null };
  }
  return { error: null, ok: "Gespeichert." };
}

/**
 * Provisions-Ausnahme für einen Termin/Event setzen — als NEUE Zeile in
 * commission_rules (append-only). mode "standard" schreibt eine Zeile mit
 * commission_cents = NULL: ab dann gilt wieder der Standard.
 */
export async function setDepartureCommission(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const departureId = String(formData.get("departure_id") ?? "");
  if (!UUID_RE.test(departureId)) return { error: "Ungültiger Termin.", ok: null };

  const mode = String(formData.get("mode") ?? "override");
  let commission_cents: number | null = null;
  if (mode === "override") {
    commission_cents = parseEuroToCents(String(formData.get("commission_euro") ?? ""));
    if (commission_cents === null) {
      return { error: "Bitte einen Betrag in Euro eingeben (z. B. 12,50).", ok: null };
    }
  } else if (mode !== "standard") {
    return { error: "Ungültige Auswahl.", ok: null };
  }

  const validFromRaw = String(formData.get("valid_from") ?? "").trim();
  const valid_from = validFromRaw ? madridLocalToIso(validFromRaw) : undefined;
  if (validFromRaw && !valid_from) return { error: "Ungültiges Gültig-ab-Datum.", ok: null };

  const supabase = await createClient();
  const { error } = await supabase.from("commission_rules").insert({
    departure_id: departureId,
    commission_cents,
    ...(valid_from ? { valid_from } : {}),
  });
  if (error) return { error: dbErrorMessage(error), ok: null };

  revalidatePath(`/admin/termine/${departureId}`);
  return {
    error: null,
    ok: mode === "standard" ? "Ab jetzt gilt wieder der Standard." : "Ausnahme gespeichert.",
  };
}
