import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// Teil 2 — Migrationen 0012/0013: dritte Rolle „guide“ + Konto-Pflege durch Gabo.
//   * Guide verkauft wie ein Promoter (reserve_promoter_seats, Audit-Rolle guide)
//   * Jede Rolle sieht nur Eigenes: Guide ↔ Promoter sehen gegenseitig keine
//     Buchungen, keine Audit-Zeilen, keine Zahlen in den Sichten aus 0011
//   * Zahlungsstatus fremder Buchung: Guide/Promoter → BOOKING_NOT_FOUND
//     (Lückenfix 0013), Gabo darf
//   * Konto-Pflege: Gabo legt Promoter- und Guide-Profile an, aber keinen
//     network_operator; Rolle unveränderlich; Gabos eigenes Profil unantastbar;
//     Promoter/Guide/inaktiv/anon schreiben keine Profile
//   * deaktivierter Guide verkauft nicht
// Eigene, temporäre Konten (TEST-t2) isolieren die Zahlen von den anderen
// Test-Dateien. Aufräumen in afterAll.

const OPERATOR = "11111111-1111-4111-8111-111111111111";
const SEED_GUIDE = "44444444-4444-4444-8444-444444444444";
const GUIDE = crypto.randomUUID();
const PROMOTER = crypto.randomUUID();
const GUIDE_INACTIVE = crypto.randomUUID();
/** Auth-Konten ohne Profil — Gabo legt das Profil im Test selbst an. */
const NEW_A = crypto.randomUUID();
const NEW_B = crypto.randomUUID();
const NEW_C = crypto.randomUUID();
const AUTH_USERS = [GUIDE, PROMOTER, GUIDE_INACTIVE, NEW_A, NEW_B, NEW_C];

const PRICE = 4000;
const DEPOSIT = 3000;
const COMMISSION = 1000;

const sql = connect(2);
let departureId: string;
let guideSale: string;
let promoterSale: string;

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

async function createAuthUser(id: string) {
  await sql`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
    ) values (
      '00000000-0000-0000-0000-000000000000', ${id}, 'authenticated', 'authenticated',
      ${`test-t2-${id}@mmb-promoter.test`}, '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', '', ''
    )
  `;
}

function reserveAs(userId: string | null, seats: number, paymentType: "full" | "deposit" = "deposit") {
  const basis = paymentType === "deposit" ? "paying_persons" : null;
  return asUser(userId, async (tx) => {
    const [r] = await tx`
      select reserve_promoter_seats(
        ${departureId}::uuid, ${seats}::int, ${paymentType}::payment_type,
        ${basis}::deposit_basis, null::int,
        'TEST-t2 Kunde', '+00 000 000 002', null,
        ${crypto.randomUUID()}::uuid, null::int, null::int
      ) as id
    `;
    return r.id as string;
  });
}

function setStatusAs(userId: string, bookingId: string, status: string) {
  return asUser(userId, (tx) => tx`select set_booking_payment_status(${bookingId}::uuid, ${status}::payment_status) as s`);
}

beforeAll(async () => {
  for (const id of AUTH_USERS) await createAuthUser(id);
  await sql`
    insert into profiles (id, role, active, display_name) values
      (${GUIDE}, 'guide', true, 'TEST-t2 Guide'),
      (${PROMOTER}, 'promoter', true, 'TEST-t2 Promoter'),
      (${GUIDE_INACTIVE}, 'guide', false, 'TEST-t2 Guide inaktiv')
  `;
  const [d] = await sql`
    insert into tour_departures (title, starts_at, capacity_total, status)
    values ('TEST-t2 Event', now() + interval '10 days', 20, 'open')
    returning id
  `;
  departureId = d.id as string;
  await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('ticket_price', ${departureId}, ${PRICE}, ${OPERATOR})`;
  await sql`insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('deposit', ${departureId}, ${DEPOSIT}, ${OPERATOR})`;
  await sql`insert into commission_rules (departure_id, commission_cents, created_by) values (${departureId}, ${COMMISSION}, ${OPERATOR})`;

  guideSale = await reserveAs(GUIDE, 2); // 80 € · 60 kassiert · 20 offen · 20 Provision
  promoterSale = await reserveAs(PROMOTER, 1, "full"); // 40 € · 40 · 0 · 10
});

afterAll(async () => {
  if (departureId) {
    await sql`delete from bookings where departure_id = ${departureId}`; // Audit/Nachrichten: cascade
    await sql`delete from pricing_rules where departure_id = ${departureId}`;
    await sql`delete from commission_rules where departure_id = ${departureId}`;
    await sql`delete from tour_departures where id = ${departureId}`;
  }
  await sql`delete from auth.users where id in ${sql(AUTH_USERS)}`; // profiles: cascade
  await sql.end();
});

describe("Rolle guide (0012)", () => {
  it("Enum user_role kennt genau network_operator, promoter, guide", async () => {
    const rows = await sql`select unnest(enum_range(null::user_role))::text as r`;
    expect(rows.map((r) => r.r)).toEqual(["network_operator", "promoter", "guide"]);
  });

  it("Seed: Test-Guide guide@mmb-promoter.test ist aktiv mit Rolle guide", async () => {
    const [r] = await sql`
      select p.role::text, p.active, u.email
      from profiles p join auth.users u on u.id = p.id
      where p.id = ${SEED_GUIDE}
    `;
    expect(r).toEqual({ role: "guide", active: true, email: "guide@mmb-promoter.test" });
  });

  it("is_selling_profile(): Promoter und Guide ja, Gabo und deaktiviert nein", async () => {
    const check = (id: string) =>
      asUser(id, async (tx) => (await tx`select is_selling_profile() as v`)[0].v as boolean);
    expect(await check(GUIDE)).toBe(true);
    expect(await check(PROMOTER)).toBe(true);
    expect(await check(OPERATOR)).toBe(false);
    expect(await check(GUIDE_INACTIVE)).toBe(false);
  });
});

describe("Guide verkauft wie ein Promoter (reserve_promoter_seats aus 0013)", () => {
  it("Buchung gehört dem Guide, Beträge aus den Snapshots, Audit-Rolle guide", async () => {
    const [b] = await sql`
      select promoter_id, channel::text, status::text, payment_status::text, seats,
             total_amount_cents, amount_paid_cents, amount_due_cents, commission_total_cents
      from bookings where id = ${guideSale}
    `;
    expect(b).toEqual({
      promoter_id: GUIDE,
      channel: "promoter",
      status: "confirmed",
      payment_status: "deposit_received",
      seats: 2,
      total_amount_cents: 2 * PRICE,
      amount_paid_cents: 2 * DEPOSIT,
      amount_due_cents: 2 * (PRICE - DEPOSIT),
      commission_total_cents: 2 * COMMISSION,
    });
    const audit = await sql`
      select action::text, actor_id, actor_role::text from booking_audit_log where booking_id = ${guideSale}
    `;
    expect(audit).toEqual([{ action: "sold", actor_id: GUIDE, actor_role: "guide" }]);
  });

  it("Kontingent zählt die Verkäufe beider Rollen (2 + 1 = 3 von 20)", async () => {
    const [d] = await sql`select seats_booked_total as n from tour_departures where id = ${departureId}`;
    expect(d.n).toBe(3);
  });

  it("deaktivierter Guide und Gabo verkaufen nicht (NOT_ALLOWED), anon permission denied", async () => {
    await expect(reserveAs(GUIDE_INACTIVE, 1)).rejects.toThrow(/NOT_ALLOWED/);
    await expect(reserveAs(OPERATOR, 1)).rejects.toThrow(/NOT_ALLOWED/);
    await expect(reserveAs(null, 1)).rejects.toThrow(/permission denied/);
    const [d] = await sql`select seats_booked_total as n from tour_departures where id = ${departureId}`;
    expect(d.n).toBe(3);
  });
});

describe("jede Rolle nur Eigenes", () => {
  it("Guide sieht nur seine Buchung, Promoter nur seine — Gabo beide", async () => {
    const ids = (userId: string) =>
      asUser(userId, async (tx) =>
        (await tx`select id from bookings where departure_id = ${departureId} order by sold_at`).map((r) => r.id),
      );
    expect(await ids(GUIDE)).toEqual([guideSale]);
    expect(await ids(PROMOTER)).toEqual([promoterSale]);
    expect((await ids(OPERATOR)).sort()).toEqual([guideSale, promoterSale].sort());
    expect(await ids(GUIDE_INACTIVE)).toEqual([]);
  });

  it("Audit-Log: Guide sieht keine Zeile der Promoter-Buchung und umgekehrt", async () => {
    const audit = (userId: string, bookingId: string) =>
      asUser(userId, (tx) => tx`select id from booking_audit_log where booking_id = ${bookingId}`);
    expect(await audit(GUIDE, guideSale)).toHaveLength(1);
    expect(await audit(GUIDE, promoterSale)).toHaveLength(0);
    expect(await audit(PROMOTER, guideSale)).toHaveLength(0);
  });

  it("Sichten aus 0011: Guide bekommt nur eigene Zahlen, auch in den Summen", async () => {
    const [byPromoter] = await asUser(GUIDE, (tx) => tx`select * from sales_by_promoter`);
    expect(byPromoter.promoter_id).toBe(GUIDE);
    expect(Number(byPromoter.revenue_cents)).toBe(2 * PRICE);
    expect(Number(byPromoter.commission_cents)).toBe(2 * COMMISSION);
    const all = await asUser(GUIDE, (tx) => tx`select promoter_id from sales_by_promoter`);
    expect(all.map((r) => r.promoter_id)).toEqual([GUIDE]);
    const [dep] = await asUser(GUIDE, (tx) => tx`select * from sales_by_departure where departure_id = ${departureId}`);
    expect(Number(dep.revenue_cents)).toBe(2 * PRICE); // nicht 3 × 40 € — die Promoter-Buchung fehlt
    expect(Number(dep.tickets)).toBe(2);
  });

  it("Profile: Guide liest nur das eigene, nicht das des Promoters oder Gabos", async () => {
    const rows = await asUser(GUIDE, (tx) => tx`select id from profiles`);
    expect(rows.map((r) => r.id)).toEqual([GUIDE]);
  });

  it("Zahlungsstatus fremder Buchung: Guide/Promoter → BOOKING_NOT_FOUND, nichts geändert", async () => {
    await expect(setStatusAs(GUIDE, promoterSale, "not_collected")).rejects.toThrow(/BOOKING_NOT_FOUND/);
    await expect(setStatusAs(PROMOTER, guideSale, "fully_paid")).rejects.toThrow(/BOOKING_NOT_FOUND/);
    const [p] = await sql`select payment_status::text as s from bookings where id = ${promoterSale}`;
    const [g] = await sql`select payment_status::text as s from bookings where id = ${guideSale}`;
    expect(p.s).toBe("fully_paid");
    expect(g.s).toBe("deposit_received");
  });

  it("Zahlungsstatus: Guide ändert die eigene Buchung (Audit guide), Gabo jede (Audit network_operator)", async () => {
    await setStatusAs(GUIDE, guideSale, "fully_paid");
    await setStatusAs(OPERATOR, guideSale, "deposit_received");
    const audit = await sql`
      select action::text, actor_role::text, new_values->>'payment_status' as s
      from booking_audit_log where booking_id = ${guideSale} order by id
    `;
    expect(audit).toEqual([
      { action: "sold", actor_role: "guide", s: "deposit_received" },
      { action: "payment_status_set", actor_role: "guide", s: "fully_paid" },
      { action: "payment_status_set", actor_role: "network_operator", s: "deposit_received" },
    ]);
  });
});

describe("Konto-Pflege durch Gabo (profiles, 0013)", () => {
  it("Gabo legt ein Promoter- und ein Guide-Profil an", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into profiles (id, role, display_name, active) values
        (${NEW_A}, 'promoter', 'TEST-t2 neu Promoter', true),
        (${NEW_B}, 'guide', 'TEST-t2 neu Guide', true)
    `);
    const rows = await sql`select id, role::text from profiles where id in (${NEW_A}, ${NEW_B}) order by role::text desc`;
    expect(rows).toEqual([
      { id: NEW_A, role: "promoter" },
      { id: NEW_B, role: "guide" },
    ]);
  });

  it("Gabo legt KEIN network_operator-Profil an (Policy)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`
        insert into profiles (id, role, display_name, active) values (${NEW_C}, 'network_operator', 'TEST-t2 zweiter Gabo', true)
      `),
    ).rejects.toThrow(/row-level security/);
  });

  it("Gabo deaktiviert/aktiviert und benennt ein Guide-Konto um; updated_at läuft mit", async () => {
    const [before] = await sql`select updated_at from profiles where id = ${NEW_B}`;
    const off = await asUser(OPERATOR, (tx) => tx`
      update profiles set active = false, display_name = 'TEST-t2 umbenannt' where id = ${NEW_B} returning id
    `);
    expect(off).toHaveLength(1);
    const [after] = await sql`select active, display_name, updated_at from profiles where id = ${NEW_B}`;
    expect(after.active).toBe(false);
    expect(after.display_name).toBe("TEST-t2 umbenannt");
    expect((after.updated_at as Date).getTime()).toBeGreaterThanOrEqual((before.updated_at as Date).getTime());
    await asUser(OPERATOR, (tx) => tx`update profiles set active = true where id = ${NEW_B}`);
  });

  it("Rolle ist unveränderlich — auch für Gabo (kein UPDATE-Grant auf role)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`update profiles set role = 'promoter' where id = ${NEW_B}`),
    ).rejects.toThrow(/permission denied/);
  });

  it("Gabos eigenes Profil ist über die Policy nicht änderbar (0 Zeilen, bleibt aktiv)", async () => {
    const rows = await asUser(OPERATOR, (tx) => tx`
      update profiles set active = false where id = ${OPERATOR} returning id
    `);
    expect(rows).toHaveLength(0);
    const [o] = await sql`select active from profiles where id = ${OPERATOR}`;
    expect(o.active).toBe(true);
  });

  it("Promoter, Guide, deaktiviert: legen keine Profile an und ändern keine (auch nicht das eigene)", async () => {
    for (const user of [GUIDE, PROMOTER, GUIDE_INACTIVE]) {
      await expect(
        asUser(user, (tx) => tx`
          insert into profiles (id, role, display_name, active) values (${NEW_C}, 'guide', 'TEST-t2 selbst', true)
        `),
      ).rejects.toThrow(/row-level security/);
      const own = await asUser(user, (tx) => tx`update profiles set active = true, display_name = 'x' where id = ${user} returning id`);
      expect(own).toHaveLength(0);
      const other = await asUser(user, (tx) => tx`update profiles set active = false where id = ${NEW_A} returning id`);
      expect(other).toHaveLength(0);
    }
    const [inactive] = await sql`select active from profiles where id = ${GUIDE_INACTIVE}`;
    expect(inactive.active).toBe(false);
    const [a] = await sql`select active from profiles where id = ${NEW_A}`;
    expect(a.active).toBe(true);
  });

  it("anon: kein Recht auf profiles; niemand löscht Profile (kein DELETE-Grant)", async () => {
    await expect(asUser(null, (tx) => tx`select id from profiles`)).rejects.toThrow(/permission denied/);
    await expect(
      asUser(OPERATOR, (tx) => tx`delete from profiles where id = ${NEW_A}`),
    ).rejects.toThrow(/permission denied/);
  });
});
