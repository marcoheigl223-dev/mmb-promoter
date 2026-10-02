"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/admin/errors";
import { depositAbovePriceError, parseOptionalEuro } from "@/lib/admin/pricing";
import { standardPricing } from "@/lib/admin/queries";
import type { EventTemplateInput, FormState } from "@/lib/admin/types";

/**
 * Server Actions für Eventvorlagen (E5.2, Migration 0007). Jede Action prüft
 * selbst requireArea("admin"); geschrieben wird über den RLS-Client des
 * Nutzers — Policies + Spalten-Grants aus 0007 sind die zweite Schranke
 * (nur network_operator; kein DELETE: deaktivieren statt löschen).
 *
 * Beträge in der Vorlage sind optional (leer = beim Event gilt der Standard).
 * Die Plausibilität „Anzahlung ≤ Ticketpreis" wird wie beim Termin mit den
 * Werten geprüft, die beim Event gälten (Vorlage, sonst Standard); die DB prüft
 * zusätzlich, wenn beide Werte in der Vorlage stehen.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function parseTemplate(
  fd: FormData,
): Promise<{ values: EventTemplateInput } | { error: string }> {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Bitte einen Namen für die Vorlage eingeben." };
  if (name.length > 200) return { error: "Name ist zu lang (max. 200 Zeichen)." };

  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "Bitte den Titel eingeben, den das Event bekommen soll." };
  if (title.length > 200) return { error: "Titel ist zu lang (max. 200 Zeichen)." };

  const capacityRaw = String(fd.get("capacity_total") ?? "").trim();
  if (!/^\d{1,6}$/.test(capacityRaw)) {
    return { error: "Kontingent muss eine ganze Zahl ab 0 sein." };
  }

  const noteRaw = String(fd.get("note") ?? "").trim();
  if (noteRaw.length > 2000) return { error: "Notiz ist zu lang (max. 2000 Zeichen)." };

  const price = parseOptionalEuro(String(fd.get("ticket_price_euro") ?? ""));
  if ("error" in price) return { error: `Eigener Ticketpreis: ${price.error}` };
  const deposit = parseOptionalEuro(String(fd.get("deposit_euro") ?? ""));
  if ("error" in deposit) return { error: `Eigene Anzahlung: ${deposit.error}` };
  const commission = parseOptionalEuro(String(fd.get("commission_euro") ?? ""));
  if ("error" in commission) return { error: `Eigene Provision: ${commission.error}` };

  const plausibility = depositAbovePriceError(
    { ticket_price: price.cents, deposit: deposit.cents },
    await standardPricing(),
  );
  if (plausibility) return { error: plausibility };

  return {
    values: {
      name,
      title,
      capacity_total: Number(capacityRaw),
      is_internal: fd.get("is_internal") === "on",
      note: noteRaw || null,
      ticket_price_cents: price.cents,
      deposit_cents: deposit.cents,
      commission_cents: commission.cents,
    },
  };
}

/** Vorlage anlegen → danach zur Detailseite. */
export async function createTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const parsed = await parseTemplate(formData);
  if ("error" in parsed) return { error: parsed.error, ok: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_templates")
    .insert(parsed.values)
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error), ok: null };

  revalidatePath("/admin/vorlagen");
  revalidatePath("/admin/termine/neu");
  redirect(`/admin/vorlagen/${(data as { id: string }).id}`);
}

/** Vorlage ändern — berührt bestehende Events nicht (Werte wurden kopiert). */
export async function updateTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Ungültige Vorlage.", ok: null };
  const parsed = await parseTemplate(formData);
  if ("error" in parsed) return { error: parsed.error, ok: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_templates")
    .update(parsed.values)
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), ok: null };
  if (!data || data.length === 0) return { error: "Vorlage nicht gefunden.", ok: null };

  revalidatePath("/admin/vorlagen");
  revalidatePath(`/admin/vorlagen/${id}`);
  revalidatePath("/admin/termine/neu");
  return { error: null, ok: "Gespeichert. Bereits angelegte Events bleiben unverändert." };
}

/** Vorlage deaktivieren/aktivieren (statt löschen — es gibt keinen DELETE-Grant). */
export async function setTemplateActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Ungültige Vorlage.", ok: null };
  const activeRaw = String(formData.get("active") ?? "");
  if (activeRaw !== "true" && activeRaw !== "false") return { error: "Ungültige Auswahl.", ok: null };
  const active = activeRaw === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_templates")
    .update({ active })
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), ok: null };
  if (!data || data.length === 0) return { error: "Vorlage nicht gefunden.", ok: null };

  revalidatePath("/admin/vorlagen");
  revalidatePath(`/admin/vorlagen/${id}`);
  revalidatePath("/admin/termine/neu");
  return {
    error: null,
    ok: active ? "Vorlage ist wieder aktiv." : "Vorlage deaktiviert — daraus lassen sich keine neuen Events anlegen.",
  };
}
