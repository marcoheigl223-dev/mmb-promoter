/**
 * Zeit-Helfer für den Admin-Bereich. Alle Termine werden in der Zeitzone der
 * Touren (Europe/Madrid) eingegeben und angezeigt — unabhängig davon, wo der
 * Server läuft. Gespeichert wird immer UTC (timestamptz).
 *
 * Reine Funktionen ohne Server-Abhängigkeiten, damit sie in Vitest laufen.
 */

export const TOUR_TIME_ZONE = "Europe/Madrid";

/** Offset (Minuten) von UTC in der Tour-Zeitzone zum Zeitpunkt `ms`. */
function offsetMinutesAt(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOUR_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - ms) / 60_000);
}

/**
 * Wert eines `<input type="datetime-local">` ("YYYY-MM-DDTHH:MM") als
 * Madrid-Ortszeit interpretieren → ISO-String in UTC. null bei ungültiger Eingabe.
 * Zwei Iterationen, damit der Offset auch um die Sommerzeit-Umstellung stimmt.
 */
export function madridLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naive)) return null;
  let instant = naive;
  for (let i = 0; i < 2; i++) {
    instant = naive - offsetMinutesAt(instant) * 60_000;
  }
  const date = new Date(instant);
  // Plausibilität: Monat/Tag dürfen nicht "übergelaufen" sein (z. B. 31.02.)
  const check = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOUR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (check !== `${m[1]}-${m[2]}-${m[3]}`) return null;
  return date.toISOString();
}

/** ISO/UTC → Wert für `<input type="datetime-local">` in Madrid-Ortszeit. */
export function isoToMadridLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOUR_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Anzeige "29.09.2026, 14:30" in Madrid-Ortszeit. */
export function formatMadrid(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TOUR_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
