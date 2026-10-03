import { describe, expect, it } from "vitest";

import { fillDays, madridDayKey, shiftDayKey } from "../src/lib/promoter/dashboard";

// E5.5b — reine Helfer des Promoter-Dashboards: Kalendertag in Ortszeit
// Mallorca und 14-Tage-Fenster mit 0 aufgefüllt (Beträge rechnet die DB).

describe("Dashboard: Kalendertag Mallorca", () => {
  it("Sommer: 23:30Z am 02.10. ist in Mallorca schon der 03.10.", () => {
    expect(madridDayKey(new Date("2026-10-02T23:30:00Z"))).toBe("2026-10-03");
  });

  it("Sommer: 21:59Z ist noch derselbe Tag", () => {
    expect(madridDayKey(new Date("2026-10-02T21:59:00Z"))).toBe("2026-10-02");
  });

  it("Winter: 23:30Z am 15.01. ist in Mallorca der 16.01.", () => {
    expect(madridDayKey(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("Tage verschieben über Monats-, Jahres- und Umstellungsgrenzen", () => {
    expect(shiftDayKey("2026-10-03", -13)).toBe("2026-09-20");
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2026-10-24", 2)).toBe("2026-10-26");
    expect(shiftDayKey("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("Dashboard: Tage auffüllen", () => {
  it("14 Tage, älteste zuerst, heute zuletzt, fehlende Tage = 0", () => {
    const days = fillDays(
      [
        { sale_day: "2026-10-03", sales_count: 2, revenue_cents: 14980 },
        { sale_day: "2026-09-25", sales_count: 1, revenue_cents: 7490 },
      ],
      "2026-10-03",
      14,
    );
    expect(days).toHaveLength(14);
    expect(days[0].day).toBe("2026-09-20");
    expect(days[13]).toEqual({ day: "2026-10-03", sales_count: 2, revenue_cents: 14980 });
    expect(days.find((d) => d.day === "2026-09-25")).toEqual({ day: "2026-09-25", sales_count: 1, revenue_cents: 7490 });
    expect(days.filter((d) => d.sales_count === 0)).toHaveLength(12);
  });

  it("Zeilen außerhalb des Fensters werden ignoriert, Werte nicht verändert", () => {
    const days = fillDays(
      [
        { sale_day: "2026-09-19", sales_count: 5, revenue_cents: 1 },
        { sale_day: "2026-10-04", sales_count: 5, revenue_cents: 1 },
      ],
      "2026-10-03",
      14,
    );
    expect(days.every((d) => d.sales_count === 0 && d.revenue_cents === 0)).toBe(true);
  });

  it("ohne Verkäufe: alle Tage 0", () => {
    expect(fillDays([], "2026-10-03", 3)).toEqual([
      { day: "2026-10-01", sales_count: 0, revenue_cents: 0 },
      { day: "2026-10-02", sales_count: 0, revenue_cents: 0 },
      { day: "2026-10-03", sales_count: 0, revenue_cents: 0 },
    ]);
  });
});
