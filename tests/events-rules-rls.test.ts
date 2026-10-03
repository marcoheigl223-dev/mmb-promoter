import { afterAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E3.1/E3.3 — Migration 0004: Termine/Events, Provisions- und Gruppenregeln.
// Geprüft wird auf DB-Ebene als Supabase-Rolle `authenticated` mit JWT-Claim
// `sub` (wie in tests/profiles-rls.test.ts):
//   * nur network_operator schreibt (Termine, Regeln); Promoter nicht
//   * seats_booked_total ist für authenticated unschreibbar (Hard Rule 4)
//   * Kontingent kann nicht unter seats_booked_total gesenkt werden (E3.3)
//   * Regeln sind append-only: neue Gültigkeit statt Überschreiben (E3.3)
//   * effective_*-Funktionen: Ausnahme schlägt Standard, Gültig-ab-Reihenfolge
//   * anon hat auf keiner Tabelle in public ein Recht (Härtung in 0004)

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
const T_STANDARD_NOW = 12345; // Cent
const T_STANDARD_OLD = 777; // Cent, gültig ab 2000 → darf jetzt nicht gelten
const T_GROUP = { threshold: 912, free: 5 };

afterAll(async () => {
  await sql`delete from commission_rules where departure_id in (select id from tour_departures where title like 'TEST-e3-%')`;
  await sql`delete from commission_rules where departure_id is null and commission_cents in (${T_STANDARD_NOW}, ${T_STANDARD_OLD})`;
  await sql`delete from group_rules where threshold_persons = ${T_GROUP.threshold}`;
  await sql`delete from tour_departures where title like 'TEST-e3-%'`;
  await sql.end();
});

describe("Migration 0004 — Struktur", () => {
  it("RLS aktiv auf commission_rules und group_rules", async () => {
    const rows = await sql`
      select tablename, rowsecurity from pg_tables
      where schemaname = 'public' and tablename in ('commission_rules','group_rules')
      order by tablename
    `;
    expect(rows.map((r) => [r.tablename, r.rowsecurity])).toEqual([
      ["commission_rules", true],
      ["group_rules", true],
    ]);
  });

  it("Startwerte liegen als DATEN vor: Standard 10,00 €/Ticket und 10+1 (ab 16.09.2026)", async () => {
    const [c] = await sql`
      select commission_cents, (valid_from at time zone 'Europe/Madrid')::date::text as d from commission_rules
      where departure_id is null order by valid_from asc, created_at asc limit 1
    `;
    expect(c).toMatchObject({ commission_cents: 1000, d: "2026-09-16" });
    const [g] = await sql`
      select threshold_persons, free_persons from group_rules
      order by valid_from asc, created_at asc limit 1
    `;
    expect(g).toEqual({ threshold_persons: 11, free_persons: 1 });
  });

  it("authenticated: auf tour_departures nur INSERT/UPDATE der Gabo-Spalten, kein DELETE; Regeln nur SELECT/INSERT", async () => {
    const cols = await sql`
      select privilege_type, string_agg(column_name, ',' order by column_name) as cols
      from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'tour_departures' and grantee = 'authenticated'
        and privilege_type in ('INSERT','UPDATE')
      group by privilege_type order by privilege_type
    `;
    const gabo = "capacity_total,image_path,is_internal,note,starts_at,status,title";
    // E5.2 (Migration 0007): Herkunft template_id nur beim Anlegen (INSERT), nie nachträglich (UPDATE).
    const gaboInsert = "capacity_total,image_path,is_internal,note,starts_at,status,template_id,title";
    expect(cols).toEqual([
      { privilege_type: "INSERT", cols: gaboInsert },
      { privilege_type: "UPDATE", cols: gabo },
    ]);
    const tables = await sql`
      select table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.table_privileges
      where table_schema = 'public' and grantee = 'authenticated'
      group by table_name order by table_name
    `;
    // E5.1 (Migration 0006): bookings, booking_audit_log, notifications nur SELECT —
    // geschrieben wird dort ausschließlich über SECURITY-DEFINER-Funktionen (E5.3).
    expect(tables).toEqual([
      { table_name: "booking_audit_log", privs: "SELECT" },
      { table_name: "bookings", privs: "SELECT" },
      { table_name: "commission_rules", privs: "INSERT,SELECT" },
      // E5.2 (Migration 0007): Vorlagen — UPDATE ist spaltenweise (nicht in table_privileges), kein DELETE.
      { table_name: "event_templates", privs: "INSERT,SELECT" },
      { table_name: "group_rules", privs: "INSERT,SELECT" },
      { table_name: "notifications", privs: "SELECT" },
      { table_name: "pricing_rules", privs: "INSERT,SELECT" },
      { table_name: "profiles", privs: "SELECT" },
      // E5.5a (Migration 0011): Auswertungs-Sichten, security_invoker → RLS von bookings gilt.
      { table_name: "sales_by_day", privs: "SELECT" },
      { table_name: "sales_by_departure", privs: "SELECT" },
      { table_name: "sales_by_promoter", privs: "SELECT" },
      { table_name: "sales_totals", privs: "SELECT" },
      { table_name: "tour_departures", privs: "SELECT" },
    ]);
  });

  it("authenticated: auf profiles INSERT nur (id, role, display_name, active), UPDATE nur (active, display_name) — Teil 2, 0013", async () => {
    const cols = await sql`
      select privilege_type, string_agg(column_name, ',' order by column_name) as cols
      from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated'
        and privilege_type in ('INSERT','UPDATE')
      group by privilege_type order by privilege_type
    `;
    // Rolle nur beim Anlegen, danach unveränderlich; kein DELETE (Tabellen-Rechte oben: nur SELECT).
    expect(cols).toEqual([
      { privilege_type: "INSERT", cols: "active,display_name,id,role" },
      { privilege_type: "UPDATE", cols: "active,display_name" },
    ]);
  });

  it("anon hat auf keiner Tabelle in public irgendein Recht (auch kein TRUNCATE mehr)", async () => {
    const rows = await sql`
      select table_name, privilege_type from information_schema.table_privileges
      where table_schema = 'public' and grantee = 'anon'
    `;
    expect(rows).toEqual([]);
    await expect(asUser(null, (tx) => tx`select id from commission_rules`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("Termine/Events — network_operator schreibt, Promoter nicht", () => {
  let departureId: string;

  it("Operator legt ein internes Event mit Kontingent an", async () => {
    const [row] = await asUser(OPERATOR, (tx) => tx`
      insert into tour_departures (title, starts_at, capacity_total, is_internal, note)
      values ('TEST-e3-event', now() + interval '10 days', 10, true, 'nur intern')
      returning id, is_internal, seats_booked_total, status
    `);
    expect(row).toMatchObject({ is_internal: true, seats_booked_total: 0, status: "open" });
    departureId = row.id as string;
  });

  it("Operator ändert Kontingent, Status und Flag", async () => {
    const rows = await asUser(OPERATOR, (tx) => tx`
      update tour_departures set capacity_total = 20, status = 'closed', is_internal = false
      where id = ${departureId} returning capacity_total, status, is_internal
    `);
    expect(rows).toEqual([{ capacity_total: 20, status: "closed", is_internal: false }]);
  });

  it("Operator darf seats_booked_total NICHT schreiben (Spalten-Grant, Hard Rule 4)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`update tour_departures set seats_booked_total = 3 where id = ${departureId}`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(OPERATOR, (tx) => tx`
        insert into tour_departures (title, starts_at, capacity_total, seats_booked_total)
        values ('TEST-e3-spoof', now(), 5, 5)
      `),
    ).rejects.toThrow(/permission denied/);
  });

  it("Operator darf keine Termine löschen (kein Grant) — Absage = status cancelled", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`delete from tour_departures where id = ${departureId}`),
    ).rejects.toThrow(/permission denied/);
    const rows = await asUser(OPERATOR, (tx) => tx`
      update tour_departures set status = 'cancelled' where id = ${departureId} returning status
    `);
    expect(rows).toEqual([{ status: "cancelled" }]);
  });

  it("E3.3: Kontingent kann nicht unter seats_booked_total gesenkt werden", async () => {
    // Gebuchte Plätze setzen wie die Reserve-Funktion es täte (hier direkt als postgres).
    await sql`update tour_departures set seats_booked_total = 5 where id = ${departureId}`;
    await expect(
      asUser(OPERATOR, (tx) => tx`update tour_departures set capacity_total = 4 where id = ${departureId}`),
    ).rejects.toThrow(/total_within_capacity/);
    const rows = await asUser(OPERATOR, (tx) => tx`
      update tour_departures set capacity_total = 5 where id = ${departureId} returning capacity_total, seats_booked_total
    `);
    expect(rows).toEqual([{ capacity_total: 5, seats_booked_total: 5 }]);
  });

  it("Promoter darf weder anlegen noch ändern", async () => {
    await expect(
      asUser(PROMOTER, (tx) => tx`
        insert into tour_departures (title, starts_at, capacity_total) values ('TEST-e3-promoter', now(), 1)
      `),
    ).rejects.toThrow(/row-level security/);
    const rows = await asUser(PROMOTER, (tx) => tx`
      update tour_departures set capacity_total = 999 where id = ${departureId} returning id
    `);
    expect(rows).toEqual([]);
    const [check] = await sql`select capacity_total from tour_departures where id = ${departureId}`;
    expect(check.capacity_total).toBe(5);
  });

  it("deaktiviertes Profil sieht keine Regeln (0 Zeilen)", async () => {
    expect(await asUser(INACTIVE, (tx) => tx`select id from commission_rules`)).toEqual([]);
    expect(await asUser(INACTIVE, (tx) => tx`select id from group_rules`)).toEqual([]);
  });
});

describe("Provisionsregeln — append-only, Ausnahme schlägt Standard", () => {
  let departureId: string;
  let standardBefore: number;

  it("Vorbereitung: Termin + aktueller Standard", async () => {
    const [row] = await asUser(OPERATOR, (tx) => tx`
      insert into tour_departures (title, starts_at, capacity_total, is_internal)
      values ('TEST-e3-commission', now() + interval '3 days', 8, true) returning id
    `);
    departureId = row.id as string;
    const [s] = await sql`select effective_commission_cents(${departureId}::uuid) as c`;
    standardBefore = s.c as number;
    expect(standardBefore).toBeGreaterThanOrEqual(0);
  });

  it("Promoter liest die gültige Regel, darf aber keine anlegen", async () => {
    const [r] = await asUser(PROMOTER, (tx) => tx`select effective_commission_cents(${departureId}::uuid) as c`);
    expect(r.c).toBe(standardBefore);
    await expect(
      asUser(PROMOTER, (tx) => tx`insert into commission_rules (departure_id, commission_cents) values (null, 1)`),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(PROMOTER, (tx) => tx`insert into group_rules (threshold_persons, free_persons) values (5, 1)`),
    ).rejects.toThrow(/row-level security/);
  });

  it("Operator setzt eine Ausnahme für das Event → gilt statt Standard; created_by = Operator", async () => {
    const [ins] = await asUser(OPERATOR, (tx) => tx`
      insert into commission_rules (departure_id, commission_cents) values (${departureId}, 1500)
      returning created_by
    `);
    expect(ins.created_by).toBe(OPERATOR);
    const [r] = await asUser(OPERATOR, (tx) => tx`select effective_commission_cents(${departureId}::uuid) as c`);
    expect(r.c).toBe(1500);
    // Andere Termine unberührt:
    const [o] = await sql`select effective_commission_cents(gen_random_uuid()) as c`;
    expect(o.c).toBe(standardBefore);
  });

  it("created_by lässt sich nicht fälschen (Policy created_by = auth.uid())", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`
        insert into commission_rules (departure_id, commission_cents, created_by) values (${departureId}, 1, ${PROMOTER})
      `),
    ).rejects.toThrow(/row-level security/);
  });

  it("Ausnahme-Zeile mit NULL = wieder Standard: Standard gilt wieder, alte Zeile bleibt", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into commission_rules (departure_id, commission_cents) values (${departureId}, null)
    `);
    const [r] = await sql`select effective_commission_cents(${departureId}::uuid) as c`;
    expect(r.c).toBe(standardBefore);
    const [n] = await sql`select count(*)::int as n from commission_rules where departure_id = ${departureId}`;
    expect(n.n).toBe(2);
  });

  it("Standard-Zeile ohne Betrag ist verboten (Check)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into commission_rules (departure_id, commission_cents) values (null, null)`),
    ).rejects.toThrow(/commission_standard_has_amount/);
  });

  it("E3.3: neuer Standard = neue Gültigkeit, alte Zeile bleibt (UPDATE/DELETE gibt es nicht)", async () => {
    const [before] = await sql`select count(*)::int as n from commission_rules where departure_id is null`;
    await asUser(OPERATOR, (tx) => tx`
      insert into commission_rules (departure_id, commission_cents) values (null, ${T_STANDARD_NOW})
    `);
    const [after] = await sql`select count(*)::int as n from commission_rules where departure_id is null`;
    expect(after.n).toBe((before.n as number) + 1);
    const [r] = await sql`select effective_commission_cents(gen_random_uuid()) as c`;
    expect(r.c).toBe(T_STANDARD_NOW);
    const [old] = await sql`select count(*)::int as n from commission_rules where departure_id is null and commission_cents = 1000`;
    expect(old.n).toBeGreaterThanOrEqual(1);

    await expect(
      asUser(OPERATOR, (tx) => tx`update commission_rules set commission_cents = 1 where departure_id is null`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(OPERATOR, (tx) => tx`delete from commission_rules where departure_id is null`),
    ).rejects.toThrow(/permission denied/);
  });

  it("Gültig-ab entscheidet, nicht die Reihenfolge des Anlegens; Zeitpunkt-Abfrage liefert Historie", async () => {
    await asUser(OPERATOR, (tx) => tx`
      insert into commission_rules (departure_id, commission_cents, valid_from)
      values (null, ${T_STANDARD_OLD}, timestamptz '2000-01-01 00:00:00+01')
    `);
    const [now] = await sql`select effective_commission_cents(gen_random_uuid()) as c`;
    expect(now.c).toBe(T_STANDARD_NOW);
    const [then] = await sql`select effective_commission_cents(gen_random_uuid(), timestamptz '2010-06-01 12:00:00+02') as c`;
    expect(then.c).toBe(T_STANDARD_OLD);
    const [never] = await sql`select effective_commission_cents(gen_random_uuid(), timestamptz '1990-01-01 00:00:00+01') as c`;
    expect(never.c).toBeNull();
  });
});

describe("Gruppenregel (10+1) — append-only, Gabo-pflegbar", () => {
  it("Operator legt neue Regel an → gilt sofort, alte bleibt; UPDATE/DELETE verboten", async () => {
    const [before] = await sql`select count(*)::int as n from group_rules`;
    await asUser(OPERATOR, (tx) => tx`
      insert into group_rules (threshold_persons, free_persons) values (${T_GROUP.threshold}, ${T_GROUP.free})
    `);
    const [after] = await sql`select count(*)::int as n from group_rules`;
    expect(after.n).toBe((before.n as number) + 1);
    const [r] = await asUser(PROMOTER, (tx) => tx`select * from effective_group_rule()`);
    expect(r).toEqual({ threshold_persons: T_GROUP.threshold, free_persons: T_GROUP.free });
    const [orig] = await sql`select count(*)::int as n from group_rules where threshold_persons = 11 and free_persons = 1`;
    expect(orig.n).toBeGreaterThanOrEqual(1);

    await expect(
      asUser(OPERATOR, (tx) => tx`update group_rules set free_persons = 0 where threshold_persons = ${T_GROUP.threshold}`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(OPERATOR, (tx) => tx`delete from group_rules where threshold_persons = ${T_GROUP.threshold}`),
    ).rejects.toThrow(/permission denied/);
  });

  it("Gratisplätze >= Schwelle ist verboten (Check)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into group_rules (threshold_persons, free_persons) values (${T_GROUP.threshold}, ${T_GROUP.threshold})`),
    ).rejects.toThrow(/group_free_below_threshold/);
  });
});
