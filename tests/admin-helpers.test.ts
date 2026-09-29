import { describe, expect, it } from "vitest";

import { centsToInputValue, formatCents, parseEuroToCents } from "../src/lib/admin/money";
import { formatMadrid, isoToMadridLocal, madridLocalToIso } from "../src/lib/admin/time";

// E3.2 — reine Helfer des Admin-Bereichs: Zeit in Ortszeit Mallorca
// (Europe/Madrid, Sommer +2 / Winter +1) und Beträge in ganzen Cent.

describe("Zeit: datetime-local ⇄ UTC in Europe/Madrid", () => {
  it("Sommerzeit: 01.07.2026 10:00 Madrid = 08:00Z", () => {
    expect(madridLocalToIso("2026-07-01T10:00")).toBe("2026-07-01T08:00:00.000Z");
  });

  it("Winterzeit: 15.01.2026 10:00 Madrid = 09:00Z", () => {
    expect(madridLocalToIso("2026-01-15T10:00")).toBe("2026-01-15T09:00:00.000Z");
  });

  it("Umstellungstag: 25.10.2026 (Sommer → Winter) rechnet weiter richtig", () => {
    // 25.10.2026 03:00 ist bereits Winterzeit (+1) → 02:00Z
    expect(madridLocalToIso("2026-10-25T03:00")).toBe("2026-10-25T02:00:00.000Z");
    // 29.03.2026 03:00 ist bereits Sommerzeit (+2) → 01:00Z
    expect(madridLocalToIso("2026-03-29T03:00")).toBe("2026-03-29T01:00:00.000Z");
  });

  it("ungültige Eingaben → null", () => {
    expect(madridLocalToIso("")).toBeNull();
    expect(madridLocalToIso("morgen")).toBeNull();
    expect(madridLocalToIso("2026-02-31T10:00")).toBeNull();
  });

  it("Rückweg für das Formular und Anzeige", () => {
    expect(isoToMadridLocal("2026-07-01T08:00:00.000Z")).toBe("2026-07-01T10:00");
    expect(isoToMadridLocal(madridLocalToIso("2026-12-24T18:30")!)).toBe("2026-12-24T18:30");
    expect(formatMadrid("2026-07-01T08:00:00.000Z")).toMatch(/01\.07\.2026.*10:00/);
  });
});

describe("Geld: Euro-Eingabe ⇄ Cent", () => {
  it.each([
    ["10", 1000],
    ["10,5", 1050],
    ["10.50", 1050],
    [" 12,00 € ", 1200],
    ["0", 0],
  ])("%s → %i Cent", (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });

  it("Unsinn → null (keine Rundung, keine negativen Beträge)", () => {
    for (const bad of ["", "abc", "10,555", "-5", "1e3", "10,"]) {
      expect(parseEuroToCents(bad), bad).toBeNull();
    }
  });

  it("Anzeige und Formularwert", () => {
    expect(formatCents(1000)).toMatch(/10,00\s*€/);
    expect(centsToInputValue(1050)).toBe("10.50");
  });
});
