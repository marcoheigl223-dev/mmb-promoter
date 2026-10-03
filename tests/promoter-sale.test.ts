import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E5.4 — Migration 0010: Promoter-Verkauf (Berechnung, Reservierung, Zahlungsstatus).
//   * Hard Rule 4: reserve_promoter_seats() enthält das atomare UPDATE der
//     Handover-Funktion WÖRTLICH; 8 parallele Verkäufe auf 1 freien Platz →
//     genau 1 Erfolg, 7× SOLD_OUT (eigener Test, neben tests/overbooking.test.ts)
//   * Beträge: 3 × 30 € Anzahlung, 10+1 pro vollem Block (F18), drei
//     Anzahlungsbasen, freier Betrag ≥ Gesamt abgelehnt (F16), Vollzahlung
//     startet „voll bezahlt" (F24), Buchung confirmed (F22), E-Mail optional (F8)
//   * Snapshots zum Verkaufszeitpunkt, Audit-Zeile „sold"
//   * Idempotenz (RISKS Nr. 11): gleicher Schlüssel → dieselbe Buchung, auch parallel
//   * Rollen: nur aktiver Promoter verkauft; Zahlungsstatus Promoter eigene,
//     Gabo alle, jede Änderung = Audit-Zeile
// Aufrufe laufen als Supabase-Rolle `authenticated` mit JWT-Claim `sub`
// (wie tests/bookings-rls.test.ts). Testdaten mit Präfix TEST-e54, Aufräumen in afterAll.

const OPERATOR = "11111111-1111-4111-8111-111111111111";
const PROMOTER = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "33333333-3333-4333-8333-333333333333";

const PARALLEL = 8;
const PRICE = 4000; // 40 € Ticket (Termin-Ausnahme, unabhängig vom Standard)
const DEPOSIT = 3000; // 30 € Anzahlung pro Person
const COMMISSION = 1000; // 10 € Provision pro Ticket

const HANDOVER = resolve(process.cwd(), "docs/handover/reserve-function-final.sql");
const RESERVE_SIG =
  "public.reserve_promoter_seats(uuid,integer,payment_type,deposit_basis,integer,text,text,text,uuid,integer,integer)";

const sql = connect(PARALLEL);
const departureIds: string[] = [];

type Row = Record<string, unknown>;
type Tx = typeof sql;

/** Eine Transaktion als `authenticated` mit `sub` (oder `anon`, wenn null). */
function asUser<T>(userId: string | null, query: (tx: Tx) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    if (userId) {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    } else {
      await tx`set local role anon`;
    }
    return query(tx as unknown as Tx);
  }) as Promise<T>;
}

async function createDeparture(capacity: number, withPrice = true): Promise<string> {
  const [d] = await sql`
    insert into tour_departures (title, starts_at, capacity_total, status)
    values (${"TEST-e54-" + capacity}, now() + interval '10 days', ${capacity}, 'open')
    returning id
  `;
  const id = d.id as string;
  departureIds.push(id);
  if (withPrice) {
    await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('ticket_price', ${id}, ${PRICE}, ${OPERATOR})`;
  }
  await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('deposit', ${id}, ${DEPOSIT}, ${OPERATOR})`;
  await sql`insert into commission_rules (departure_id, commission_cents, created_by) values (${id}, ${COMMISSION}, ${OPERATOR})`;
  return id;
}

type SaleInput = {
  seats?: number;
  paymentType?: "full" | "deposit";
  basis?: "paying_persons" | "all_persons" | "custom_total" | null;
  custom?: number | null;
  name?: string;
  phone?: string;
  email?: string | null;
  key?: string;
  expectedTotal?: number | null;
  expectedPaid?: number | null;
};

function reserveAs(userId: string | null, departureId: string, input: SaleInput = {}): Promise<string> {
  const s = {
    seats: 3,
    paymentType: "deposit",
    basis: "paying_persons",
    custom: null,
    name: "TEST-e54 Kunde",
    phone: "+00 000 000 054",
    email: null,
    key: crypto.randomUUID(),
    expectedTotal: null,
    expectedPaid: null,
    ...input,
  };
  return asUser(userId, async (tx) => {
    const [r] = await tx`
      select reserve_promoter_seats(
        ${departureId}::uuid, ${s.seats}::int, ${s.paymentType}::payment_type,
        ${s.basis}::deposit_basis, ${s.custom}::int,
        ${s.name}, ${s.phone}, ${s.email},
        ${s.key}::uuid, ${s.expectedTotal}::int, ${s.expectedPaid}::int
      ) as id
    `;
    return r.id as string;
  });
}

function setStatusAs(userId: string | null, bookingId: string, status: string) {
  return asUser(userId, (tx) => tx`select set_booking_payment_status(${bookingId}::uuid, ${status}::payment_status) as s`);
}

async function booking(id: string): Promise<Row> {
  const [b] = await sql`
    select channel::text, status::text, payment_type::text, payment_status::text, deposit_basis::text,
           seats, paid_seats, free_persons, total_amount_cents, deposit_total_cents, amount_paid_cents,
           amount_due_cents, commission_total_cents, ticket_price_cents_snapshot, deposit_amount_cents_snapshot,
           commission_per_ticket_cents_snapshot, group_threshold_snapshot, group_free_snapshot,
           customer_name, customer_phone, customer_email, promoter_id, sold_at is not null as sold
    from bookings where id = ${id}
  `;
  return b;
}

async function bookedTotal(departureId: string): Promise<number> {
  const [r] = await sql`select seats_booked_total as n from tour_departures where id = ${departureId}`;
  return r.n as number;
}

async function auditRows(bookingId: string) {
  return sql`
    select action::text, actor_id, actor_role::text, old_values, new_values
    from booking_audit_log where booking_id = ${bookingId} order by id
  `;
}

beforeAll(async () => {
  // Alle Verbindungen vorab öffnen, damit die parallelen Aufrufe gleichzeitig ankommen.
  await Promise.all(Array.from({ length: PARALLEL }, () => sql`select 1`));
});

afterAll(async () => {
  if (departureIds.length > 0) {
    await sql`delete from bookings where departure_id in ${sql(departureIds)}`; // Audit/Nachrichten: on delete cascade
    await sql`delete from pricing_rules where departure_id in ${sql(departureIds)}`;
    await sql`delete from commission_rules where departure_id in ${sql(departureIds)}`;
    await sql`delete from tour_departures where id in ${sql(departureIds)}`;
  }
  await sql.end();
});

describe("Hard Rule 4: atomares UPDATE wörtlich + Überbuchungssperre", () => {
  it("reserve_promoter_seats() enthält den UPDATE-Block der Handover-Datei wörtlich", async () => {
    const lines = readFileSync(HANDOVER, "utf8").replace(/\r\n/g, "\n").split("\n");
    const start = lines.findIndex((l) => l === "  update tour_departures");
    const end = lines.findIndex((l, i) => i > start && l === "  end if;");
    expect(start).toBeGreaterThan(-1);
    const block = lines.slice(start, end + 1).join("\n");
    expect(block).toContain("and seats_booked_total + p_seats <= capacity_total");
    expect(block).toContain("raise exception 'SOLD_OUT'");

    const [row] = await sql`select pg_get_functiondef(${RESERVE_SIG}::regprocedure) as def`;
    const def = String(row.def).replace(/\r\n/g, "\n");
    expect(def).toContain(block);
    // genau ein UPDATE auf tour_departures, kein SELECT … FOR UPDATE davor
    expect(def.match(/update tour_departures/g)).toHaveLength(1);
    expect(def).not.toMatch(/for update/i);
  });

  it(`Kontingent 1, ${PARALLEL} parallele Promoter-Verkäufe → genau 1 Erfolg, ${PARALLEL - 1}× SOLD_OUT`, async () => {
    const dep = await createDeparture(1);
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, () => reserveAs(PROMOTER, dep, { seats: 1 })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(PARALLEL - 1);
    for (const f of failed) expect(String(f.reason?.message ?? f.reason)).toContain("SOLD_OUT");
    expect(await bookedTotal(dep)).toBe(1);
    const [c] = await sql`select count(*)::int as n from bookings where departure_id = ${dep}`;
    expect(c.n).toBe(1);
  });

  it("mehr Personen als frei → SOLD_OUT, keine Buchung; geschlossener Termin → SOLD_OUT", async () => {
    const dep = await createDeparture(2);
    await expect(reserveAs(PROMOTER, dep, { seats: 3 })).rejects.toThrow(/SOLD_OUT/);
    expect(await bookedTotal(dep)).toBe(0);
    await sql`update tour_departures set status = 'closed' where id = ${dep}`;
    await expect(reserveAs(PROMOTER, dep, { seats: 1 })).rejects.toThrow(/SOLD_OUT/);
    const [c] = await sql`select count(*)::int as n from bookings where departure_id = ${dep}`;
    expect(c.n).toBe(0);
  });
});

describe("Rechte", () => {
  it("anon darf keine der Funktionen ausführen; authenticated Quote/Verkauf/Status; die Rechenfunktion nur intern", async () => {
    const rows = await sql`
      select p.proname as name,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as auth
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('promoter_sale_amounts', 'quote_promoter_sale', 'reserve_promoter_seats', 'set_booking_payment_status')
      order by p.proname
    `;
    expect(rows).toEqual([
      { name: "promoter_sale_amounts", anon: false, auth: false },
      { name: "quote_promoter_sale", anon: false, auth: true },
      { name: "reserve_promoter_seats", anon: false, auth: true },
      { name: "set_booking_payment_status", anon: false, auth: true },
    ]);
  });

  it("nur ein aktiver Promoter verkauft: Gabo, deaktiviert → NOT_ALLOWED; anon → permission denied", async () => {
    const dep = await createDeparture(5);
    await expect(reserveAs(OPERATOR, dep)).rejects.toThrow(/NOT_ALLOWED/);
    await expect(reserveAs(INACTIVE, dep)).rejects.toThrow(/NOT_ALLOWED/);
    await expect(reserveAs(null, dep)).rejects.toThrow(/permission denied/);
    expect(await bookedTotal(dep)).toBe(0);
  });

  it("Quote: aktive Profile ja, deaktiviert NOT_ALLOWED, unbekannter Termin DEPARTURE_NOT_FOUND", async () => {
    const dep = await createDeparture(5);
    const q = (user: string, d: string) =>
      asUser(user, (tx) => tx`select * from quote_promoter_sale(${d}::uuid, 3, 'deposit')`);
    const [r] = await q(PROMOTER, dep);
    expect(r.total_amount_cents).toBe(3 * PRICE);
    await expect(q(OPERATOR, dep)).resolves.toHaveLength(1);
    await expect(q(INACTIVE, dep)).rejects.toThrow(/NOT_ALLOWED/);
    await expect(q(PROMOTER, crypto.randomUUID())).rejects.toThrow(/DEPARTURE_NOT_FOUND/);
  });
});

describe("Berechnung (promoter_sale_amounts, Regel 11/1 fest vorgegeben)", () => {
  async function amounts(seats: number, type: string, basis: string | null, custom: number | null = null, price: number | null = PRICE) {
    const [r] = await sql`
      select * from promoter_sale_amounts(${seats}::int, ${type}::payment_type, ${basis}::deposit_basis, ${custom}::int,
                                          ${price}::int, ${DEPOSIT}, ${COMMISSION}, 11, 1)
    `;
    return {
      paid: r.paid_seats,
      free: r.free_persons,
      total: r.total_amount_cents,
      deposit: r.deposit_total_cents,
      collected: r.amount_paid_cents,
      commission: r.commission_total_cents,
      status: r.payment_status,
      basis: r.deposit_basis,
    };
  }

  it("3 Personen, Anzahlung → 3 × 30 € = 90 €, Rest 30 €, Provision 3 × 10 €", async () => {
    expect(await amounts(3, "deposit", "paying_persons")).toEqual({
      paid: 3, free: 0, total: 12000, deposit: 9000, collected: 9000, commission: 3000, status: "deposit_received", basis: "paying_persons",
    });
  });

  it("10+1 pro vollem Block (F18): 10 → 0 gratis, 11 → 1, 21 → 1, 22 → 2", async () => {
    expect((await amounts(10, "full", null)).free).toBe(0);
    expect(await amounts(11, "full", null)).toMatchObject({ paid: 10, free: 1, total: 40000, commission: 10000 });
    expect(await amounts(21, "full", null)).toMatchObject({ paid: 20, free: 1 });
    expect(await amounts(22, "full", null)).toMatchObject({ paid: 20, free: 2, total: 80000, commission: 20000 });
  });

  it("Vollzahlung startet „voll bezahlt“ (F24), ohne Anzahlungsangaben", async () => {
    expect(await amounts(2, "full", "paying_persons")).toEqual({
      paid: 2, free: 0, total: 8000, deposit: null, collected: 8000, commission: 2000, status: "fully_paid", basis: null,
    });
  });

  it("Anzahlungsbasis: zahlende Köpfe (Standard) / alle Köpfe / freier Betrag", async () => {
    expect((await amounts(11, "deposit", "paying_persons")).deposit).toBe(10 * DEPOSIT);
    expect((await amounts(11, "deposit", "all_persons")).deposit).toBe(11 * DEPOSIT);
    expect(await amounts(11, "deposit", "custom_total", 15000)).toMatchObject({ deposit: 15000, collected: 15000 });
  });

  it("Fehler: freier Betrag ≥ Gesamt abgelehnt (F16), fehlt, ≤ 0; kein Ticketpreis; 0 Personen; keine Basis", async () => {
    await expect(amounts(3, "deposit", "custom_total", 12000)).rejects.toThrow(/DEPOSIT_NOT_BELOW_TOTAL/);
    await expect(amounts(3, "deposit", "custom_total", 20000)).rejects.toThrow(/DEPOSIT_NOT_BELOW_TOTAL/);
    await expect(amounts(3, "deposit", "custom_total", null)).rejects.toThrow(/CUSTOM_DEPOSIT_REQUIRED/);
    await expect(amounts(3, "deposit", "custom_total", 0)).rejects.toThrow(/DEPOSIT_NOT_POSITIVE/);
    await expect(amounts(3, "full", null, null, null)).rejects.toThrow(/NO_TICKET_PRICE/);
    await expect(amounts(0, "full", null)).rejects.toThrow(/INVALID_SEATS/);
    await expect(amounts(3, "deposit", null)).rejects.toThrow(/DEPOSIT_BASIS_REQUIRED/);
    // 1 Person mit Anzahlung = Ticketpreis → keine echte Anzahlung, abgelehnt
    await expect(
      sql`select * from promoter_sale_amounts(1, 'deposit', 'paying_persons', null, 3000, 3000, 1000, 11, 1)`,
    ).rejects.toThrow(/DEPOSIT_NOT_BELOW_TOTAL/);
  });
});

describe("Verkauf (reserve_promoter_seats)", () => {
  it("3 Personen, Anzahlung: confirmed, „Anzahlung erhalten“, 90 € kassiert, Snapshots, E-Mail optional, Audit „sold“", async () => {
    const dep = await createDeparture(30);
    const id = await reserveAs(PROMOTER, dep, { expectedTotal: 12000, expectedPaid: 9000 });
    const [rule] = await sql`select * from effective_group_rule(now())`;
    expect(await booking(id)).toEqual({
      channel: "promoter",
      status: "confirmed",
      payment_type: "deposit",
      payment_status: "deposit_received",
      deposit_basis: "paying_persons",
      seats: 3,
      paid_seats: 3,
      free_persons: 0,
      total_amount_cents: 12000,
      deposit_total_cents: 9000,
      amount_paid_cents: 9000,
      amount_due_cents: 3000,
      commission_total_cents: 3000,
      ticket_price_cents_snapshot: PRICE,
      deposit_amount_cents_snapshot: DEPOSIT,
      commission_per_ticket_cents_snapshot: COMMISSION,
      group_threshold_snapshot: rule.threshold_persons,
      group_free_snapshot: rule.free_persons,
      customer_name: "TEST-e54 Kunde",
      customer_phone: "+00 000 000 054",
      customer_email: null,
      promoter_id: PROMOTER,
      sold: true,
    });
    expect(await bookedTotal(dep)).toBe(3);
    const audit = await auditRows(id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "sold", actor_id: PROMOTER, actor_role: "promoter", old_values: null });
    expect(audit[0].new_values).toMatchObject({ payment_status: "deposit_received", amount_paid_cents: 9000, seats: 3 });
  });

  it("Vollzahlung → „voll bezahlt“, Rest 0, keine Anzahlungsangaben; E-Mail wird gespeichert", async () => {
    const dep = await createDeparture(30);
    const id = await reserveAs(PROMOTER, dep, { seats: 2, paymentType: "full", basis: null, email: "e54@example.invalid" });
    expect(await booking(id)).toMatchObject({
      payment_type: "full",
      payment_status: "fully_paid",
      deposit_basis: null,
      deposit_total_cents: null,
      deposit_amount_cents_snapshot: null,
      amount_paid_cents: 8000,
      amount_due_cents: 0,
      customer_email: "e54@example.invalid",
    });
  });

  it("Gruppenregel aus den Daten: Schwelle → Gratisplätze belegen Kontingent, ohne Preis und Provision; doppelte Schwelle → doppelt gratis", async () => {
    const [rule] = await sql`select * from effective_group_rule(now())`;
    const t = rule.threshold_persons as number;
    const f = rule.free_persons as number;
    const dep = await createDeparture(2 * t);
    const one = await reserveAs(PROMOTER, dep, { seats: t, paymentType: "full", basis: null });
    expect(await booking(one)).toMatchObject({ seats: t, paid_seats: t - f, free_persons: f, total_amount_cents: (t - f) * PRICE, commission_total_cents: (t - f) * COMMISSION });
    expect(await bookedTotal(dep)).toBe(t); // RISKS Nr. 22: Sitze = Personen, nicht bezahlte Plätze
    await sql`update tour_departures set seats_booked_total = 0 where id = ${dep}`; // Platz für den zweiten Block (nur Test)
    await sql`delete from bookings where id = ${one}`;
    const two = await reserveAs(PROMOTER, dep, { seats: 2 * t, paymentType: "full", basis: null });
    expect(await booking(two)).toMatchObject({ seats: 2 * t, paid_seats: 2 * (t - f), free_persons: 2 * f });
    expect(await bookedTotal(dep)).toBe(2 * t);
  });

  it("Idempotenz: gleicher Schlüssel nacheinander → dieselbe Buchung, Zähler nur einmal erhöht", async () => {
    const dep = await createDeparture(10);
    const key = crypto.randomUUID();
    const a = await reserveAs(PROMOTER, dep, { key });
    const b = await reserveAs(PROMOTER, dep, { key });
    expect(b).toBe(a);
    expect(await bookedTotal(dep)).toBe(3);
  });

  it(`Idempotenz: gleicher Schlüssel ${PARALLEL}× parallel → genau 1 Buchung, Zähler nur einmal erhöht`, async () => {
    const dep = await createDeparture(30);
    const key = crypto.randomUUID();
    const results = await Promise.allSettled(Array.from({ length: PARALLEL }, () => reserveAs(PROMOTER, dep, { key })));
    const ids = new Set(results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<string>).value));
    expect(ids.size).toBe(1);
    for (const r of results) {
      if (r.status === "rejected") expect(String(r.reason?.message)).toMatch(/bookings_idempotency_key_key/);
    }
    const [c] = await sql`select count(*)::int as n from bookings where departure_id = ${dep}`;
    expect(c.n).toBe(1);
    expect(await bookedTotal(dep)).toBe(3);
  });

  it("Schlüssel einer fremden Buchung → IDEMPOTENCY_KEY_REUSED", async () => {
    const dep = await createDeparture(10);
    const key = crypto.randomUUID();
    const id = await reserveAs(PROMOTER, dep, { key });
    await sql`update bookings set promoter_id = ${INACTIVE} where id = ${id}`; // simuliert: Buchung eines anderen Promoters
    await expect(reserveAs(PROMOTER, dep, { key })).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED/);
  });

  it("Kundendaten: Name + Handynummer Pflicht (F8), E-Mail nur gültig oder leer", async () => {
    const dep = await createDeparture(10);
    await expect(reserveAs(PROMOTER, dep, { name: "   " })).rejects.toThrow(/CUSTOMER_NAME_REQUIRED/);
    await expect(reserveAs(PROMOTER, dep, { phone: "" })).rejects.toThrow(/CUSTOMER_PHONE_REQUIRED/);
    await expect(reserveAs(PROMOTER, dep, { phone: "12-34" })).rejects.toThrow(/CUSTOMER_PHONE_REQUIRED/);
    await expect(reserveAs(PROMOTER, dep, { email: "kein-at" })).rejects.toThrow(/CUSTOMER_EMAIL_INVALID/);
    await expect(reserveAs(PROMOTER, dep, { email: "  " })).resolves.toBeTruthy(); // leer = keine E-Mail
    expect(await bookedTotal(dep)).toBe(3);
  });

  it("Kundendaten auch bei Vollzahler Pflicht (F8, Marco 03.10.2026): ohne Name/Handy kein Verkauf", async () => {
    const dep = await createDeparture(10);
    const full = { paymentType: "full", basis: null } as const;
    await expect(reserveAs(PROMOTER, dep, { ...full, name: "   " })).rejects.toThrow(/CUSTOMER_NAME_REQUIRED/);
    await expect(reserveAs(PROMOTER, dep, { ...full, phone: "" })).rejects.toThrow(/CUSTOMER_PHONE_REQUIRED/);
    await expect(reserveAs(PROMOTER, dep, { ...full, phone: "12-34" })).rejects.toThrow(/CUSTOMER_PHONE_REQUIRED/);
    expect(await bookedTotal(dep)).toBe(0);
    const id = await reserveAs(PROMOTER, dep, full);
    expect(await booking(id)).toMatchObject({
      payment_type: "full",
      payment_status: "fully_paid",
      customer_name: "TEST-e54 Kunde",
      customer_phone: "+00 000 000 054",
    });
  });

  it("Freier Betrag ≥ Gesamt → abgelehnt (F16), angezeigter Betrag weicht ab → QUOTE_CHANGED; Zähler unverändert", async () => {
    const dep = await createDeparture(10);
    await expect(reserveAs(PROMOTER, dep, { basis: "custom_total", custom: 12000 })).rejects.toThrow(/DEPOSIT_NOT_BELOW_TOTAL/);
    await expect(reserveAs(PROMOTER, dep, { expectedTotal: 11999 })).rejects.toThrow(/QUOTE_CHANGED/);
    await expect(reserveAs(PROMOTER, dep, { expectedPaid: 1 })).rejects.toThrow(/QUOTE_CHANGED/);
    expect(await bookedTotal(dep)).toBe(0);
    const id = await reserveAs(PROMOTER, dep, { basis: "custom_total", custom: 5000 });
    expect(await booking(id)).toMatchObject({ deposit_basis: "custom_total", deposit_total_cents: 5000, amount_paid_cents: 5000, amount_due_cents: 7000 });
  });

  it("Termin ohne Ticketpreis (nur wenn kein Standard-Preis eingetragen ist) → NO_TICKET_PRICE", async ({ skip }) => {
    const [std] = await sql`select effective_price_cents('ticket_price', null, now()) as p`;
    if (std.p !== null) skip(); // Gabo hat einen Standard eingetragen — dann hat jeder Termin einen Preis
    const dep = await createDeparture(10, false);
    await expect(reserveAs(PROMOTER, dep)).rejects.toThrow(/NO_TICKET_PRICE/);
    expect(await bookedTotal(dep)).toBe(0);
  });
});

describe("Zahlungsstatus 3-stufig (set_booking_payment_status)", () => {
  it("Promoter ändert eigene Buchung: nichts kassiert → voll bezahlt → Anzahlung erhalten; je eine Audit-Zeile mit Vorher/Nachher", async () => {
    const dep = await createDeparture(10);
    const id = await reserveAs(PROMOTER, dep);
    await setStatusAs(PROMOTER, id, "not_collected");
    expect(await booking(id)).toMatchObject({ payment_status: "not_collected", amount_paid_cents: 0, amount_due_cents: 12000 });
    await setStatusAs(PROMOTER, id, "fully_paid");
    expect(await booking(id)).toMatchObject({ payment_status: "fully_paid", amount_paid_cents: 12000, amount_due_cents: 0 });
    await setStatusAs(PROMOTER, id, "deposit_received");
    expect(await booking(id)).toMatchObject({ payment_status: "deposit_received", amount_paid_cents: 9000, amount_due_cents: 3000 });
    await setStatusAs(PROMOTER, id, "deposit_received"); // unverändert → keine Audit-Zeile

    const audit = await auditRows(id);
    expect(audit.map((a) => a.action)).toEqual(["sold", "payment_status_set", "payment_status_set", "payment_status_set"]);
    expect(audit[1]).toMatchObject({
      actor_id: PROMOTER,
      actor_role: "promoter",
      old_values: { payment_status: "deposit_received", amount_paid_cents: 9000 },
      new_values: { payment_status: "not_collected", amount_paid_cents: 0 },
    });
  });

  it("Gabo ändert jede Promoter-Buchung (Audit mit Rolle network_operator)", async () => {
    const dep = await createDeparture(10);
    const id = await reserveAs(PROMOTER, dep);
    await setStatusAs(OPERATOR, id, "fully_paid");
    const audit = await auditRows(id);
    expect(audit[1]).toMatchObject({ action: "payment_status_set", actor_id: OPERATOR, actor_role: "network_operator" });
  });

  it("Vollzahlung kann nicht auf „Anzahlung erhalten“; deaktiviert/fremd/anon/storniert/Online abgelehnt", async () => {
    const dep = await createDeparture(10);
    const full = await reserveAs(PROMOTER, dep, { seats: 1, paymentType: "full", basis: null });
    await expect(setStatusAs(PROMOTER, full, "deposit_received")).rejects.toThrow(/NOT_A_DEPOSIT_BOOKING/);
    await setStatusAs(PROMOTER, full, "not_collected"); // erlaubt: noch nichts kassiert
    expect(await booking(full)).toMatchObject({ payment_status: "not_collected", amount_paid_cents: 0 });

    const id = await reserveAs(PROMOTER, dep);
    await expect(setStatusAs(INACTIVE, id, "fully_paid")).rejects.toThrow(/NOT_ALLOWED/);
    await expect(setStatusAs(null, id, "fully_paid")).rejects.toThrow(/permission denied/);

    await sql`update bookings set promoter_id = ${INACTIVE} where id = ${id}`; // jetzt fremde Buchung
    await expect(setStatusAs(PROMOTER, id, "fully_paid")).rejects.toThrow(/BOOKING_NOT_FOUND/);

    await sql`update bookings set status = 'cancelled' where id = ${id}`;
    await expect(setStatusAs(OPERATOR, id, "fully_paid")).rejects.toThrow(/BOOKING_CANCELLED/);

    const [online] = await sql`
      select (reserve_departure_seats(${dep}::uuid, 1, 4000, 4000, 'TEST-e54 Online', 'e54-online@example.invalid', null, null, false, false, null)).id as id
    `;
    await expect(setStatusAs(OPERATOR, online.id as string, "fully_paid")).rejects.toThrow(/NOT_A_PROMOTER_BOOKING/);
  });
});

describe("Schema 0010", () => {
  it("customer_email ist nullable; neue Checks greifen bei direktem INSERT", async () => {
    const [c] = await sql`
      select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'bookings' and column_name = 'customer_email'
    `;
    expect(c.is_nullable).toBe("YES");
    const names = await sql`
      select conname from pg_constraint
      where conrelid = 'public.bookings'::regclass
        and conname in ('promoter_deposit_terms_consistent', 'promoter_customer_phone_present', 'snapshot_amounts_consistent', 'payment_status_matches_amounts')
      order by conname
    `;
    expect(names.map((n) => n.conname)).toEqual([
      "payment_status_matches_amounts",
      "promoter_customer_phone_present",
      "promoter_deposit_terms_consistent",
      "snapshot_amounts_consistent",
    ]);
  });
});
