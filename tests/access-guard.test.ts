import { describe, expect, it } from "vitest";

import {
  areaForPath,
  decideAccess,
  landingPathFor,
  type Profile,
} from "../src/lib/auth/access";

// E2.3 — "Promoter kommt nicht ins network_operator-Admin",
// "inaktiver Promoter kommt nicht rein". Reine Entscheidungslogik, ohne DB.

const operator: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "network_operator",
  active: true,
  display_name: "Test-Operator",
};
const promoter: Profile = {
  id: "22222222-2222-4222-8222-222222222222",
  role: "promoter",
  active: true,
  display_name: "Test-Promoter",
};
const inactivePromoter: Profile = { ...promoter, active: false };
const guide: Profile = {
  id: "44444444-4444-4444-8444-444444444444",
  role: "guide",
  active: true,
  display_name: "Test-Guide",
};

describe("decideAccess", () => {
  it("nicht eingeloggt → /login (beide Bereiche)", () => {
    for (const area of ["admin", "promoter"] as const) {
      expect(decideAccess({ area, userId: null, profile: null })).toEqual({
        kind: "redirect",
        to: "/login",
        reason: "not_logged_in",
      });
    }
  });

  it("eingeloggt ohne Profil-Zeile → /kein-zugang", () => {
    expect(
      decideAccess({ area: "promoter", userId: "x", profile: null }),
    ).toMatchObject({ kind: "redirect", to: "/kein-zugang", reason: "no_profile" });
  });

  it("Profil gehört einem anderen Nutzer → /kein-zugang (kein Vertrauen in fremde Zeilen)", () => {
    expect(
      decideAccess({ area: "promoter", userId: "someone-else", profile: promoter }),
    ).toMatchObject({ kind: "redirect", to: "/kein-zugang" });
  });

  it("Promoter kommt NICHT ins Admin (network_operator)", () => {
    expect(
      decideAccess({ area: "admin", userId: promoter.id, profile: promoter }),
    ).toEqual({ kind: "redirect", to: "/kein-zugang", reason: "wrong_role" });
  });

  it("Promoter kommt in den Promoter-Bereich", () => {
    expect(
      decideAccess({ area: "promoter", userId: promoter.id, profile: promoter }),
    ).toEqual({ kind: "allow", profile: promoter });
  });

  it("network_operator kommt ins Admin", () => {
    expect(
      decideAccess({ area: "admin", userId: operator.id, profile: operator }),
    ).toEqual({ kind: "allow", profile: operator });
  });

  it("network_operator kommt NICHT in den Promoter-Bereich (strikt eine Rolle je Bereich)", () => {
    expect(
      decideAccess({ area: "promoter", userId: operator.id, profile: operator }),
    ).toMatchObject({ kind: "redirect", to: "/kein-zugang", reason: "wrong_role" });
  });

  it("Guide (Teil 2) kommt in den Promoter-Bereich (verkaufen, eigenes Dashboard)", () => {
    expect(
      decideAccess({ area: "promoter", userId: guide.id, profile: guide }),
    ).toEqual({ kind: "allow", profile: guide });
  });

  it("Guide kommt NICHT ins Admin (network_operator) → /kein-zugang", () => {
    expect(
      decideAccess({ area: "admin", userId: guide.id, profile: guide }),
    ).toEqual({ kind: "redirect", to: "/kein-zugang", reason: "wrong_role" });
  });

  it("deaktivierter Guide kommt nirgends rein → /gesperrt", () => {
    for (const area of ["admin", "promoter"] as const) {
      expect(
        decideAccess({ area, userId: guide.id, profile: { ...guide, active: false } }),
      ).toEqual({ kind: "redirect", to: "/gesperrt", reason: "inactive" });
    }
  });

  it("unbekannte Rolle (z. B. neuer Enum-Wert ohne Freigabe) kommt in keinen Bereich", () => {
    const unknown = { ...promoter, role: "auditor" } as unknown as Profile;
    for (const area of ["admin", "promoter"] as const) {
      expect(
        decideAccess({ area, userId: unknown.id, profile: unknown }),
      ).toMatchObject({ kind: "redirect", to: "/kein-zugang", reason: "wrong_role" });
    }
  });

  it("inaktiver Promoter kommt nirgends rein → /gesperrt", () => {
    for (const area of ["admin", "promoter"] as const) {
      expect(
        decideAccess({
          area,
          userId: inactivePromoter.id,
          profile: inactivePromoter,
        }),
      ).toEqual({ kind: "redirect", to: "/gesperrt", reason: "inactive" });
    }
  });

  it("inaktiv schlägt Rolle: deaktivierter network_operator → /gesperrt", () => {
    expect(
      decideAccess({
        area: "admin",
        userId: operator.id,
        profile: { ...operator, active: false },
      }),
    ).toMatchObject({ kind: "redirect", to: "/gesperrt" });
  });
});

describe("landingPathFor", () => {
  it("leitet nach Rolle aus der DB", () => {
    expect(landingPathFor(operator)).toBe("/admin");
    expect(landingPathFor(promoter)).toBe("/promoter");
    expect(landingPathFor(guide)).toBe("/promoter");
    expect(landingPathFor({ ...guide, active: false })).toBe("/gesperrt");
    expect(landingPathFor(inactivePromoter)).toBe("/gesperrt");
    expect(landingPathFor(null)).toBe("/kein-zugang");
  });
});

describe("areaForPath", () => {
  it("erkennt geschützte Pfade inklusive Unterpfade, sonst null", () => {
    expect(areaForPath("/admin")).toBe("admin");
    expect(areaForPath("/admin/promoter")).toBe("admin");
    expect(areaForPath("/promoter")).toBe("promoter");
    expect(areaForPath("/promoter/verkauf")).toBe("promoter");
    expect(areaForPath("/administrator")).toBeNull();
    expect(areaForPath("/login")).toBeNull();
    expect(areaForPath("/")).toBeNull();
  });
});
