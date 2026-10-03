import { describe, expect, it } from "vitest";

import { readEnvLocal } from "./db";

// E2.3 — End-to-End gegen die laufende App (npm run dev auf 3001):
// "Promoter kommt nicht ins network_operator-Admin", "inaktiver Promoter kommt
// nicht rein", "ohne Login → /login". Geht durch Proxy (src/proxy.ts) UND DAL
// (src/lib/auth/dal.ts). Die Session wird bei GoTrue geholt und als Cookie im
// Format von @supabase/ssr gesetzt — so, wie der Browser es nach dem Login hat.
// Läuft der Dev-Server nicht, wird die Datei übersprungen (nicht rot).

const APP = process.env.NEXT_PUBLIC_SITE_URL ?? readEnvLocal("NEXT_PUBLIC_SITE_URL") ?? "http://127.0.0.1:3001";
const AUTH = process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnvLocal("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:45321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? readEnvLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "";

if (!/127\.0\.0\.1|localhost/.test(APP) || !/127\.0\.0\.1|localhost/.test(AUTH)) {
  throw new Error(`App-Tests laufen nur lokal, nicht gegen: ${APP} / ${AUTH}`);
}

const serverUp = await fetch(`${APP}/login`, { redirect: "manual" })
  .then((r) => r.status === 200)
  .catch(() => false);

// Cookie-Name von @supabase/ssr: "sb-<erstes Host-Label>-auth-token", Wert
// "base64-" + base64url(JSON der Session). Bei 127.0.0.1 → "sb-127-auth-token".
const COOKIE_NAME = `sb-${new URL(AUTH).hostname.split(".")[0]}-auth-token`;

async function sessionCookie(email: string, password: string): Promise<string> {
  const res = await fetch(`${AUTH}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login ${email} fehlgeschlagen: ${res.status}`);
  const session = await res.json();
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${COOKIE_NAME}=base64-${encoded}`;
}

async function get(path: string, cookie?: string) {
  const res = await fetch(`${APP}${path}`, {
    redirect: "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, location: res.headers.get("location"), text: await res.text() };
}

describe.skipIf(!serverUp)("App-Zugang (Dev-Server auf 3001)", () => {
  it("ohne Session: /admin und /promoter → /login", async () => {
    for (const p of ["/admin", "/promoter", "/admin/irgendwas"]) {
      const r = await get(p);
      expect(r.status, p).toBe(307);
      expect(r.location, p).toContain("/login");
    }
  });

  it("Promoter kommt in /promoter, aber NICHT ins Admin → /kein-zugang", async () => {
    const cookie = await sessionCookie("promoter@mmb-promoter.test", "promoter-test-2026");
    const ok = await get("/promoter", cookie);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain("Test-Promoter");
    const denied = await get("/admin", cookie);
    expect(denied.status).toBe(307);
    expect(denied.location).toContain("/kein-zugang");
  });

  it("network_operator kommt ins Admin, nicht in /promoter", async () => {
    const cookie = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    const ok = await get("/admin", cookie);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain("Test-Operator");
    const denied = await get("/promoter", cookie);
    expect(denied.status).toBe(307);
    expect(denied.location).toContain("/kein-zugang");
  });

  it("inaktiver Promoter kommt nirgends rein → /gesperrt", async () => {
    const cookie = await sessionCookie("inactive-promoter@mmb-promoter.test", "inactive-test-2026");
    for (const p of ["/promoter", "/admin"]) {
      const r = await get(p, cookie);
      expect(r.status, p).toBe(307);
      expect(r.location, p).toContain("/gesperrt");
    }
  });

  it("Startseite verteilt nach Rolle aus der DB", async () => {
    expect((await get("/")).location).toContain("/login");
    const op = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    expect((await get("/", op)).location).toContain("/admin");
    const pr = await sessionCookie("promoter@mmb-promoter.test", "promoter-test-2026");
    expect((await get("/", pr)).location).toContain("/promoter");
  });

  it("gefälschtes Cookie (kaputtes Token) → wie nicht eingeloggt", async () => {
    const r = await get("/admin", `${COOKIE_NAME}=base64-${Buffer.from('{"access_token":"x.y.z","refresh_token":"nope"}').toString("base64url")}`);
    expect(r.status).toBe(307);
    expect(r.location).toContain("/login");
  });

  // E3.2 — Admin-Seiten für Termine/Regeln: Operator ja, Promoter nein.
  it("E3: Operator sieht Termine, Neu-Formular und Regeln", async () => {
    const cookie = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    const list = await get("/admin", cookie);
    expect(list.status).toBe(200);
    expect(list.text).toContain("Termine und Events");
    const neu = await get("/admin/termine/neu", cookie);
    expect(neu.status).toBe(200);
    expect(neu.text).toContain("Neuer Termin / Event");
    expect(neu.text).toContain("Internes Event");
    // E3.4 (F14): eigener Preis/Anzahlung schon beim Anlegen
    expect(neu.text).toContain("Eigener Ticketpreis pro Person");
    expect(neu.text).toContain("Eigene Anzahlung pro Person");
    const rules = await get("/admin/regeln", cookie);
    expect(rules.status).toBe(200);
    expect(rules.text).toContain("Provision pro Ticket (Standard)");
    expect(rules.text).toContain("Gruppenregel (10+1)");
    // E3.4 (F14): Standard-Preis und Standard-Anzahlung als Regeln
    expect(rules.text).toContain("Ticketpreis pro Person (Standard)");
    expect(rules.text).toContain("Anzahlung pro Person (Standard)");
    expect((await get("/admin/termine/keine-uuid", cookie)).status).toBe(404);
  });

  // E5.2 — Eventvorlagen: Liste, Neu-Formular, „Aus Vorlage" auf dem Termin-Formular.
  it("E5.2: Operator sieht Eventvorlagen, Neu-Formular und „Aus Vorlage“ beim Termin", async () => {
    const cookie = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    const list = await get("/admin/vorlagen", cookie);
    expect(list.status).toBe(200);
    expect(list.text).toContain("Eventvorlagen");
    const neu = await get("/admin/vorlagen/neu", cookie);
    expect(neu.status).toBe(200);
    expect(neu.text).toContain("Neue Eventvorlage");
    expect(neu.text).toContain("Eigene Provision pro Ticket");
    const termin = await get("/admin/termine/neu", cookie);
    expect(termin.status).toBe(200);
    expect(termin.text).toContain("Aus Vorlage");
    expect((await get("/admin/vorlagen/keine-uuid", cookie)).status).toBe(404);
    // Unbekannte Vorlage per Query → normales Formular mit Hinweis, kein Absturz
    const unknown = await get("/admin/termine/neu?vorlage=00000000-0000-4000-8000-000000000000", cookie);
    expect(unknown.status).toBe(200);
    expect(unknown.text).toContain("Vorlage nicht gefunden");
  });

  it("E3: Promoter kommt auf keine Admin-Seite → /kein-zugang", async () => {
    const cookie = await sessionCookie("promoter@mmb-promoter.test", "promoter-test-2026");
    for (const p of [
      "/admin/termine/neu",
      "/admin/regeln",
      "/admin/termine/00000000-0000-4000-8000-000000000000",
      "/admin/vorlagen",
      "/admin/vorlagen/neu",
    ]) {
      const r = await get(p, cookie);
      expect(r.status, p).toBe(307);
      expect(r.location, p).toContain("/kein-zugang");
    }
  });

  // E5.4 — Verkaufs-Kern: Promoter sieht Events + eigene Verkäufe, Verkaufsseiten
  // sind nur für Promoter; Gabo (strikt eine Rolle je Bereich, F13) kommt nicht hin.
  it("E5.4: Promoter sieht Event-Liste und Verkaufsseiten, Operator nicht", async () => {
    const cookie = await sessionCookie("promoter@mmb-promoter.test", "promoter-test-2026");
    const home = await get("/promoter", cookie);
    expect(home.status).toBe(200);
    expect(home.text).toContain("Events verkaufen");
    expect(home.text).toContain("Meine letzten Verkäufe");
    for (const p of [
      "/promoter/verkaufen/keine-uuid",
      "/promoter/verkaufen/00000000-0000-4000-8000-000000000000",
      "/promoter/verkaeufe/keine-uuid",
      "/promoter/verkaeufe/00000000-0000-4000-8000-000000000000",
    ]) {
      expect((await get(p, cookie)).status, p).toBe(404);
    }
    const op = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    for (const p of ["/promoter/verkaufen/00000000-0000-4000-8000-000000000000", "/promoter/verkaeufe/00000000-0000-4000-8000-000000000000"]) {
      const r = await get(p, op);
      expect(r.status, p).toBe(307);
      expect(r.location, p).toContain("/kein-zugang");
    }
    const anon = await get("/promoter/verkaufen/00000000-0000-4000-8000-000000000000");
    expect(anon.status).toBe(307);
    expect(anon.location).toContain("/login");
  });

  // E5.5b (Teil 1 nach der Diagnose E5.5): Dashboard über die Kopfzeile erreichbar
  it("E5.5b: Promoter erreicht „Mein Dashboard“ über die Kopfzeile, Operator nicht", async () => {
    const cookie = await sessionCookie("promoter@mmb-promoter.test", "promoter-test-2026");
    const home = await get("/promoter", cookie);
    expect(home.text).toContain('href="/promoter/dashboard"');
    expect(home.text).toContain("Mein Dashboard");
    const dash = await get("/promoter/dashboard", cookie);
    expect(dash.status).toBe(200);
    for (const t of ["Mein Dashboard", "Heute", "Gesamt", "Provision", "Offen (Rest im Bus)", "Abschlüsse der letzten 14 Tage", "Alle meine Verkäufe"]) {
      expect(dash.text, t).toContain(t);
    }
    expect(dash.text).toContain('href="/promoter"');
    const op = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    const r = await get("/promoter/dashboard", op);
    expect(r.status).toBe(307);
    expect(r.location).toContain("/kein-zugang");
    const anon = await get("/promoter/dashboard");
    expect(anon.status).toBe(307);
    expect(anon.location).toContain("/login");
  });

  // Teil 2 — Guide als dritte Rolle: verkauft und hat ein eigenes Dashboard wie ein
  // Promoter, kommt aber auf keine Admin-Seite. Konto-Verwaltung nur für Gabo.
  it("Teil 2: Guide kommt in /promoter (Events, Verkaufen, Dashboard), NICHT ins Admin → /kein-zugang", async () => {
    const cookie = await sessionCookie("guide@mmb-promoter.test", "guide-test-2026");
    const home = await get("/promoter", cookie);
    expect(home.status).toBe(200);
    expect(home.text).toContain("Events verkaufen");
    expect(home.text).toContain("Guide");
    const dash = await get("/promoter/dashboard", cookie);
    expect(dash.status).toBe(200);
    expect(dash.text).toContain("Alle meine Verkäufe");
    expect((await get("/promoter/verkaufen/00000000-0000-4000-8000-000000000000", cookie)).status).toBe(404);
    for (const p of [
      "/admin",
      "/admin/konten",
      "/admin/konten/22222222-2222-4222-8222-222222222222",
      "/admin/termine/neu",
      "/admin/regeln",
      "/admin/vorlagen",
    ]) {
      const r = await get(p, cookie);
      expect(r.status, p).toBe(307);
      expect(r.location, p).toContain("/kein-zugang");
    }
    const root = await get("/", cookie);
    expect(root.location ?? "").toContain("/promoter");
  });

  it("Teil 2: Konto-Verwaltung — Operator sieht Promoter und Guides getrennt, Promoter kommt nicht hin", async () => {
    const op = await sessionCookie("operator@mmb-promoter.test", "operator-test-2026");
    const list = await get("/admin/konten", op);
    expect(list.status).toBe(200);
    for (const t of ["Konten", "Promoter", "Guides", "Neuen Promoter anlegen", "Neuen Guide anlegen", "guide@mmb-promoter.test", "promoter@mmb-promoter.test"]) {
      expect(list.text, t).toContain(t);
    }
    // Gabos eigenes Konto wird hier nicht verwaltet
    expect(list.text).not.toContain("operator@mmb-promoter.test");
    const detail = await get("/admin/konten/44444444-4444-4444-8444-444444444444", op);
    expect(detail.status).toBe(200);
    expect(detail.text).toContain("Test-Guide");
    expect((await get("/admin/konten/11111111-1111-4111-8111-111111111111", op)).status).toBe(404);
    expect((await get("/admin/konten/keine-uuid", op)).status).toBe(404);
    const pr = await sessionCookie("promoter@mmb-promoter.test", "promoter-test-2026");
    for (const p of ["/admin/konten", "/admin/konten/44444444-4444-4444-8444-444444444444"]) {
      const r = await get(p, pr);
      expect(r.status, p).toBe(307);
      expect(r.location, p).toContain("/kein-zugang");
    }
  });

  it("noindex überall: X-Robots-Tag + robots.txt", async () => {
    const res = await fetch(`${APP}/login`);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await (await fetch(`${APP}/robots.txt`)).text()).toMatch(/Disallow: \//);
  });
});
