import { describe, expect, it } from "vitest";

import { readEnvLocal } from "./db";

// E2.2/E2.3 — Login gegen die lokale Auth-API (GoTrue auf 45321).
// Prüft die Seed-Konten, die Passwort-Mindestlänge 12 (config.toml) und dass
// Selbstregistrierung gesperrt ist. Braucht .env.local mit Anon-Key.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnvLocal("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:45321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? readEnvLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!/127\.0\.0\.1|localhost/.test(URL_)) {
  throw new Error(`Auth-Tests laufen nur gegen die lokale Instanz, nicht gegen: ${URL_}`);
}
if (!ANON) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt (.env.local aus .env.local.example, Werte: supabase status).");
}

type AuthResult = { status: number; body: Record<string, unknown> };

async function authCall(
  path: string,
  init: { method: string; body?: unknown; token?: string },
): Promise<AuthResult> {
  const res = await fetch(`${URL_}/auth/v1${path}`, {
    method: init.method,
    headers: {
      apikey: ANON!,
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

const login = (email: string, password: string) =>
  authCall("/token?grant_type=password", { method: "POST", body: { email, password } });

describe("Seed-Konten (nur lokal)", () => {
  it.each([
    ["operator@mmb-promoter.test", "operator-test-2026", "11111111-1111-4111-8111-111111111111"],
    ["promoter@mmb-promoter.test", "promoter-test-2026", "22222222-2222-4222-8222-222222222222"],
    ["inactive-promoter@mmb-promoter.test", "inactive-test-2026", "33333333-3333-4333-8333-333333333333"],
  ])("%s kann sich bei GoTrue anmelden (Sperre für inaktiv passiert in der App/RLS)", async (email, pw, id) => {
    const r = await login(email, pw);
    expect(r.status).toBe(200);
    expect((r.body.user as { id: string }).id).toBe(id);
    // Das Token trägt nur die Supabase-Rolle — keine Fachrolle.
    expect((r.body.user as { role: string }).role).toBe("authenticated");
  });

  it("falsches Passwort → 400 invalid_credentials", async () => {
    const r = await login("promoter@mmb-promoter.test", "falsch-falsch-falsch");
    expect(r.status).toBe(400);
    expect(r.body.error_code).toBe("invalid_credentials");
  });
});

describe("Härtung (config.toml)", () => {
  it("Selbstregistrierung ist gesperrt (enable_signup = false)", async () => {
    const r = await authCall("/signup", {
      method: "POST",
      body: { email: "neu@mmb-promoter.test", password: "ein-langes-passwort-99" },
    });
    expect(r.status).toBe(422);
    expect(r.body.error_code).toBe("signup_disabled");
  });

  it("Passwort-Mindestlänge 12: 11 Zeichen werden als weak_password abgelehnt", async () => {
    const { body } = await login("promoter@mmb-promoter.test", "promoter-test-2026");
    const token = body.access_token as string;
    const r = await authCall("/user", { method: "PUT", token, body: { password: "elf-zeichen" } });
    expect(r.status).toBe(422);
    expect(r.body.error_code).toBe("weak_password");
    expect(String(r.body.msg)).toMatch(/12/);
    // Und das alte Passwort gilt weiterhin:
    expect((await login("promoter@mmb-promoter.test", "promoter-test-2026")).status).toBe(200);
  });
});
