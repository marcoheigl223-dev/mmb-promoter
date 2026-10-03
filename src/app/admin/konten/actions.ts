"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { dbErrorMessage } from "@/lib/admin/errors";
import {
  authErrorMessage,
  isManagedRole,
  parseDisplayName,
  parseEmail,
  parsePassword,
} from "@/lib/admin/accounts";
import type { FormState } from "@/lib/admin/types";

/**
 * Server Actions der Konto-Verwaltung (Teil 2, Migration 0013). Jede Action
 * prüft selbst requireArea("admin"). Profile (Rolle, Name, aktiv) schreibt
 * Gabo über seinen RLS-Client — die Policies aus 0013 erlauben nur Konten mit
 * Rolle promoter/guide, die Rolle ist danach nicht mehr änderbar.
 *
 * service_role wird nur für die GoTrue-Admin-API benutzt (Auth-Konto anlegen,
 * Passwort setzen) — und erst, nachdem requireArea und (beim Passwort) eine
 * RLS-Abfrage gezeigt haben, dass das Ziel ein Promoter-/Guide-Konto ist.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");

  const role = String(formData.get("role") ?? "");
  if (!isManagedRole(role)) return { error: "Ungültige Rolle.", ok: null };
  const name = parseDisplayName(String(formData.get("display_name") ?? ""));
  if ("error" in name) return { error: name.error, ok: null };
  const email = parseEmail(String(formData.get("email") ?? ""));
  if ("error" in email) return { error: email.error, ok: null };
  const password = parsePassword(String(formData.get("password") ?? ""));
  if ("error" in password) return { error: password.error, ok: null };

  const admin = createAuthAdminClient();
  const { data: created, error: createError } = await admin.createUser({
    email: email.value,
    password: password.value,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return { error: authErrorMessage(createError ?? { message: "kein Konto erhalten" }), ok: null };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: created.user.id, role, display_name: name.value, active: true });
  if (profileError) {
    // Kein Auth-Konto ohne Profil zurücklassen — die E-Mail wäre sonst belegt.
    await admin.deleteUser(created.user.id);
    return { error: dbErrorMessage(profileError), ok: null };
  }

  revalidatePath("/admin/konten");
  redirect(`/admin/konten/${created.user.id}?neu=1`);
}

export async function setAccountActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Ungültiges Konto.", ok: null };
  const activeRaw = String(formData.get("active") ?? "");
  if (activeRaw !== "true" && activeRaw !== "false") return { error: "Ungültige Auswahl.", ok: null };
  const active = activeRaw === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), ok: null };
  // 0 Zeilen: unbekannt oder kein Promoter-/Guide-Konto (Policy 0013).
  if (!data || data.length === 0) return { error: "Konto nicht gefunden.", ok: null };

  revalidatePath("/admin/konten");
  revalidatePath(`/admin/konten/${id}`);
  return {
    error: null,
    ok: active
      ? "Konto aktiviert — Anmeldung und Verkauf wieder möglich."
      : "Konto deaktiviert — keine Anmeldung, kein Verkauf; Verkäufe bleiben erhalten.",
  };
}

export async function updateAccountName(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Ungültiges Konto.", ok: null };
  const name = parseDisplayName(String(formData.get("display_name") ?? ""));
  if ("error" in name) return { error: name.error, ok: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name.value })
    .eq("id", id)
    .select("id");
  if (error) return { error: dbErrorMessage(error), ok: null };
  if (!data || data.length === 0) return { error: "Konto nicht gefunden.", ok: null };

  revalidatePath("/admin/konten");
  revalidatePath(`/admin/konten/${id}`);
  return { error: null, ok: "Name gespeichert." };
}

export async function setAccountPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireArea("admin");
  const id = String(formData.get("id") ?? "");
  if (!UUID_RE.test(id)) return { error: "Ungültiges Konto.", ok: null };
  const password = parsePassword(String(formData.get("password") ?? ""));
  if ("error" in password) return { error: password.error, ok: null };

  // Erst über RLS prüfen, dass das Ziel ein Promoter-/Guide-Konto ist — sonst
  // könnte die Action z. B. das Passwort von Gabos eigenem Konto setzen.
  const supabase = await createClient();
  const { data: target, error: readError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: dbErrorMessage(readError), ok: null };
  if (!target || !isManagedRole(String(target.role))) {
    return { error: "Konto nicht gefunden.", ok: null };
  }

  const { error } = await createAuthAdminClient().updateUserById(id, { password: password.value });
  if (error) return { error: authErrorMessage(error), ok: null };

  return { error: null, ok: "Neues Passwort gesetzt. Gib es der Person persönlich weiter." };
}
