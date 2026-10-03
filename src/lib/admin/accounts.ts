/**
 * Konto-Verwaltung (Teil 2): Eingaben prüfen, GoTrue-Fehler übersetzen.
 * Reine Funktionen ohne Server-Abhängigkeit — relative Imports, damit Vitest
 * sie direkt importieren kann (tests/accounts-input.test.ts).
 */

import type { UserRole } from "../auth/access";

/** Rollen, die Gabo anlegen und pflegen darf (Policy 0013: nur diese beiden). */
export const MANAGED_ROLES = ["promoter", "guide"] as const satisfies readonly UserRole[];
export type ManagedRole = (typeof MANAGED_ROLES)[number];

/** config.toml `minimum_password_length = 12`; bcrypt nutzt höchstens 72 Byte. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 72;

export function isManagedRole(value: string): value is ManagedRole {
  return (MANAGED_ROLES as readonly string[]).includes(value);
}

export function parseDisplayName(raw: string): { value: string } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: "Bitte einen Namen eingeben." };
  if (value.length > 200) return { error: "Name ist zu lang (max. 200 Zeichen)." };
  return { value };
}

export function parseEmail(raw: string): { value: string } | { error: string } {
  const value = raw.trim().toLowerCase();
  if (!value) return { error: "Bitte eine E-Mail-Adresse eingeben." };
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { error: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  return { value };
}

export function parsePassword(raw: string): { value: string } | { error: string } {
  // Bewusst nicht trimmen: Leerzeichen gehören zum Passwort.
  if (raw.length < PASSWORD_MIN) {
    return { error: `Das Passwort muss mindestens ${PASSWORD_MIN} Zeichen haben.` };
  }
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX) {
    return { error: `Das Passwort ist zu lang (max. ${PASSWORD_MAX} Byte).` };
  }
  return { value: raw };
}

/** GoTrue-Admin-Fehler → Meldung für Gabo. */
export function authErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "email_exists" || error.code === "user_already_exists") {
    return "Für diese E-Mail-Adresse gibt es schon ein Konto.";
  }
  if (error.code === "weak_password") {
    return `Das Passwort ist zu schwach (mindestens ${PASSWORD_MIN} Zeichen).`;
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed") {
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  }
  if (error.code === "user_not_found") return "Konto nicht gefunden.";
  return `Konto-Dienst meldet einen Fehler: ${error.message}`;
}
