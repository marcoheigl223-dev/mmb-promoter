import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "./db";

// Der Beweis für das "niemals überbuchen"-Fundament (Hard Rule 4, RISKS Nr. 2):
// 8 gleichzeitige Reservierungen auf 1 freien Kontingent-Platz → genau 1 Erfolg,
// 7× SOLD_OUT, seats_booked_total bleibt 1. Dazu das Gegenstück (Freigabe).
//
// Wichtig: connect(8) — jede der 8 Reservierungen bekommt eine eigene
// Verbindung. Mit einer einzigen Verbindung würde der Client die Aufrufe
// nacheinander schicken und der Test bewiese nichts über Nebenläufigkeit.

const PARALLEL = 8;
const TEST_PREFIX = "TEST-overbooking-";

type Booking = { id: string; seats: number; status: string };

describe("Überbuchungssperre der Handover-Funktion (Kontingent = capacity_total)", () => {
  const sql = connect(PARALLEL);
  const departureIds: string[] = [];

  async function createDeparture(capacity: number) {
    const [row] = await sql<{ id: string }[]>`
      insert into tour_departures (title, starts_at, capacity_total)
      values (${TEST_PREFIX + capacity}, now() + interval '7 days', ${capacity})
      returning id
    `;
    departureIds.push(row.id);
    return row.id;
  }

  function reserve(departureId: string, seats = 1) {
    return sql<Booking[]>`
      select id, seats, status::text as status
      from reserve_departure_seats(
        ${departureId}, ${seats}, ${seats * 6000}, ${seats * 6000},
        'Test Kunde', 'test@example.invalid', null,
        null, false, false, null
      )
    `;
  }

  async function bookedTotal(departureId: string) {
    const [row] = await sql<{ n: number }[]>`
      select seats_booked_total as n from tour_departures where id = ${departureId}
    `;
    return row.n;
  }

  beforeAll(async () => {
    // Alle 8 Verbindungen vorab öffnen, damit die Reservierungen wirklich
    // gleichzeitig beim Server ankommen und nicht auf Verbindungsaufbau warten.
    await Promise.all(Array.from({ length: PARALLEL }, () => sql`select 1`));
  });

  afterAll(async () => {
    if (departureIds.length > 0) {
      await sql`delete from bookings where departure_id in ${sql(departureIds)}`;
      await sql`delete from tour_departures where id in ${sql(departureIds)}`;
    }
    await sql.end();
  });

  it(`Kontingent 1, ${PARALLEL} parallele Reservierungen → genau 1 Erfolg, ${PARALLEL - 1}× SOLD_OUT`, async () => {
    const dep = await createDeparture(1);

    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, () => reserve(dep)),
    );

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(PARALLEL - 1);
    for (const f of failed) {
      expect(String(f.reason?.message ?? f.reason)).toContain("SOLD_OUT");
    }

    expect(await bookedTotal(dep)).toBe(1);
    const [count] = await sql<{ n: number }[]>`
      select count(*)::int as n from bookings where departure_id = ${dep}
    `;
    expect(count.n).toBe(1);
  });

  it(`Kontingent 5, ${PARALLEL} parallele Reservierungen → genau 5 Erfolge, Zähler exakt 5`, async () => {
    const dep = await createDeparture(5);
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, () => reserve(dep)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(PARALLEL - 5);
    expect(await bookedTotal(dep)).toBe(5);
  });

  it("mehr Sitze als Kontingent in einem Aufruf → SOLD_OUT, Zähler unverändert", async () => {
    const dep = await createDeparture(1);
    await expect(reserve(dep, 2)).rejects.toThrow(/SOLD_OUT/);
    expect(await bookedTotal(dep)).toBe(0);
  });

  it("Kontingent 0 → SOLD_OUT (kein Verkauf ohne von Gabo eingetragenes Kontingent)", async () => {
    const dep = await createDeparture(0);
    await expect(reserve(dep)).rejects.toThrow(/SOLD_OUT/);
    expect(await bookedTotal(dep)).toBe(0);
  });

  it("geschlossener Termin → SOLD_OUT, auch wenn Kontingent frei ist", async () => {
    const dep = await createDeparture(3);
    await sql`update tour_departures set status = 'closed' where id = ${dep}`;
    await expect(reserve(dep)).rejects.toThrow(/SOLD_OUT/);
    expect(await bookedTotal(dep)).toBe(0);
  });

  it("Freigabe gibt den Platz zurück, ist idempotent, und der Platz ist wieder buchbar", async () => {
    const dep = await createDeparture(1);
    const [booking] = await reserve(dep);
    expect(booking.status).toBe("pending");
    expect(await bookedTotal(dep)).toBe(1);

    const [released] = await sql<Booking[]>`
      select id, seats, status::text as status from release_departure_seats(${booking.id})
    `;
    expect(released.status).toBe("cancelled");
    expect(await bookedTotal(dep)).toBe(0);

    // zweite Freigabe derselben Buchung darf den Zähler nicht ins Minus ziehen
    const [again] = await sql<Booking[]>`
      select id, seats, status::text as status from release_departure_seats(${booking.id})
    `;
    expect(again.status).toBe("cancelled");
    expect(await bookedTotal(dep)).toBe(0);

    // der freigegebene Platz ist wieder verkaufbar — und nur einmal
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, () => reserve(dep)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await bookedTotal(dep)).toBe(1);
  });

  it("unbekannte Buchung bei Freigabe → BOOKING_NOT_FOUND", async () => {
    await expect(
      sql`select * from release_departure_seats(${"00000000-0000-0000-0000-000000000000"})`,
    ).rejects.toThrow(/BOOKING_NOT_FOUND/);
  });
});
