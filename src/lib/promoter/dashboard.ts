/**
 * Reine Hilfen für das Promoter-Dashboard (E5.5b). Keine Server-Abhängigkeiten
 * und relative Imports, damit Vitest sie ohne den Alias `@/` laden kann.
 * Beträge werden hier nicht gerechnet — nur Tage aufgefüllt.
 */

import { TOUR_TIME_ZONE } from "../admin/time";

/** Kalendertag in Ortszeit Mallorca als "YYYY-MM-DD". */
export function madridDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOUR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "YYYY-MM-DD" ± Tage (reine Kalenderrechnung, unabhängig von Sommerzeit). */
export function shiftDayKey(day: string, deltaDays: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export type DayPoint = {
  day: string;
  sales_count: number;
  revenue_cents: number;
};

/**
 * Die letzten `days` Kalendertage bis einschließlich `today`, älteste zuerst.
 * Tage ohne Verkauf fehlen in `sales_by_day` und werden mit 0 aufgefüllt;
 * Zeilen außerhalb des Fensters werden ignoriert.
 */
export function fillDays(
  rows: { sale_day: string; sales_count: number; revenue_cents: number }[],
  today: string,
  days: number,
): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.sale_day, r]));
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDayKey(today, -i);
    const r = byDay.get(day);
    out.push({ day, sales_count: r?.sales_count ?? 0, revenue_cents: r?.revenue_cents ?? 0 });
  }
  return out;
}
