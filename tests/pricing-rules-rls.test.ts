import { afterAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E3.4 (F14) — Migration 0005: Ticketpreis und Anzahlung pro Person als DATEN.
// Geprüft wird auf DB-Ebene als Supabase-Rolle `authenticated` mit JWT-Claim
// `sub` (wie in tests/events-rules-rls.test.ts):
//   * Startwert Anzahlung 30,00 €/Person ab 16.09.2026 liegt als Daten vor;
//     KEIN Startwert für den Ticketpreis (nicht dokumentiert → RISKS F15)
//   * nur network_operator schreibt; Promoter liest; inaktiv sieht nichts; anon nichts
//   * append-only: UPDATE/DELETE für authenticated gar nicht gegrantet
//   * effective_price_cents(): eigener Wert pro Termin schlägt Standard,
//     NULL-Ausnahme = wieder Standard, Gültig-ab-Reihenfolge, Zeitpunkt-Abfrage
//   * Checks: Standard ohne Betrag verboten, negative Beträge verboten
//   * created_by nicht fälschbar

const OPERATOR = "11111111-1111-4111-8111-111111111111";
const PROMOTER = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "33333333-3333-4333-8333-333333333333";

const sql = connect(1);

type Row = Record<string, unknown>;

async function asUser<T extends Row[]>(
  userId: string | null,
  query: (tx: typeof sql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    if (userId) {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    } else {
      await tx`set local role anon`;
    }
    return query(tx as unknown as typeof sql);
  }) as Promise<T>;
}

// Eindeutige Testwerte, damit das Aufräumen nichts Echtes trifft.
const T_PRICE_STD = 98765; // Cent — Standard-Ticketpreis nur für diesen Test (gültig ab jetzt)
const T_PRICE_OLD = 54321; // Cent — Standard-Ticketpreis gültig ab 2000 → darf jetzt nicht gelten
const T_DEPOSIT_STD = 4321; // Cent — Standard-Anzahlung nur für diesen Test
const T_PRICE_OVERRIDE = 5555;
const T_DEPOSIT_OVERRIDE = 1234;

afterAll(async () => {
  // Termin-Ausnahmen fallen per ON DELETE CASCADE mit dem Termin weg.
  await sql`delete from tour_departures where title like 'TEST-f14-%'`;
  await sql`delete from pricing_rules where departure_id is null and amount_cents in (${T_PRICE_STD}, ${T_PRICE_OLD}, ${T_DEPOSIT_STD})`;
  await sql.end();
});

describe("Migration 0005 — Struktur und Startwerte", () => {
  it("RLS aktiv, Enum pricing_kind = ticket_price | deposit", async () => {
    const [t] = await sql`select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'pricing_rules'`;
    expect(t).toEqual({ rowsecurity: true });
    const kinds = await sql`select unnest(enum_range(null::pricing_kind))::text as k`;
    expect(kinds.map((r) => r.k)).toEqual(["ticket_price", "deposit"]);
  });

  it("Startwert als DATEN: Anzahlung 30,00 €/Person ab 16.09.2026 (aus der Migration, created_by NULL)", async () => {
    const rows = await sql`
      select amount_cents, (valid_from at time zone 'Europe/Madrid')::date::text as d
      from pricing_rules
      where kind = 'deposit' and departure_id is null and created_by is null
      order by valid_from asc, created_at asc
    `;
    expect(rows[0]).toEqual({ amount_cents: 3000, d: "2026-09-16" });
    const [r] = await sql`select effective_price_cents('deposit', gen_random_uuid(), timestamptz '2026-09-16 12:00:00+02') as c`;
    expect(r.c).toBe(3000);
  });

  it("KEIN Startwert für den Ticketpreis (Hard Rule 5, RISKS F15) — vor 16.09.2026 ist auch die Anzahlung NULL", async () => {
    const [seeded] = await sql`
      select count(*)::int as n from pricing_rules
      where kind = 'ticket_price' and departure_id is null and created_by is null
    `;
    expect(seeded.n).toBe(0);
    const [r] = await sql`select effective_price_cents('ticket_price', gen_random_uuid(), timestamptz '2026-09-16 12:00:00+02') as c`;
    expect(r.c).toBeNull();
    const [d] = await sql`select effective_price_cents('deposit', gen_random_uuid(), timestamptz '2026-09-15 12:00:00+02') as c`;
    expect(d.c).toBeNull();
  });

  it("authenticated: nur SELECT/INSERT; anon: nichts (auch die Funktion nicht)", async () => {
    const privs = await sql`
      select string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.table_privileges
      where table_schema = 'public' and table_name = 'pricing_rules' and grantee = 'authenticated'
    `;
    expect(privs).toEqual([{ privs: "INSERT,SELECT" }]);
    const anon = await sql`
      select privilege_type from information_schema.table_privileges
      where table_schema = 'public' and table_name = 'pricing_rules' and grantee = 'anon'
    `;
    expect(anon).toEqual([]);
    await expect(asUser(null, (tx) => tx`select id from pricing_rules`)).rejects.toThrow(/permission denied/);
    await expect(
      asUser(null, (tx) => tx`select effective_price_cents('deposit', gen_random_uuid()) as c`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Preis/Anzahlung — nur network_operator schreibt, append-only", () => {
  let departureId: string;

  it("Vorbereitung: Operator legt ein internes Event an", async () => {
    const [row] = await asUser(OPERATOR, (tx) => tx`
      insert into tour_departures (title, starts_at, capacity_total, is_internal)
      values ('TEST-f14-event', now() + interval '5 days', 12, true) returning id
    `);
    departureId = row.id as string;
  });

  it("Operator setzt einen Standard-Ticketpreis → gilt sofort für alle Termine; created_by = Operator", async () => {
    const [ins] = await asUser(OPERATOR, (tx) => tx`
      insert into pricing_rules (kind, departure_id, amount_cents) values ('ticket_price', null, ${T_PRICE_STD})
      returning created_by
    `);
    expect(ins.created_by).toBe(OPERATOR);
    const [r] = await asUser(OPERATOR, (tx) => tx`select effective_price_cents('ticket_price', ${departureId}::uuid) as c`);
    expect(r.c).toBe(T_PRICE_STD);
    const [o] = await sql`select effective_price_cents('ticket_price', gen_random_uuid()) as c`;
    expect(o.c).toBe(T_PRICE_STD);
  });

  it("Promoter liest Preis und Anzahlung (braucht E5), darf aber nichts anlegen", async () => {
    const [p] = await asUser(PROMOTER, (tx) => tx`select effective_price_cents('ticket_price', ${departureId}::uuid) as c`);
    expect(p.c).toBe(T_PRICE_STD);
    const rows = await asUser(PROMOTER, (tx) => tx`select id from pricing_rules where kind = 'deposit' and departure_id is null`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await expect(
      asUser(PROMOTER, (tx) => tx`insert into pricing_rules (kind, departure_id, amount_cents) values ('deposit', null, 1)`),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(PROMOTER, (tx) => tx`insert into pricing_rules (kind, departure_id, amount_cents) values ('deposit', ${departureId}, 1)`),
    ).rejects.toThrow(/row-level security/);
  });

  it("deaktiviertes Profil sieht keine Zeilen — und damit auch keinen Betrag (security invoker)", async () => {
    expect(await asUser(INACTIVE, (tx) => tx`select id from pricing_rules`)).toEqual([]);
    const [r] = await asUser(INACTIVE, (tx) => tx`select effective_price_cents('deposit', gen_random_uuid()) as c`);
    expect(r.c).toBeNull();
  });

  it("Eigener Preis UND eigene Anzahlung für das Event schlagen den Standard; andere Termine unberührt", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into pricing_rules (kind, departure_id, amount_cents) values
        ('ticket_price', ${departureId}, ${T_PRICE_OVERRIDE}),
        ('deposit', ${departureId}, ${T_DEPOSIT_OVERRIDE})
    `);
    const [r] = await asUser(PROMOTER, (tx) => tx`
      select effective_price_cents('ticket_price', ${departureId}::uuid) as price,
             effective_price_cents('deposit', ${departureId}::uuid) as deposit
    `);
    expect(r).toEqual({ price: T_PRICE_OVERRIDE, deposit: T_DEPOSIT_OVERRIDE });
    const [o] = await sql`
      select effective_price_cents('ticket_price', gen_random_uuid()) as price,
             effective_price_cents('deposit', gen_random_uuid()) as deposit
    `;
    expect(o.price).toBe(T_PRICE_STD);
    expect(o.deposit).not.toBe(T_DEPOSIT_OVERRIDE);
  });

  it("created_by lässt sich nicht fälschen (Policy created_by = auth.uid())", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`
        insert into pricing_rules (kind, departure_id, amount_cents, created_by) values ('deposit', ${departureId}, 1, ${PROMOTER})
      `),
    ).rejects.toThrow(/row-level security/);
  });

  it("Ausnahme-Zeile mit NULL = wieder Standard; alte Zeilen bleiben", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into pricing_rules (kind, departure_id, amount_cents) values ('ticket_price', ${departureId}, null)
    `);
    const [r] = await sql`
      select effective_price_cents('ticket_price', ${departureId}::uuid) as price,
             effective_price_cents('deposit', ${departureId}::uuid) as deposit
    `;
    expect(r).toEqual({ price: T_PRICE_STD, deposit: T_DEPOSIT_OVERRIDE });
    const [n] = await sql`select count(*)::int as n from pricing_rules where departure_id = ${departureId}`;
    expect(n.n).toBe(3);
  });

  it("Standard-Zeile ohne Betrag und negative Beträge sind verboten (Checks)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into pricing_rules (kind, departure_id, amount_cents) values ('ticket_price', null, null)`),
    ).rejects.toThrow(/pricing_standard_has_amount/);
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into pricing_rules (kind, departure_id, amount_cents) values ('deposit', ${departureId}, -1)`),
    ).rejects.toThrow(/amount_cents_check/);
  });

  it("UPDATE/DELETE gibt es für authenticated nicht — Historie bleibt vollständig", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`update pricing_rules set amount_cents = 1 where departure_id = ${departureId}`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(OPERATOR, (tx) => tx`delete from pricing_rules where departure_id = ${departureId}`),
    ).rejects.toThrow(/permission denied/);
  });

  it("Neuer Standard-Betrag für die Anzahlung = neue Zeile, die 30,00-€-Zeile bleibt", async () => {
    const [before] = await sql`select count(*)::int as n from pricing_rules where kind = 'deposit' and departure_id is null`;
    await asUser(OPERATOR, (tx) => tx`
      insert into pricing_rules (kind, departure_id, amount_cents) values ('deposit', null, ${T_DEPOSIT_STD})
    `);
    const [after] = await sql`select count(*)::int as n from pricing_rules where kind = 'deposit' and departure_id is null`;
    expect(after.n).toBe((before.n as number) + 1);
    const [r] = await sql`select effective_price_cents('deposit', gen_random_uuid()) as c`;
    expect(r.c).toBe(T_DEPOSIT_STD);
    // Das Event behält seine eigene Anzahlung:
    const [e] = await sql`select effective_price_cents('deposit', ${departureId}::uuid) as c`;
    expect(e.c).toBe(T_DEPOSIT_OVERRIDE);
    const [orig] = await sql`select count(*)::int as n from pricing_rules where kind = 'deposit' and departure_id is null and amount_cents = 3000`;
    expect(orig.n).toBeGreaterThanOrEqual(1);
  });

  it("Gültig-ab entscheidet, nicht die Reihenfolge des Anlegens; Zeitpunkt-Abfrage liefert Historie", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into pricing_rules (kind, departure_id, amount_cents, valid_from)
      values ('ticket_price', null, ${T_PRICE_OLD}, timestamptz '2000-01-01 00:00:00+01')
    `);
    const [now] = await sql`select effective_price_cents('ticket_price', gen_random_uuid()) as c`;
    expect(now.c).toBe(T_PRICE_STD);
    const [then] = await sql`select effective_price_cents('ticket_price', gen_random_uuid(), timestamptz '2010-06-01 12:00:00+02') as c`;
    expect(then.c).toBe(T_PRICE_OLD);
    const [never] = await sql`select effective_price_cents('ticket_price', gen_random_uuid(), timestamptz '1990-01-01 00:00:00+01') as c`;
    expect(never.c).toBeNull();
  });

  it("Termin-Ausnahme mit Gültig-ab in der Zukunft gilt noch nicht", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into pricing_rules (kind, departure_id, amount_cents, valid_from)
      values ('deposit', ${departureId}, 9999, now() + interval '30 days')
    `);
    const [r] = await sql`select effective_price_cents('deposit', ${departureId}::uuid) as c`;
    expect(r.c).toBe(T_DEPOSIT_OVERRIDE);
    const [later] = await sql`select effective_price_cents('deposit', ${departureId}::uuid, now() + interval '31 days') as c`;
    expect(later.c).toBe(9999);
  });
});
