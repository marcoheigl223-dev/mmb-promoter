import { describe, expect, it } from "vitest";

import {
  activeOverrideCents,
  depositAbovePriceError,
  parseOptionalEuro,
  planPricingWrites,
} from "../src/lib/admin/pricing";
import type { PricingRule } from "../src/lib/admin/types";

// E3.4 (F14) — reine Logik für die optionalen Felder „eigener Ticketpreis" /
// „eigene Anzahlung" im Termin-Formular (src/lib/admin/pricing.ts).

const NOW = Date.parse("2026-09-30T12:00:00Z");

function rule(
  validFrom: string,
  amount: number | null,
  kind: PricingRule["kind"] = "ticket_price",
): PricingRule {
  return {
    id: `${kind}-${validFrom}-${amount}`,
    kind,
    departure_id: "00000000-0000-4000-8000-000000000000",
    amount_cents: amount,
    valid_from: validFrom,
    created_at: validFrom,
    created_by: null,
  };
}

describe("parseOptionalEuro — leer = Standard", () => {
  it("leer/Leerzeichen → null (Standard gilt)", () => {
    expect(parseOptionalEuro("")).toEqual({ cents: null });
    expect(parseOptionalEuro("   ")).toEqual({ cents: null });
  });

  it.each([
    ["45", 4500],
    ["45,00", 4500],
    ["45.50", 4550],
    [" 0 ", 0],
  ])("%s → %i Cent", (input, cents) => {
    expect(parseOptionalEuro(input)).toEqual({ cents });
  });

  it("Unsinn → Fehlermeldung, kein null (sonst würde still der Standard gelten)", () => {
    for (const bad of ["abc", "-5", "10,555", "1e3"]) {
      const r = parseOptionalEuro(bad);
      expect("error" in r, bad).toBe(true);
    }
  });
});

describe("activeOverrideCents — jüngste Zeile mit Gültig-ab <= jetzt", () => {
  it("keine Zeilen → null", () => {
    expect(activeOverrideCents([], NOW)).toBeNull();
  });

  it("nur zukünftige Zeilen → null (Standard gilt noch)", () => {
    expect(activeOverrideCents([rule("2026-10-15T00:00:00Z", 5000)], NOW)).toBeNull();
  });

  it("jüngste gültige Zeile zählt, zukünftige wird übersprungen (Liste jüngste zuerst)", () => {
    const rules = [
      rule("2026-10-15T00:00:00Z", 5000),
      rule("2026-09-20T00:00:00Z", 4500),
      rule("2026-09-01T00:00:00Z", 4000),
    ];
    expect(activeOverrideCents(rules, NOW)).toBe(4500);
  });

  it("aktive Zeile mit NULL = „wieder Standard“ → null, ältere Beträge zählen nicht mehr", () => {
    const rules = [rule("2026-09-20T00:00:00Z", null), rule("2026-09-01T00:00:00Z", 4000)];
    expect(activeOverrideCents(rules, NOW)).toBeNull();
  });
});

describe("planPricingWrites — nur schreiben, was sich ändert", () => {
  const none = { ticket_price: null, deposit: null };

  it("beides leer, keine aktive Ausnahme → nichts", () => {
    expect(planPricingWrites(none, none)).toEqual([]);
  });

  it("Eingabe = aktive Ausnahme → nichts (kein Rauschen in der Historie)", () => {
    const same = { ticket_price: 4500, deposit: 2000 };
    expect(planPricingWrites(same, same)).toEqual([]);
  });

  it("neuer Wert ohne aktive Ausnahme → Zeile mit Betrag", () => {
    expect(planPricingWrites({ ticket_price: 4500, deposit: null }, none)).toEqual([
      { kind: "ticket_price", amount_cents: 4500 },
    ]);
  });

  it("geänderter Wert → Zeile mit neuem Betrag", () => {
    expect(
      planPricingWrites({ ticket_price: 4800, deposit: 2000 }, { ticket_price: 4500, deposit: 2000 }),
    ).toEqual([{ kind: "ticket_price", amount_cents: 4800 }]);
  });

  it("Feld geleert bei aktiver Ausnahme → Zeile mit NULL („wieder Standard“)", () => {
    expect(planPricingWrites(none, { ticket_price: 4500, deposit: null })).toEqual([
      { kind: "ticket_price", amount_cents: null },
    ]);
  });

  it("beide Arten gleichzeitig, Reihenfolge Ticketpreis vor Anzahlung", () => {
    expect(
      planPricingWrites({ ticket_price: null, deposit: 2500 }, { ticket_price: 4500, deposit: null }),
    ).toEqual([
      { kind: "ticket_price", amount_cents: null },
      { kind: "deposit", amount_cents: 2500 },
    ]);
  });
});

describe("depositAbovePriceError — Anzahlung darf den Preis nicht übersteigen", () => {
  const standard = { ticket_price: 4000, deposit: 3000 };

  it("nichts eingegeben, Standard plausibel → ok", () => {
    expect(depositAbovePriceError({ ticket_price: null, deposit: null }, standard)).toBeNull();
  });

  it("eigener Preis unter der Standard-Anzahlung → Fehler", () => {
    expect(depositAbovePriceError({ ticket_price: 2000, deposit: null }, standard)).toMatch(/Anzahlung/);
  });

  it("eigene Anzahlung über dem Standard-Preis → Fehler", () => {
    expect(depositAbovePriceError({ ticket_price: null, deposit: 5000 }, standard)).toMatch(/Anzahlung/);
  });

  it("Anzahlung = Preis (Vollzahlung) → ok", () => {
    expect(depositAbovePriceError({ ticket_price: 5000, deposit: 5000 }, standard)).toBeNull();
  });

  it("ein Wert unbekannt (kein Standard-Ticketpreis, F15) → keine Prüfung", () => {
    expect(
      depositAbovePriceError({ ticket_price: null, deposit: 9000 }, { ticket_price: null, deposit: 3000 }),
    ).toBeNull();
  });
});
