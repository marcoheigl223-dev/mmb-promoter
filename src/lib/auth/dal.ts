import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { decideAccess, type Area, type Profile } from "@/lib/auth/access";

/**
 * Data Access Layer für Auth (Next.js-16-Guide "authentication": Proxy prüft
 * nur optimistisch das Cookie, die echte Prüfung passiert hier, nah an den
 * Daten — in jedem Layout/jeder Page/jeder Server Action, die etwas schützt).
 *
 * `getUser()` verifiziert das Token beim Auth-Server (kein getSession()).
 * Die Fachrolle wird danach aus `profiles` gelesen — über den RLS-geschützten
 * Client des Nutzers, d. h. die Policy `id = auth.uid()` greift.
 */

export type CurrentAuth = {
  userId: string | null;
  profile: Profile | null;
};

/** Profil-Zeile des Nutzers lesen. Nicht gecacht — für Server Actions nach signIn. */
export async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, active, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Profil konnte nicht gelesen werden: ${error.message}`);
  }
  return (data as Profile | null) ?? null;
}

/** Session + Profil des aktuellen Requests. Einmal pro Request (React cache). */
export const getCurrentAuth = cache(async (): Promise<CurrentAuth> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, profile: null };
  const profile = await loadProfile(supabase, user.id);
  return { userId: user.id, profile };
});

/**
 * Zugang zu einem Bereich erzwingen. Leitet um, wenn nicht erlaubt —
 * `redirect()` wirft, danach läuft nichts weiter.
 */
export async function requireArea(area: Area): Promise<Profile> {
  const { userId, profile } = await getCurrentAuth();
  const decision = decideAccess({ area, userId, profile });
  if (decision.kind === "redirect") {
    redirect(decision.to);
  }
  return decision.profile;
}
