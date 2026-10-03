import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E5.5a — Migration 0011: Auswertungs-Sichten (sales_totals, sales_by_day,
// sales_by_promoter, sales_by_departure).
//   * Geld: jede Summe wird gegen die Einzelverkäufe geprüft — von Hand
//     gerechnet (kleine Personenzahlen) UND gegen die Rohzeilen in bookings
//     im selben Transaktions-Snapshot (repeatable read).
//   * Provision nur aus dem Snapshot: eine spätere Regeländerung ändert keine Summe.
//   * Storno zählt nicht in Umsatz/Provision, sondern separat (F10 offen).
//   * Verkaufstag = Kalendertag Mallorca (Europe/Madrid), auch um Mitternacht
//     und über die Zeitumstellung.
//   * RLS: Promoter sieht nur eigene Zahlen (auch in Summen), deaktiviert
//     nichts, anon kein Recht; network_operator alles.
// Ein eigener, temporärer Promoter (TEST-e55) isoliert die Summen von den
// parallel laufenden Test-Dateien. Aufräumen in afterAll.

const OPERATOR = "11111111-1111-4111-8111-111111111111";
const PROMOTER = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "33333333-3333-4333-8333-333333333333";
const PROMOTER_A = crypto.randomUUID();

const PRICE = 4000; // 40 € Ticket (Termin-Ausnahme)
const DEPOSIT = 3000; // 30 € Anzahlung pro Person
const COMMISSION = 1000; // 10 € Provision pro Ticket

const VIEWS = ["sales_by_day", "sales_by_departure", "sales_by_promoter", "sales_totals"];

const sql = connect(2);
let departureId: string;
const sale: Record<"s1" | "s2" | "s3" | "s4" | "other", string> = {
  s1: "",
  s2: "",
  s3: "",
  s4: "",
  other: "",
};

type Row = Record<string, unknown>;
type Tx = typeof sql;

/** Eine Transaktion als `authenticated` mit `sub` (oder `anon`, wenn null). */
function asUser<T>(
  userId: string | null,
  query: (tx: Tx) => Promise<T>,
  isolation = "isolation level read committed",
): Promise<T> {
  return sql.begin(isolation, async (tx) => {
    if (userId) {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    } else {
      await tx`set local role anon`;
    }
    return query(tx as unknown as Tx);
  }) as Promise<T>;
}

/** bigint kommt von postgres.js als String — alle Zahlenspalten in Number umwandeln. */
function nums(row: Row | undefined, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = Number(row?.[k]);
  return out;
}

const MONEY = [
  "sales_count",
  "tickets",
  "revenue_cents",
  "collected_cents",
  "due_cents",
  "commission_cents",
];

function reserveAs(
  userId: string,
  seats: number,
  paymentType: "full" | "deposit",
  basis: "paying_persons" | "custom_total" | null,
  custom: number | null = null,
): Promise<string> {
  return asUser(userId, async (tx) => {
    const [r] = await tx`
      select reserve_promoter_seats(
        ${departureId}::uuid, ${seats}::int, ${paymentType}::payment_type,
        ${basis}::deposit_basis, ${custom}::int,
        ${"TEST-e55 Kunde"}, ${"+00 000 000 055"}, ${null},
        ${crypto.randomUUID()}::uuid, ${null}::int, ${null}::int
      ) as id
    `;
    return r.id as string;
  });
}

/** Erwartete Summen, aus den Einzelzeilen gerechnet (Snapshot-Arithmetik). */
async function expectedFromRows(ids: string[]) {
  const rows = await sql`
    select seats, paid_seats, total_amount_cents, amount_paid_cents, amount_due_cents,
           commission_total_cents, ticket_price_cents_snapshot, commission_per_ticket_cents_snapshot
    from bookings where id in ${sql(ids)}
  `;
  const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    sales_count: rows.length,
    tickets: sum((r) => r.seats as number),
    // Gesamt und Provision bewusst aus Snapshot × bezahlte Plätze, nicht aus den Summenspalten.
    revenue_cents: sum((r) => (r.paid_seats as number) * (r.ticket_price_cents_snapshot as number)),
    collected_cents: sum((r) => r.amount_paid_cents as number),
    due_cents: sum((r) => (r.total_amount_cents as number) - (r.amount_paid_cents as number)),
    commission_cents: sum(
      (r) => (r.paid_seats as number) * (r.commission_per_ticket_cents_snapshot as number),
    ),
  };
}

beforeAll(async () => {
  await sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
    ) values (
      '00000000-0000-0000-0000-000000000000', ${PROMOTER_A}, 'authenticated', 'authenticated',
      ${`test-e55-${PROMOTER_A}@mmb-promoter.test`}, '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', ''
    )
  `;
  await sql`
    insert into profiles (id, role, active, display_name)
    values (${PROMOTER_A}, 'promoter', true, 'TEST-e55 Promoter A')
  `;
  const [d] = await sql`
    insert into tour_departures (title, starts_at, capacity_total, status)
    values ('TEST-e55-Auswertung', now() + interval '10 days', 40, 'open')
    returning id
  `;
  departureId = d.id as string;
  await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('ticket_price', ${departureId}, ${PRICE}, ${OPERATOR})`;
  await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('deposit', ${departureId}, ${DEPOSIT}, ${OPERATOR})`;
  await sql`insert into commission_rules (departure_id, commission_cents, created_by) values (${departureId}, ${COMMISSION}, ${OPERATOR})`;

  // Promoter A: vier Verkäufe. s1–s3 von Hand nachrechenbar (unter jeder Gruppenschwelle).
  sale.s1 = await reserveAs(PROMOTER_A, 2, "deposit", "paying_persons"); // 80 € · 60 kassiert · 20 offen · 20 Provision
  sale.s2 = await reserveAs(PROMOTER_A, 3, "full", null); // 120 € · 120 · 0 · 30
  sale.s3 = await reserveAs(PROMOTER_A, 1, "deposit", "custom_total", 1500); // 40 € · 15 · 25 · 10
  sale.s4 = await reserveAs(PROMOTER_A, 12, "deposit", "paying_persons"); // Gruppe — Werte aus den Snapshots
  // Anderer Promoter auf demselben Event: darf in A's Zahlen nie auftauchen.
  sale.other = await reserveAs(PROMOTER, 1, "full", null); // 40 € · 40 · 0 · 10
});

afterAll(async () => {
  if (departureId) {
    await sql`delete from bookings where departure_id = ${departureId}`; // Audit/Nachrichten: on delete cascade
    await sql`delete from pricing_rules where departure_id = ${departureId}`;
    await sql`delete from commission_rules where departure_id = ${departureId}`;
    await sql`delete from tour_departures where id = ${departureId}`;
  }
  await sql`delete from auth.users where id = ${PROMOTER_A}`; // profiles: on delete cascade
  await sql.end();
});

describe("Rechte und security_invoker", () => {
  it("alle vier Sichten laufen mit security_invoker (sonst umgingen sie RLS)", async () => {
    const rows = await sql`
      select c.relname, c.reloptions
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'sales\\_%'
      order by c.relname
    `;
    expect(rows.map((r) => r.relname)).toEqual(VIEWS);
    for (const r of rows) expect(r.reloptions).toContain("security_invoker=true");
  });

  it("authenticated nur SELECT, anon nichts", async () => {
    const rows = await sql`
      select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.table_privileges
      where table_schema = 'public' and table_name like 'sales\\_%' and grantee in ('anon', 'authenticated')
      group by table_name, grantee order by table_name
    `;
    expect(rows).toEqual(VIEWS.map((v) => ({ table_name: v, grantee: "authenticated", privs: "SELECT" })));
    for (const v of VIEWS) {
      await expect(asUser(null, (tx) => tx`select * from ${sql(v)}`)).rejects.toThrow(/permission denied/);
    }
  });
});

describe("Promoter A: Summen stimmen mit den Einzelverkäufen", () => {
  it("sales_totals = Handrechnung s1–s3 + Gruppe s4 aus Snapshots; heute = gesamt", async () => {
    const s4 = await expectedFromRows([sale.s4]);
    // Gruppe: Personen belegen Sitze, bezahlt/provisioniert werden nur zahlende Köpfe.
    const [g] = await sql`select seats, paid_seats, free_persons, group_threshold_snapshot as t, group_free_snapshot as f from bookings where id = ${sale.s4}`;
    expect(g.free_persons).toBe(Math.floor(12 / (g.t as number)) * (g.f as number));
    expect(s4.revenue_cents).toBe((g.paid_seats as number) * PRICE);
    expect(s4.collected_cents).toBe((g.paid_seats as number) * DEPOSIT);
    expect(s4.commission_cents).toBe((g.paid_seats as number) * COMMISSION);

    const [t] = await asUser(PROMOTER_A, (tx) => tx`select * from sales_totals`);
    expect(nums(t, MONEY)).toEqual({
      sales_count: 3 + 1,
      tickets: 6 + 12,
      revenue_cents: 24000 + s4.revenue_cents,
      collected_cents: 19500 + s4.collected_cents,
      due_cents: 4500 + s4.due_cents,
      commission_cents: 6000 + s4.commission_cents,
    });
    expect(Number(t.paid_tickets) + Number(t.free_tickets)).toBe(Number(t.tickets));
    expect(nums(t, ["today_sales_count", "today_tickets", "today_revenue_cents", "today_collected_cents", "today_commission_cents"])).toEqual({
      today_sales_count: Number(t.sales_count),
      today_tickets: Number(t.tickets),
      today_revenue_cents: Number(t.revenue_cents),
      today_collected_cents: Number(t.collected_cents),
      today_commission_cents: Number(t.commission_cents),
    });
    expect(nums(t, ["cancelled_count", "cancelled_commission_cents"])).toEqual({
      cancelled_count: 0,
      cancelled_commission_cents: 0,
    });
  });

  it("Gesamt und Provision = Snapshot × bezahlte Plätze, Rest = Gesamt − kassiert (pro Zeile)", async () => {
    const expected = await expectedFromRows([sale.s1, sale.s2, sale.s3, sale.s4]);
    const [t] = await asUser(PROMOTER_A, (tx) => tx`select * from sales_totals`);
    expect(nums(t, MONEY)).toEqual(expected);
  });

  it("by_promoter, by_departure, by_day: nur eigene Zeilen, Summen = sales_totals", async () => {
    const res = await asUser(PROMOTER_A, async (tx) => ({
      totals: await tx`select * from sales_totals`,
      promoters: await tx`select * from sales_by_promoter`,
      departures: await tx`select * from sales_by_departure`,
      days: await tx`select * from sales_by_day`,
    }));
    const total = nums(res.totals[0], MONEY);
    expect(res.promoters).toHaveLength(1);
    expect(res.promoters[0].promoter_id).toBe(PROMOTER_A);
    expect(res.promoters[0].display_name).toBe("TEST-e55 Promoter A");
    expect(nums(res.promoters[0], MONEY)).toEqual(total);
    // Event-Zeile enthält nur A's Verkäufe, nicht den 40-€-Verkauf des anderen Promoters.
    expect(res.departures).toHaveLength(1);
    expect(res.departures[0].departure_id).toBe(departureId);
    expect(nums(res.departures[0], MONEY)).toEqual(total);
    // Belegung zeigt das ganze Netzwerk (Kontingent ist gemeinsam): 2+3+1+12 + 1.
    expect(res.departures[0].seats_booked_total).toBe(19);
    // sales_by_day führt keinen Rest (der Rest gehört zum Event, nicht zum Verkaufstag).
    const noDue = MONEY.filter((k) => k !== "due_cents");
    const daySum = Object.fromEntries(noDue.map((k) => [k, res.days.reduce((a, d) => a + Number(d[k]), 0)]));
    expect(daySum).toEqual(Object.fromEntries(noDue.map((k) => [k, total[k]])));
  });
});

describe("Isolation: nie fremde Verkäufe oder Provisionen", () => {
  it("anderer Promoter sieht auf demselben Event nur seinen eigenen Verkauf, A's Zeile nie", async () => {
    const res = await asUser(PROMOTER, async (tx) => ({
      promoters: await tx`select promoter_id from sales_by_promoter`,
      dep: await tx`select * from sales_by_departure where departure_id = ${departureId}`,
    }));
    expect(res.promoters.map((r) => r.promoter_id)).toEqual([PROMOTER]);
    expect(nums(res.dep[0], MONEY)).toEqual({
      sales_count: 1,
      tickets: 1,
      revenue_cents: 4000,
      collected_cents: 4000,
      due_cents: 0,
      commission_cents: 1000,
    });
  });

  it("deaktivierter Promoter: Summen 0, keine Zeilen", async () => {
    const res = await asUser(INACTIVE, async (tx) => ({
      totals: await tx`select * from sales_totals`,
      promoters: await tx`select * from sales_by_promoter`,
      departures: await tx`select * from sales_by_departure`,
      days: await tx`select * from sales_by_day`,
    }));
    expect(nums(res.totals[0], MONEY)).toEqual(Object.fromEntries(MONEY.map((k) => [k, 0])));
    expect(res.promoters).toEqual([]);
    expect(res.departures).toEqual([]);
    expect(res.days).toEqual([]);
  });
});

describe("network_operator: Gesamtsicht = Summe aller Einzelverkäufe", () => {
  it("im selben Snapshot: Rohzeilen = sales_totals = Σ by_promoter = Σ by_departure = Σ by_day", async () => {
    const res = await asUser(
      OPERATOR,
      async (tx) => ({
        raw: await tx`
          select count(*)::int as sales_count, coalesce(sum(seats), 0)::int as tickets,
                 coalesce(sum(total_amount_cents), 0)::bigint as revenue_cents,
                 coalesce(sum(amount_paid_cents), 0)::bigint as collected_cents,
                 coalesce(sum(amount_due_cents), 0)::bigint as due_cents,
                 coalesce(sum(commission_total_cents), 0)::bigint as commission_cents
          from bookings where channel = 'promoter' and status not in ('cancelled', 'refunded')
        `,
        totals: await tx`select * from sales_totals`,
        promoters: await tx`select * from sales_by_promoter`,
        departures: await tx`select * from sales_by_departure`,
        days: await tx`select * from sales_by_day`,
      }),
      "isolation level repeatable read",
    );
    const raw = nums(res.raw[0], MONEY);
    expect(nums(res.totals[0], MONEY)).toEqual(raw);
    const sumOf = (rows: Row[], keys: string[]) =>
      Object.fromEntries(keys.map((k) => [k, rows.reduce((a, r) => a + Number(r[k]), 0)]));
    expect(sumOf(res.promoters, MONEY)).toEqual(raw);
    expect(sumOf(res.departures, MONEY)).toEqual(raw);
    const noDue = MONEY.filter((k) => k !== "due_cents");
    expect(sumOf(res.days, noDue)).toEqual(Object.fromEntries(noDue.map((k) => [k, raw[k]])));
    // Operator sieht beide Promoter dieses Events.
    const ids = res.promoters.map((r) => r.promoter_id);
    expect(ids).toContain(PROMOTER_A);
    expect(ids).toContain(PROMOTER);
    const dep = res.departures.find((r) => r.departure_id === departureId);
    const a = res.promoters.find((r) => r.promoter_id === PROMOTER_A);
    expect(Number(dep?.revenue_cents)).toBe(Number(a?.revenue_cents) + 4000);
    expect(Number(dep?.commission_cents)).toBe(Number(a?.commission_cents) + 1000);
  });
});

describe("Snapshot: Regeländerung nach dem Verkauf ändert keine Summe", () => {
  it("neuer Ticketpreis 99 € und Provision 50 € am Event → A's Zahlen unverändert", async () => {
    const before = await asUser(PROMOTER_A, (tx) => tx`select * from sales_totals`);
    await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('ticket_price', ${departureId}, 9900, ${OPERATOR})`;
    await sql`insert into commission_rules (departure_id, commission_cents, created_by) values (${departureId}, 5000, ${OPERATOR})`;
    const after = await asUser(PROMOTER_A, (tx) => tx`select * from sales_totals`);
    expect(nums(after[0], MONEY)).toEqual(nums(before[0], MONEY));
  });
});

describe("Storno zählt nicht in Umsatz/Provision, sondern separat (F10)", () => {
  it("s3 storniert → Umsatz −40 €, Provision −10 €, separat 1 Storno mit 10 € Provisions-Snapshot", async () => {
    const before = nums((await asUser(PROMOTER_A, (tx) => tx`select * from sales_totals`))[0], MONEY);
    // Storno-Funktion gibt es noch nicht (eigener TASKS-Schritt) — Status direkt als postgres.
    await sql`
      update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = ${OPERATOR},
             cancellation_reason = 'TEST-e55'
      where id = ${sale.s3}
    `;
    const res = await asUser(PROMOTER_A, async (tx) => ({
      totals: await tx`select * from sales_totals`,
      dep: await tx`select * from sales_by_departure`,
      prom: await tx`select * from sales_by_promoter`,
    }));
    const t = res.totals[0];
    expect(nums(t, MONEY)).toEqual({
      sales_count: before.sales_count - 1,
      tickets: before.tickets - 1,
      revenue_cents: before.revenue_cents - 4000,
      collected_cents: before.collected_cents - 1500,
      due_cents: before.due_cents - 2500,
      commission_cents: before.commission_cents - 1000,
    });
    expect(nums(t, ["cancelled_count", "cancelled_commission_cents"])).toEqual({
      cancelled_count: 1,
      cancelled_commission_cents: 1000,
    });
    expect(Number(res.dep[0].cancelled_count)).toBe(1);
    expect(nums(res.prom[0], ["cancelled_count", "cancelled_commission_cents"])).toEqual({
      cancelled_count: 1,
      cancelled_commission_cents: 1000,
    });
  });
});

describe("Verkaufstag = Kalendertag Mallorca (Europe/Madrid)", () => {
  it("22:00 UTC im Sommer = nächster Tag, 21:59:59 UTC = selber Tag; Winterzeit 23:30 UTC = nächster Tag", async () => {
    await sql`update bookings set sold_at = '2026-07-01T22:00:00Z' where id = ${sale.s1}`; // 02.07. 00:00 Ortszeit
    await sql`update bookings set sold_at = '2026-07-01T21:59:59Z' where id = ${sale.s2}`; // 01.07. 23:59:59
    await sql`update bookings set sold_at = '2026-03-28T23:30:00Z' where id = ${sale.s4}`; // 29.03. 00:30 (noch Winterzeit)
    const s4 = await expectedFromRows([sale.s4]);
    const res = await asUser(PROMOTER_A, async (tx) => ({
      days: await tx`select sale_day::text as day, sales_count, revenue_cents, commission_cents from sales_by_day where sale_day < '2026-10-01' order by sale_day`,
      totals: await tx`select * from sales_totals`,
    }));
    expect(res.days.map((d) => ({ day: d.day, ...nums(d, ["sales_count", "revenue_cents", "commission_cents"]) }))).toEqual([
      { day: "2026-03-29", sales_count: 1, revenue_cents: s4.revenue_cents, commission_cents: s4.commission_cents },
      { day: "2026-07-01", sales_count: 1, revenue_cents: 12000, commission_cents: 3000 },
      { day: "2026-07-02", sales_count: 1, revenue_cents: 8000, commission_cents: 2000 },
    ]);
    // Heute bleibt nichts übrig (s3 storniert, s1/s2/s4 in der Vergangenheit); gesamt unverändert.
    const t = res.totals[0];
    expect(nums(t, ["today_sales_count", "today_revenue_cents", "today_commission_cents"])).toEqual({
      today_sales_count: 0,
      today_revenue_cents: 0,
      today_commission_cents: 0,
    });
    expect(Number(t.revenue_cents)).toBe(8000 + 12000 + s4.revenue_cents);
  });
});
