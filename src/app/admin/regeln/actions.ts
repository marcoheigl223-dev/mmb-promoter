"use server";

import { revalidatePath } from "next/cache";

import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/admin/errors";
import { parseEuroToCents } from "@/lib/admin/money";
import { madridLocalToIso } from "@/lib/admin/time";
import type { FormState } from "@/lib/admin/types";

/**
 * Server Actions für die globalen Regeln (E3.2): Provisions-Standard und
 * 10+1-Gruppenregel. Jede Änderung ist eine NEUE Zeile (append-only) —
 * UPDATE/DELETE hat authenticated in der DB gar nicht (Migration 0004).
 */

function parseValidFrom(fd: FormData): { valid_from?: string } | { error: string } {
  const raw = String(fd.get("valid_from") ?? "").trim();
  if (!raw) return {};
  const iso = madridLocalToIso(raw);
  return iso ? { valid_from: iso } : { error: "Ungültiges Gültig-ab-Datum." };
}

/** Neuer Provisions-Standard (gilt für alle Termine ohne Ausnahme). */
export async function setStandardCommission(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const commission_cents = parseEuroToCents(String(formData.get("commission_euro") ?? ""));
  if (commission_cents === null) {
    return { error: "Bitte einen Betrag in Euro eingeben (z. B. 10,00).", ok: null };
  }
  const validFrom = parseValidFrom(formData);
  if ("error" in validFrom) return { error: validFrom.error, ok: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_rules")
    .insert({ departure_id: null, commission_cents, ...validFrom });
  if (error) return { error: dbErrorMessage(error), ok: null };

  revalidatePath("/admin/regeln");
  revalidatePath("/admin", "layout");
  return { error: null, ok: "Neuer Standard gespeichert." };
}

/** Neue Gruppenregel (Schwelle, Gratisplätze). */
export async function setGroupRule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireArea("admin");
  const thresholdRaw = String(formData.get("threshold_persons") ?? "").trim();
  const freeRaw = String(formData.get("free_persons") ?? "").trim();
  if (!/^\d{1,4}$/.test(thresholdRaw) || !/^\d{1,4}$/.test(freeRaw)) {
    return { error: "Schwelle und Gratisplätze müssen ganze Zahlen sein.", ok: null };
  }
  const threshold_persons = Number(thresholdRaw);
  const free_persons = Number(freeRaw);
  if (threshold_persons < 2) {
    return { error: "Die Schwelle muss mindestens 2 Personen sein.", ok: null };
  }
  if (free_persons >= threshold_persons) {
    return { error: "Gratisplätze müssen kleiner als die Schwelle sein.", ok: null };
  }
  const validFrom = parseValidFrom(formData);
  if ("error" in validFrom) return { error: validFrom.error, ok: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("group_rules")
    .insert({ threshold_persons, free_persons, ...validFrom });
  if (error) return { error: dbErrorMessage(error), ok: null };

  revalidatePath("/admin/regeln");
  return { error: null, ok: "Neue Gruppenregel gespeichert." };
}
