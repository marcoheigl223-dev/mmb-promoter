import { afterAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E5.2 — Migration 0007: Eventvorlagen (Auftrag Marco 02.10.2026).
// Geprüft wird auf DB-Ebene als Supabase-Rolle `authenticated` mit JWT-Claim
// `sub` (wie in tests/events-rules-rls.test.ts / pricing-rules-rls.test.ts):
//   * RLS deny-by-default: nur network_operator sieht/pflegt Vorlagen
//     (SELECT/INSERT/Spalten-UPDATE, kein DELETE); Promoter/inaktiv/anon nichts
//   * created_by nicht fälschbar, updated_at per Trigger
//   * Checks: Kontingent ≥ 0, Beträge ≥ 0, Anzahlung ≤ Preis (wenn beide gesetzt), Name nicht leer
//   * create_departure_from_template(): kopiert Titel/Kontingent/intern/Notiz,
//     schreibt Preis-/Anzahlungs-/Provisions-Ausnahmen, setzt template_id;
//     spätere Vorlagen-Änderung berührt das Event NICHT (Plan D7);
//     NULL-Beträge → keine Regel-Zeilen; inaktiv/unbekannt/ohne Datum → klare Fehler;
//     Promoter → NOT_ALLOWED
//   * tour_departures.template_id: INSERT-Grant ja, UPDATE nein (Herkunft bleibt)
//   * Reserve-Funktion aus 0002 unberührt (eigener Identitätstest läuft weiter)

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
const T_PRICE = 4500;
const T_DEPOSIT = 2000;
const T_COMMISSION = 1250;

afterAll(async () => {
  // Reihenfolge: erst Termine (Preis-/Provisions-Ausnahmen fallen per CASCADE), dann Vorlagen.
  await sql`delete from tour_departures where title like 'TEST-e52-%'`;
  await sql`delete from event_templates where name like 'TEST-e52-%'`;
  await sql.end();
});

describe("Migration 0007 — Struktur und Rechte", () => {
  it("RLS aktiv, Trigger für updated_at nur auf event_templates, Herkunfts-Spalte am Termin", async () => {
    const [t] = await sql`select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'event_templates'`;
    expect(t).toEqual({ rowsecurity: true });
    const triggers = await sql`
      select event_object_table as t, trigger_name as n from information_schema.triggers
      where trigger_schema = 'public' and trigger_name = 'event_templates_set_updated_at'
    `;
    expect(triggers).toEqual([{ t: "event_templates", n: "event_templates_set_updated_at" }]);
    const [col] = await sql`
      select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'tour_departures' and column_name = 'template_id'
    `;
    expect(col).toEqual({ is_nullable: "YES" });
    const [fk] = await sql`
      select confdeltype from pg_constraint
      where conrelid = 'public.tour_departures'::regclass and contype = 'f'
        and confrelid = 'public.event_templates'::regclass
    `;
    expect(fk).toEqual({ confdeltype: "n" }); // on delete set null
  });

  it("authenticated: SELECT/INSERT + UPDATE nur auf Pflege-Spalten, kein DELETE; anon: nichts", async () => {
    const privs = await sql`
      select string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.table_privileges
      where table_schema = 'public' and table_name = 'event_templates' and grantee = 'authenticated'
    `;
    expect(privs).toEqual([{ privs: "INSERT,SELECT" }]);
    const cols = await sql`
      select string_agg(column_name, ',' order by column_name) as cols
      from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'event_templates' and grantee = 'authenticated'
        and privilege_type = 'UPDATE'
    `;
    expect(cols).toEqual([
      { cols: "active,capacity_total,commission_cents,deposit_cents,image_path,is_internal,name,note,ticket_price_cents,title" },
    ]);
    const anon = await sql`
      select privilege_type from information_schema.table_privileges
      where table_schema = 'public' and table_name = 'event_templates' and grantee = 'anon'
    `;
    expect(anon).toEqual([]);
    await expect(asUser(null, (tx) => tx`select id from event_templates`)).rejects.toThrow(/permission denied/);
    await expect(
      asUser(null, (tx) => tx`select create_departure_from_template(gen_random_uuid(), now())`),
    ).rejects.toThrow(/permission denied/);
  });

  it("tour_departures.template_id: INSERT-Grant ja, UPDATE-Grant nein (Herkunft bleibt)", async () => {
    const rows = await sql`
      select privilege_type from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'tour_departures' and grantee = 'authenticated'
        and column_name = 'template_id' order by privilege_type
    `;
    expect(rows).toEqual([{ privilege_type: "INSERT" }, { privilege_type: "SELECT" }]);
  });
});

describe("Vorlagen — nur network_operator sieht und pflegt", () => {
  let templateId: string;

  it("Operator legt eine Vorlage an: created_by = Operator, aktiv, updated_at = created_at", async () => {
    const [row] = await asUser(OPERATOR, (tx) => tx`
      insert into event_templates (name, title, capacity_total, is_internal, note, ticket_price_cents, deposit_cents, commission_cents)
      values ('TEST-e52-vorlage', 'TEST-e52-event', 12, true, 'Notiz aus Vorlage', ${T_PRICE}, ${T_DEPOSIT}, ${T_COMMISSION})
      returning id, created_by, active, (updated_at = created_at) as fresh
    `);
    expect(row.created_by).toBe(OPERATOR);
    expect(row.active).toBe(true);
    expect(row.fresh).toBe(true);
    templateId = row.id as string;
  });

  it("Promoter und deaktiviertes Profil sehen keine Vorlage und können weder anlegen noch ändern", async () => {
    expect(await asUser(PROMOTER, (tx) => tx`select id from event_templates`)).toEqual([]);
    expect(await asUser(INACTIVE, (tx) => tx`select id from event_templates`)).toEqual([]);
    for (const who of [PROMOTER, INACTIVE]) {
      await expect(
        asUser(who, (tx) => tx`insert into event_templates (name, title, capacity_total) values ('TEST-e52-fremd', 'x', 1)`),
      ).rejects.toThrow(/row-level security/);
      // UPDATE trifft wegen der SELECT-Policy keine Zeile (0 statt Fehler) — Vorlage bleibt unverändert.
      const touched = await asUser(who, (tx) => tx`update event_templates set capacity_total = 99 where id = ${templateId} returning id`);
      expect(touched).toEqual([]);
    }
    const [t] = await sql`select capacity_total from event_templates where id = ${templateId}`;
    expect(t.capacity_total).toBe(12);
  });

  it("created_by lässt sich nicht fälschen (Policy created_by = auth.uid())", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`
        insert into event_templates (name, title, capacity_total, created_by) values ('TEST-e52-fake', 'x', 1, ${PROMOTER})
      `),
    ).rejects.toThrow(/row-level security/);
  });

  it("Operator ändert die Vorlage → updated_at rückt vor; created_by/created_at sind nicht schreibbar", async () => {
    const [before] = await sql`select updated_at from event_templates where id = ${templateId}`;
    const [row] = await asUser(OPERATOR, (tx) => tx`
      update event_templates set capacity_total = 15, note = 'geändert' where id = ${templateId}
      returning capacity_total, (updated_at > created_at) as bumped, updated_at
    `);
    expect(row.capacity_total).toBe(15);
    expect(row.bumped).toBe(true);
    expect(new Date(row.updated_at as string).getTime()).toBeGreaterThan(new Date(before.updated_at as string).getTime());
    await expect(
      asUser(OPERATOR, (tx) => tx`update event_templates set created_by = ${PROMOTER} where id = ${templateId}`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(OPERATOR, (tx) => tx`update event_templates set created_at = now() where id = ${templateId}`),
    ).rejects.toThrow(/permission denied/);
  });

  it("DELETE gibt es für authenticated nicht — deaktivieren statt löschen", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`delete from event_templates where id = ${templateId}`),
    ).rejects.toThrow(/permission denied/);
  });

  it("Checks: Kontingent ≥ 0, Beträge ≥ 0, Anzahlung ≤ Preis (nur wenn beide gesetzt), Name nicht leer", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into event_templates (name, title, capacity_total) values ('TEST-e52-x', 'x', -1)`),
    ).rejects.toThrow(/capacity_total_check/);
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into event_templates (name, title, capacity_total, commission_cents) values ('TEST-e52-x', 'x', 1, -1)`),
    ).rejects.toThrow(/commission_cents_check/);
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into event_templates (name, title, capacity_total, ticket_price_cents, deposit_cents) values ('TEST-e52-x', 'x', 1, 100, 101)`),
    ).rejects.toThrow(/template_deposit_within_price/);
    await expect(
      asUser(OPERATOR, (tx) => tx`insert into event_templates (name, title, capacity_total) values ('   ', 'x', 1)`),
    ).rejects.toThrow(/event_templates_name_check/);
    // Nur Anzahlung gesetzt (Preis = Standard): der DB-Check greift nicht, das prüft die App gegen den Standard.
    const [ok] = await asUser(OPERATOR, (tx) => tx`
      insert into event_templates (name, title, capacity_total, deposit_cents) values ('TEST-e52-nur-anzahlung', 'x', 1, 999999) returning id
    `);
    expect(ok.id).toBeTruthy();
  });
});

describe("Event aus Vorlage — Werte werden kopiert (Plan D7)", () => {
  let templateId: string;
  let departureId: string;

  it("Vorbereitung: Vorlage mit allen Beträgen", async () => {
    const [row] = await asUser(OPERATOR, (tx) => tx`
      insert into event_templates (name, title, capacity_total, is_internal, note, ticket_price_cents, deposit_cents, commission_cents)
      values ('TEST-e52-kopie', 'TEST-e52-kopie-event', 20, true, 'Notiz', ${T_PRICE}, ${T_DEPOSIT}, ${T_COMMISSION})
      returning id
    `);
    templateId = row.id as string;
  });

  it("Operator legt ein Event aus der Vorlage an: Titel, Kontingent, intern, Notiz, Herkunft; Beträge als Termin-Ausnahmen", async () => {
    const [r] = await asUser(OPERATOR, (tx) => tx`
      select create_departure_from_template(${templateId}::uuid, timestamptz '2027-07-01 10:30:00+02') as id
    `);
    departureId = r.id as string;
    const [d] = await sql`
      select title, capacity_total, seats_booked_total, status, is_internal, note, template_id,
             (starts_at = timestamptz '2027-07-01 10:30:00+02') as when_ok
      from tour_departures where id = ${departureId}
    `;
    expect(d).toEqual({
      title: "TEST-e52-kopie-event",
      capacity_total: 20,
      seats_booked_total: 0,
      status: "open",
      is_internal: true,
      note: "Notiz",
      template_id: templateId,
      when_ok: true,
    });
    const rules = await sql`
      select kind::text as kind, amount_cents, created_by from pricing_rules where departure_id = ${departureId} order by kind
    `;
    expect(rules).toEqual([
      { kind: "deposit", amount_cents: T_DEPOSIT, created_by: OPERATOR },
      { kind: "ticket_price", amount_cents: T_PRICE, created_by: OPERATOR },
    ]);
    const commission = await sql`
      select commission_cents, created_by from commission_rules where departure_id = ${departureId}
    `;
    expect(commission).toEqual([{ commission_cents: T_COMMISSION, created_by: OPERATOR }]);
    const [eff] = await sql`
      select effective_price_cents('ticket_price', ${departureId}::uuid) as price,
             effective_price_cents('deposit', ${departureId}::uuid) as deposit,
             effective_commission_cents(${departureId}::uuid) as commission
    `;
    expect(eff).toEqual({ price: T_PRICE, deposit: T_DEPOSIT, commission: T_COMMISSION });
  });

  it("Status ist wählbar (z. B. geschlossen anlegen)", async () => {
    const [r] = await asUser(OPERATOR, (tx) => tx`
      select create_departure_from_template(${templateId}::uuid, now() + interval '9 days', 'closed') as id
    `);
    const [d] = await sql`select status, title from tour_departures where id = ${r.id as string}`;
    expect(d).toEqual({ status: "closed", title: "TEST-e52-kopie-event" });
  });

  it("Spätere Änderung der Vorlage berührt das Event NICHT (Werte kopiert, kein Live-Bezug)", async () => {
    await asUser(OPERATOR, (tx) => tx`
      update event_templates set title = 'TEST-e52-kopie-neu', capacity_total = 99, ticket_price_cents = 9999, commission_cents = null
      where id = ${templateId}
    `);
    const [d] = await sql`select title, capacity_total from tour_departures where id = ${departureId}`;
    expect(d).toEqual({ title: "TEST-e52-kopie-event", capacity_total: 20 });
    const [eff] = await sql`
      select effective_price_cents('ticket_price', ${departureId}::uuid) as price,
             effective_commission_cents(${departureId}::uuid) as commission
    `;
    expect(eff).toEqual({ price: T_PRICE, commission: T_COMMISSION });
  });

  it("Vorlage ohne eigene Beträge → keine Regel-Zeilen, es gilt der Standard", async () => {
    const [t] = await asUser(OPERATOR, (tx) => tx`
      insert into event_templates (name, title, capacity_total) values ('TEST-e52-standard', 'TEST-e52-standard-event', 5) returning id
    `);
    const [r] = await asUser(OPERATOR, (tx) => tx`
      select create_departure_from_template(${t.id as string}::uuid, now() + interval '10 days') as id
    `);
    const [n] = await sql`
      select (select count(*) from pricing_rules where departure_id = ${r.id as string})::int as p,
             (select count(*) from commission_rules where departure_id = ${r.id as string})::int as c
    `;
    expect(n).toEqual({ p: 0, c: 0 });
    const [eff] = await sql`
      select effective_price_cents('deposit', ${r.id as string}::uuid) as d1,
             effective_price_cents('deposit', gen_random_uuid()) as d2,
             effective_commission_cents(${r.id as string}::uuid) as c1,
             effective_commission_cents(gen_random_uuid()) as c2
    `;
    expect(eff.d1).toBe(eff.d2);
    expect(eff.c1).toBe(eff.c2);
  });

  it("Deaktivierte Vorlage → TEMPLATE_INACTIVE; unbekannte → TEMPLATE_NOT_FOUND; ohne Datum → STARTS_AT_REQUIRED", async () => {
    await asUser(OPERATOR, (tx) => tx`update event_templates set active = false where id = ${templateId}`);
    await expect(
      asUser(OPERATOR, (tx) => tx`select create_departure_from_template(${templateId}::uuid, now() + interval '1 day')`),
    ).rejects.toThrow(/TEMPLATE_INACTIVE/);
    await expect(
      asUser(OPERATOR, (tx) => tx`select create_departure_from_template(gen_random_uuid(), now() + interval '1 day')`),
    ).rejects.toThrow(/TEMPLATE_NOT_FOUND/);
    await expect(
      asUser(OPERATOR, (tx) => tx`select create_departure_from_template(${templateId}::uuid, null)`),
    ).rejects.toThrow(/STARTS_AT_REQUIRED/);
    // Nichts angelegt:
    const [n] = await sql`select count(*)::int as n from tour_departures where template_id = ${templateId}`;
    expect(n.n).toBe(2);
    // Wieder aktiv → geht wieder.
    await asUser(OPERATOR, (tx) => tx`update event_templates set active = true where id = ${templateId}`);
    const [r] = await asUser(OPERATOR, (tx) => tx`
      select create_departure_from_template(${templateId}::uuid, now() + interval '11 days') as id
    `);
    expect(r.id).toBeTruthy();
  });

  it("Promoter und deaktiviertes Profil → NOT_ALLOWED (42501), kein Termin entsteht", async () => {
    const [before] = await sql`select count(*)::int as n from tour_departures where title like 'TEST-e52-%'`;
    for (const who of [PROMOTER, INACTIVE]) {
      await expect(
        asUser(who, (tx) => tx`select create_departure_from_template(${templateId}::uuid, now() + interval '1 day')`),
      ).rejects.toThrow(/NOT_ALLOWED/);
    }
    const [after] = await sql`select count(*)::int as n from tour_departures where title like 'TEST-e52-%'`;
    expect(after.n).toBe(before.n);
  });

  it("Herkunft (template_id) ist nachträglich nicht änderbar — auch nicht vom Operator", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`update tour_departures set template_id = null where id = ${departureId}`),
    ).rejects.toThrow(/permission denied/);
    // Die Gabo-Spalten bleiben änderbar:
    const [d] = await asUser(OPERATOR, (tx) => tx`
      update tour_departures set capacity_total = 21 where id = ${departureId} returning capacity_total, template_id
    `);
    expect(d).toEqual({ capacity_total: 21, template_id: templateId });
  });

  it("Ein Event überlebt das Löschen seiner Vorlage (FK on delete set null; Werte bleiben)", async () => {
    const [t] = await asUser(OPERATOR, (tx) => tx`
      insert into event_templates (name, title, capacity_total, commission_cents) values ('TEST-e52-weg', 'TEST-e52-weg-event', 3, 777) returning id
    `);
    const [r] = await asUser(OPERATOR, (tx) => tx`
      select create_departure_from_template(${t.id as string}::uuid, now() + interval '12 days') as id
    `);
    await sql`delete from event_templates where id = ${t.id as string}`; // nur als postgres/service_role möglich
    const [d] = await sql`
      select template_id, capacity_total, effective_commission_cents(id) as commission from tour_departures where id = ${r.id as string}
    `;
    expect(d).toEqual({ template_id: null, capacity_total: 3, commission: 777 });
  });
});
