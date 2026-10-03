import { describe, expect, it } from "vitest";

import {
  MANAGED_ROLES,
  authErrorMessage,
  isManagedRole,
  parseDisplayName,
  parseEmail,
  parsePassword,
} from "../src/lib/admin/accounts";

// Teil 2 — Konto-Verwaltung: Eingabeprüfung und Fehlertexte (reine Logik, ohne DB).

describe("Rollen, die Gabo anlegt", () => {
  it("nur promoter und guide — nie network_operator", () => {
    expect([...MANAGED_ROLES]).toEqual(["promoter", "guide"]);
    expect(isManagedRole("promoter")).toBe(true);
    expect(isManagedRole("guide")).toBe(true);
    expect(isManagedRole("network_operator")).toBe(false);
    expect(isManagedRole("")).toBe(false);
    expect(isManagedRole("Guide")).toBe(false);
  });
});

describe("parseDisplayName", () => {
  it("trimmt, verlangt 1–200 Zeichen", () => {
    expect(parseDisplayName("  Ana  ")).toEqual({ value: "Ana" });
    expect(parseDisplayName("   ")).toHaveProperty("error");
    expect(parseDisplayName("x".repeat(200))).toEqual({ value: "x".repeat(200) });
    expect(parseDisplayName("x".repeat(201))).toHaveProperty("error");
  });
});

describe("parseEmail", () => {
  it("trimmt und schreibt klein", () => {
    expect(parseEmail("  Guide2@MMB-Promoter.Test ")).toEqual({ value: "guide2@mmb-promoter.test" });
  });
  it("lehnt Leeres und Ungültiges ab", () => {
    for (const bad of ["", "guide", "guide@", "@x.de", "a b@x.de", "a@x", `${"a".repeat(250)}@x.de`]) {
      expect(parseEmail(bad)).toHaveProperty("error");
    }
  });
});

describe("parsePassword", () => {
  it("mindestens 12 Zeichen (wie config.toml), nicht getrimmt", () => {
    expect(parsePassword("a".repeat(11))).toHaveProperty("error");
    expect(parsePassword("a".repeat(12))).toEqual({ value: "a".repeat(12) });
    expect(parsePassword(" abcdefghijk")).toEqual({ value: " abcdefghijk" });
  });
  it("höchstens 72 Byte (bcrypt) — Umlaute zählen doppelt", () => {
    expect(parsePassword("a".repeat(72))).toHaveProperty("value");
    expect(parsePassword("a".repeat(73))).toHaveProperty("error");
    expect(parsePassword("ä".repeat(36))).toHaveProperty("value");
    expect(parsePassword("ä".repeat(37))).toHaveProperty("error");
  });
});

describe("authErrorMessage", () => {
  it("übersetzt die GoTrue-Codes", () => {
    expect(authErrorMessage({ code: "email_exists", message: "" })).toBe(
      "Für diese E-Mail-Adresse gibt es schon ein Konto.",
    );
    expect(authErrorMessage({ code: "user_already_exists", message: "" })).toBe(
      "Für diese E-Mail-Adresse gibt es schon ein Konto.",
    );
    expect(authErrorMessage({ code: "weak_password", message: "" })).toMatch(/mindestens 12/);
    expect(authErrorMessage({ code: "email_address_invalid", message: "" })).toMatch(/gültige E-Mail/);
    expect(authErrorMessage({ code: "user_not_found", message: "" })).toBe("Konto nicht gefunden.");
    expect(authErrorMessage({ message: "boom" })).toBe("Konto-Dienst meldet einen Fehler: boom");
  });
});
