/**
 * Reine Zugriffsentscheidung — keine I/O, damit sie in Vitest ohne Next.js
 * und ohne Datenbank testbar ist (tests/access-guard.test.ts).
 *
 * Die Rolle kommt aus der Tabelle `profiles` (serverseitig gelesen, RLS-
 * geschützt), nie aus dem JWT. Ein Token beweist nur "eingeloggt"; ob und
 * wohin der Nutzer darf, entscheidet ausschließlich die Profil-Zeile.
 */

export type UserRole = "network_operator" | "promoter";

export type Profile = {
  id: string;
  role: UserRole;
  active: boolean;
  display_name: string;
};

/** Geschützte Bereiche und die Rolle, die hinein darf. */
export const AREAS = {
  admin: { path: "/admin", role: "network_operator" },
  promoter: { path: "/promoter", role: "promoter" },
} as const satisfies Record<string, { path: string; role: UserRole }>;

export type Area = keyof typeof AREAS;

export const LOGIN_PATH = "/login";
/** Konto existiert, ist aber von Gabo deaktiviert. */
export const BLOCKED_PATH = "/gesperrt";
/** Eingeloggt, aber ohne Profil oder mit falscher Rolle für den Bereich. */
export const NO_ACCESS_PATH = "/kein-zugang";

export type AccessDecision =
  | { kind: "allow"; profile: Profile }
  | { kind: "redirect"; to: string; reason: AccessDenialReason };

export type AccessDenialReason =
  | "not_logged_in"
  | "no_profile"
  | "inactive"
  | "wrong_role";

export function decideAccess(input: {
  area: Area;
  /** Auth-User-ID aus der Session (null = nicht eingeloggt). */
  userId: string | null;
  /** Profil-Zeile aus der DB (null = keine Zeile für diesen Nutzer). */
  profile: Profile | null;
}): AccessDecision {
  const { area, userId, profile } = input;

  if (!userId) {
    return { kind: "redirect", to: LOGIN_PATH, reason: "not_logged_in" };
  }
  if (!profile || profile.id !== userId) {
    return { kind: "redirect", to: NO_ACCESS_PATH, reason: "no_profile" };
  }
  if (!profile.active) {
    return { kind: "redirect", to: BLOCKED_PATH, reason: "inactive" };
  }
  if (profile.role !== AREAS[area].role) {
    return { kind: "redirect", to: NO_ACCESS_PATH, reason: "wrong_role" };
  }
  return { kind: "allow", profile };
}

/** Startseite nach erfolgreichem Login, abhängig von der Rolle aus der DB. */
export function landingPathFor(profile: Profile | null): string {
  if (!profile) return NO_ACCESS_PATH;
  if (!profile.active) return BLOCKED_PATH;
  return profile.role === "network_operator"
    ? AREAS.admin.path
    : AREAS.promoter.path;
}

/** Welcher geschützte Bereich gehört zu einem Pfad? (für den Proxy) */
export function areaForPath(pathname: string): Area | null {
  for (const [area, { path }] of Object.entries(AREAS) as [
    Area,
    (typeof AREAS)[Area],
  ][]) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return area;
  }
  return null;
}
