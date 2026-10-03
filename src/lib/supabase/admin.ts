import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./server";

/**
 * Supabase-Client mit dem service_role-Schlüssel — AUSSCHLIESSLICH für die
 * GoTrue-Admin-API (`auth.admin.*`: Konto anlegen, Passwort setzen, E-Mails
 * lesen). Teil 2, DECISIONS 03.10.2026 Punkt c: Auth-Konten kann nur
 * service_role anlegen (Selbstregistrierung ist aus, `enable_signup = false`).
 *
 * NIE für Tabellen benutzen — Profile, Buchungen, Regeln schreibt die App immer
 * über den RLS-Client des Nutzers (`./server`), damit Policies + Spalten-Grants
 * die zweite Schranke bleiben. Jeder Aufrufer prüft vorher requireArea("admin").
 */
export function createAuthAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY fehlt. In .env.local eintragen (Wert: supabase status).",
    );
  }
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.admin;
}
