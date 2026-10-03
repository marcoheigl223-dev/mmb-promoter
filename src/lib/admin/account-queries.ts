import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { MANAGED_ROLES, type ManagedRole } from "./accounts";

/**
 * Lesezugriffe der Konto-Verwaltung (Teil 2). Profile kommen über den
 * RLS-Client von Gabo (Policy profiles_select_network_operator); nur die
 * E-Mail-Adresse steht in auth.users und kommt über die GoTrue-Admin-API.
 */

export type ManagedAccount = {
  id: string;
  role: ManagedRole;
  active: boolean;
  display_name: string;
  created_at: string;
  updated_at: string;
  email: string | null;
};

const COLUMNS = "id, role, active, display_name, created_at, updated_at";
const PER_PAGE = 200;

async function emailsById(ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;
  const wanted = new Set(ids);
  const admin = createAuthAdminClient();
  // Seitenweise, bis alle gesuchten Konten gefunden oder keine Seiten mehr da sind.
  for (let page = 1; page <= 50 && result.size < wanted.size; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`Konten konnten nicht gelesen werden: ${error.message}`);
    for (const user of data.users) {
      if (wanted.has(user.id) && user.email) result.set(user.id, user.email);
    }
    if (data.users.length < PER_PAGE) break;
  }
  return result;
}

export async function listManagedAccounts(): Promise<ManagedAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .in("role", [...MANAGED_ROLES])
    .order("display_name");
  if (error) throw new Error(`Konten konnten nicht geladen werden: ${error.message}`);
  const rows = (data ?? []) as Omit<ManagedAccount, "email">[];
  const emails = await emailsById(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, email: emails.get(r.id) ?? null }));
}

export async function getManagedAccount(id: string): Promise<ManagedAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(COLUMNS)
    .eq("id", id)
    .in("role", [...MANAGED_ROLES])
    .maybeSingle();
  if (error) throw new Error(`Konto konnte nicht geladen werden: ${error.message}`);
  if (!data) return null;
  const { data: user } = await createAuthAdminClient().getUserById(id);
  return { ...(data as Omit<ManagedAccount, "email">), email: user?.user?.email ?? null };
}
