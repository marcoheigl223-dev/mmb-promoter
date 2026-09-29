import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-Client für Server Components, Server Actions und Route Handler.
 * Läuft mit dem Anon-Key + Session-Cookie des Nutzers — also unter RLS als
 * Supabase-Rolle `authenticated`. Die Fachrolle (network_operator/promoter)
 * steht NICHT im Token, sondern in `profiles` (siehe src/lib/auth/dal.ts).
 *
 * Pro Request ein neuer Client (@supabase/ssr-Muster, kein Singleton).
 * `setAll` schlägt in Server Components fehl (dort dürfen keine Cookies
 * gesetzt werden) — das ist unkritisch, weil der Proxy die Session erneuert.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component: Cookies werden vom Proxy (src/proxy.ts) erneuert.
        }
      },
    },
  });
}

export function supabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} fehlt. .env.local aus .env.local.example anlegen (Werte: supabase status).`,
    );
  }
  return value;
}
