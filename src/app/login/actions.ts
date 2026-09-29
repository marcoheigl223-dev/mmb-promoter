"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/auth/dal";
import { landingPathFor, LOGIN_PATH } from "@/lib/auth/access";

export type LoginState = { error: string | null };

/**
 * Passwort-Login. Nach erfolgreichem signIn wird das Profil aus der DB gelesen
 * und die Zielseite aus der ROLLE IN DER DB bestimmt. Deaktivierte Konten und
 * Konten ohne Profil werden sofort wieder abgemeldet — sie bekommen keine
 * gültige Session in der App.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    // Bewusst unspezifisch: nicht verraten, ob die E-Mail existiert.
    return { error: "Anmeldung fehlgeschlagen. E-Mail oder Passwort falsch." };
  }

  const profile = await loadProfile(supabase, data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Für dieses Konto ist kein Zugang eingerichtet." };
  }
  if (!profile.active) {
    await supabase.auth.signOut();
    return { error: "Dieses Konto ist deaktiviert." };
  }

  redirect(landingPathFor(profile));
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
