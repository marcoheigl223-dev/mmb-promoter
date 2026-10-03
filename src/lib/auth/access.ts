/**
 * Reine Zugriffsentscheidung — keine I/O, damit sie in Vitest ohne Next.js
 * und ohne Datenbank testbar ist (tests/access-guard.test.ts).
 *
 * Die Rolle kommt aus der Tabelle `profiles` (serverseitig gelesen, RLS-
 * geschützt), nie aus dem JWT. Ein Token beweist nur "eingeloggt"; ob und
 * wohin der Nutzer darf, entscheidet ausschließlich die Profil-Zeile.
 */

/** Teil 2 (0012/0013): dritte Rolle "guide" — verkauft wie ein Promoter. */
export type UserRole = "network_operator" | "promoter" | "guide";

/** Rollen-Bezeichnung für die Oberfläche. */
export const ROLE_LABELS: Record<UserRole, string> = {
  network_operator: "Gabo (network_operator)",
  promoter: "Promoter",
  guide: "Guide",
};

export type Profile = {
  id: string;
  role: UserRole;
  active: boolean;
  display_name: string;
};

/**
 * Geschützte Bereiche und die Rollen, die hinein dürfen. Positivliste: eine
 * neue Rolle kommt nirgends hinein, solange sie hier nicht eingetragen ist.
 * Der Guide arbeitet im Promoter-Bereich (verkaufen, eigenes Dashboard) —
 * /admin bleibt allein dem network_operator (Teil 2, Marco 03.10.2026).
 */
export const AREAS = {
  admin: { path: "/admin", roles: ["network_operator"] },
  promoter: { path: "/promoter", roles: ["promoter", "guide"] },
} as const satisfies Record<
  string,
  { path: string; roles: readonly UserRole[] }
>;

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
  if (!(AREAS[area].roles as readonly UserRole[]).includes(profile.role)) {
    return { kind: "redirect", to: NO_ACCESS_PATH, reason: "wrong_role" };
  }
  return { kind: "allow", profile };
}

/** Startseite nach erfolgreichem Login, abhängig von der Rolle aus der DB. */
export function landingPathFor(profile: Profile | null): string {
  if (!profile) return NO_ACCESS_PATH;
  if (!profile.active) return BLOCKED_PATH;
  if (profile.role === "network_operator") return AREAS.admin.path;
  if (profile.role === "promoter" || profile.role === "guide") {
    return AREAS.promoter.path;
  }
  return NO_ACCESS_PATH; // unbekannte Rolle: nirgends hinein
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
