import { describe, expect, it } from "vitest";

import { parseSaleAmountFields, parseSaleFields } from "../src/lib/promoter/sale";

// E5.4 — Vorprüfung des Verkaufsformulars (reine Logik). Verbindlich prüft die
// DB (tests/promoter-sale.test.ts); hier nur, dass die App dieselben Grenzen
// früh meldet und richtig an die Funktionen weitergibt.

const DEP = "00000000-0000-4000-8000-000000000000";
const base = {
  departure_id: DEP,
  seats: "3",
  payment_type: "deposit",
  deposit_basis: "paying_persons",
  custom_deposit: "",
  customer_name: "  Max Muster ",
  customer_phone: " +34 600 123 456 ",
  customer_email: "",
};

function ok(fields: Record<string, string>) {
  const r = parseSaleFields(fields);
  if ("error" in r) throw new Error(r.error);
  return r.values;
}
function err(fields: Record<string, string>) {
  const r = parseSaleFields(fields);
  if (!("error" in r)) throw new Error("Fehler erwartet");
  return r.error;
}

describe("parseSaleFields", () => {
  it("Standardfall: Anzahlung, zahlende Köpfe, Kundendaten getrimmt, E-Mail leer", () => {
    expect(ok(base)).toEqual({
      departure_id: DEP,
      seats: 3,
      payment_type: "deposit",
      deposit_basis: "paying_persons",
      custom_deposit_cents: null,
      customer_name: "Max Muster",
      customer_phone: "+34 600 123 456",
      customer_email: "",
    });
  });

  it("Vollzahler: Basis egal, kein freier Betrag", () => {
    const v = ok({ ...base, payment_type: "full", deposit_basis: "", custom_deposit: "999" });
    expect(v.payment_type).toBe("full");
    expect(v.deposit_basis).toBe("paying_persons");
    expect(v.custom_deposit_cents).toBeNull();
  });

  it("freier Betrag: Euro mit Komma → Cent; fehlt/0/Unsinn → Fehler", () => {
    expect(ok({ ...base, deposit_basis: "custom_total", custom_deposit: "50,50" }).custom_deposit_cents).toBe(5050);
    expect(err({ ...base, deposit_basis: "custom_total", custom_deposit: "" })).toMatch(/Anzahlungsbetrag/);
    expect(err({ ...base, deposit_basis: "custom_total", custom_deposit: "0" })).toMatch(/größer als 0/);
    expect(err({ ...base, deposit_basis: "custom_total", custom_deposit: "-5" })).toMatch(/Euro-Betrag/);
  });

  it("Personen: ganze Zahl 1–200", () => {
    expect(err({ ...base, seats: "0" })).toMatch(/mindestens 1/);
    expect(err({ ...base, seats: "2.5" })).toMatch(/ganze Zahl/);
    expect(err({ ...base, seats: "" })).toMatch(/ganze Zahl/);
    expect(err({ ...base, seats: "201" })).toMatch(/Höchstens 200/);
    expect(ok({ ...base, seats: "22" }).seats).toBe(22);
  });

  it("Zahlart/Basis nur aus der Liste", () => {
    expect(err({ ...base, payment_type: "cash" })).toMatch(/Vollzahler oder Anzahlung/);
    expect(err({ ...base, deposit_basis: "half" })).toMatch(/Anzahlungsart/);
  });

  it("Kunde: Name Pflicht, Handy ≥ 6 Ziffern und ≤ 40 Zeichen, E-Mail optional aber gültig (F8)", () => {
    expect(err({ ...base, customer_name: "   " })).toMatch(/Namen/);
    expect(err({ ...base, customer_phone: "12345" })).toMatch(/Handynummer/);
    expect(err({ ...base, customer_phone: "1".repeat(41) })).toMatch(/Handynummer/);
    expect(err({ ...base, customer_email: "kein-at" })).toMatch(/E-Mail/);
    expect(ok({ ...base, customer_email: " kunde@example.com " }).customer_email).toBe("kunde@example.com");
  });

  it("Kunde auch bei Vollzahler Pflicht (F8, Marco 03.10.2026): Name + Handy, E-Mail optional", () => {
    const full = { ...base, payment_type: "full", deposit_basis: "" };
    expect(err({ ...full, customer_name: "" })).toMatch(/Namen/);
    expect(err({ ...full, customer_name: "   " })).toMatch(/Namen/);
    expect(err({ ...full, customer_phone: "" })).toMatch(/Handynummer/);
    expect(err({ ...full, customer_phone: "12345" })).toMatch(/Handynummer/);
    expect(ok({ ...full, customer_email: "" })).toMatchObject({
      payment_type: "full",
      customer_name: "Max Muster",
      customer_phone: "+34 600 123 456",
      customer_email: "",
    });
  });
});

describe("parseSaleAmountFields (Live-Übersicht)", () => {
  const amounts = {
    departure_id: DEP,
    seats: "11",
    payment_type: "deposit",
    deposit_basis: "all_persons",
    custom_deposit: "",
  };

  it("braucht keine Kundendaten und liefert nur die Betrags-Eingaben", () => {
    const r = parseSaleAmountFields(amounts);
    expect(r).toEqual({
      values: {
        departure_id: DEP,
        seats: 11,
        payment_type: "deposit",
        deposit_basis: "all_persons",
        custom_deposit_cents: null,
      },
    });
  });

  it("gleiche Grenzen wie das ganze Formular", () => {
    expect(parseSaleAmountFields({ ...amounts, seats: "0" })).toEqual({ error: "Bitte mindestens 1 Person angeben." });
    expect(parseSaleAmountFields({ ...amounts, seats: "201" })).toHaveProperty("error");
    expect(parseSaleAmountFields({ ...amounts, deposit_basis: "custom_total" })).toEqual({
      error: "Bitte den Anzahlungsbetrag eingeben.",
    });
    expect(parseSaleAmountFields({ ...amounts, deposit_basis: "custom_total", custom_deposit: "50" })).toMatchObject({
      values: { custom_deposit_cents: 5000 },
    });
    // Vollzahler: freier Betrag wird ignoriert
    expect(
      parseSaleAmountFields({ ...amounts, payment_type: "full", deposit_basis: "custom_total", custom_deposit: "x" }),
    ).toMatchObject({ values: { payment_type: "full", custom_deposit_cents: null } });
  });

  it("parseSaleFields prüft zuerst die Beträge, dann den Kunden", () => {
    expect(err({ ...base, seats: "0", customer_name: "" })).toMatch(/mindestens 1 Person/);
  });
});
