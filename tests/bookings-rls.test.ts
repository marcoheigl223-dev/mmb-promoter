import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E5.1 — Migration 0006: Datenmodell Promoter-Verkauf (nur Strukturen, keine
// Verkaufs-Funktion). Geprüft wird auf DB-Ebene als Supabase-Rolle `authenticated`
// mit JWT-Claim `sub` (wie in tests/events-rules-rls.test.ts):
//   * neue Spalten/Enums/Tabellen existieren; amount_due_cents ist generiert
//   * Grants: authenticated hat auf bookings, booking_audit_log, notifications
//     NUR SELECT (schreiben darf aus der App niemand); anon nichts
//   * RLS: Promoter liest nur eigene Buchungen (+ deren Audit/Nachrichten),
//     network_operator alles, deaktiviertes Profil nichts, anon permission denied
//   * Checks: Promoter-Buchung muss vollständig sein (Hard Rule 7), Zahlungsstatus
//     passt zu den Beträgen, Sitze = bezahlt + gratis, Storno-Felder gehören zusammen,
//     Idempotenz-Schlüssel eindeutig, Nachricht pro Buchung und Art nur einmal
//   * Handover-Funktion reserve_departure_seats() schreibt weiterhin (Hard Rule 4;
//     der 8-parallel-Test steht in tests/overbooking.test.ts)
// Zeilen werden als `postgres` (Superuser, umgeht RLS) angelegt — so, wie es später
// die SECURITY-DEFINER-Funktionen aus E5.3 tun. Aufräumen in afterAll.

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

let departureId: string;
let ownBookingId: string; // Promoter-Verkauf von PROMOTER (Anzahlung)
let otherBookingId: string; // Promoter-Verkauf von INACTIVE (voll bezahlt)
let onlineBookingId: string; // Online-Buchung der Handover-Funktion

/** Vollständige Promoter-Buchung: 3 Personen, 40 € Ticket, 30 € Anzahlung, 10 € Provision. */
function promoterRow(overrides: Row = {}): Row {
  return {
    departure_id: departureId,
    channel: "promoter",
    payment_type: "deposit",
    seats: 3,
    paid_seats: 3,
    free_persons: 0,
    total_amount_cents: 12000,
    amount_paid_cents: 9000,
    status: "confirmed",
    customer_name: "TEST-e51 Kunde",
    customer_email: "e51@example.invalid",
    customer_phone: "+00 000 000 001",
    promoter_id: PROMOTER,
    idempotency_key: crypto.randomUUID(),
    ticket_price_cents_snapshot: 4000,
    deposit_amount_cents_snapshot: 3000,
    commission_per_ticket_cents_snapshot: 1000,
    group_threshold_snapshot: 11,
    group_free_snapshot: 1,
    commission_total_cents: 3000,
    payment_status: "deposit_received",
    // seit 0010 (E5.4): vereinbarte Anzahlung + Basis pro Buchung
    deposit_basis: "paying_persons",
    deposit_total_cents: 9000,
    sold_at: new Date(),
    ...overrides,
  };
}

async function insertBooking(row: Row): Promise<string> {
  const [b] = await sql`insert into bookings ${sql(row)} returning id`;
  return b.id as string;
}

beforeAll(async () => {
  const [d] = await sql`
    insert into tour_departures (title, starts_at, capacity_total, status)
    values ('TEST-e51-bookings', now() + interval '10 days', 30, 'open')
    returning id
  `;
  departureId = d.id as string;
  ownBookingId = await insertBooking(promoterRow());
  otherBookingId = await insertBooking(
    promoterRow({
      promoter_id: INACTIVE,
      payment_type: "full",
      amount_paid_cents: 12000,
      payment_status: "fully_paid",
      deposit_amount_cents_snapshot: null,
      deposit_basis: null,
      deposit_total_cents: null,
    }),
  );
  // Online-Buchung über die unveränderte Handover-Funktion (Hard Rule 4)
  const [o] = await sql`
    select (reserve_departure_seats(${departureId}::uuid, 2, 8000, 8000, 'TEST-e51 Online', 'e51-online@example.invalid', null, null, false, false, null)).id as id
  `;
  onlineBookingId = o.id as string;
  for (const [bookingId, actor] of [
    [ownBookingId, PROMOTER],
    [otherBookingId, INACTIVE],
  ]) {
    await sql`
      insert into booking_audit_log (booking_id, action, actor_id, actor_role, new_values)
      values (${bookingId}, 'sold', ${actor}, 'promoter', '{"status":"confirmed"}')
    `;
    await sql`
      insert into notifications (booking_id, kind, recipient_name, scheduled_for)
      values (${bookingId}, 'booking_confirmation', 'TEST-e51 Kunde', now()),
             (${bookingId}, 'reminder_4h', 'TEST-e51 Kunde', now() + interval '10 days' - interval '4 hours')
    `;
  }
});

afterAll(async () => {
  // Audit-Log und Nachrichten fallen per ON DELETE CASCADE mit der Buchung weg.
  await sql`delete from bookings where departure_id = ${departureId}`;
  await sql`delete from tour_departures where id = ${departureId}`;
  await sql.end();
});

describe("Migration 0006 — Struktur", () => {
  it("bookings hat die neuen Promoter-/Snapshot-/Storno-Spalten; amount_due_cents ist generiert", async () => {
    const cols = await sql`
      select column_name, is_generated, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'bookings'
        and column_name in (
          'promoter_id', 'idempotency_key', 'paid_seats', 'free_persons',
          'ticket_price_cents_snapshot', 'deposit_amount_cents_snapshot',
          'commission_per_ticket_cents_snapshot', 'group_threshold_snapshot',
          'group_free_snapshot', 'commission_total_cents', 'amount_due_cents',
          'payment_status', 'sold_at', 'cancelled_at', 'cancelled_by', 'cancellation_reason'
        )
      order by column_name
    `;
    expect(cols).toHaveLength(16);
    // Alle neuen Spalten sind nullable — sonst bräche der INSERT der Handover-Funktion.
    expect(cols.every((c) => c.is_nullable === "YES")).toBe(true);
    expect(cols.find((c) => c.column_name === "amount_due_cents")?.is_generated).toBe("ALWAYS");
    expect(cols.filter((c) => c.is_generated === "ALWAYS")).toHaveLength(1);
  });

  it("Enums: payment_status, booking_audit_action, notification_kind/channel/status", async () => {
    const enums = await sql`
      select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t join pg_enum e on e.enumtypid = t.oid
      where t.typname in ('payment_status', 'booking_audit_action', 'notification_kind', 'notification_channel', 'notification_status')
      group by t.typname order by t.typname
    `;
    expect(enums).toEqual([
      { name: "booking_audit_action", labels: ["sold", "payment_status_set", "cancelled"] },
      { name: "notification_channel", labels: ["email", "sms", "whatsapp"] },
      { name: "notification_kind", labels: ["booking_confirmation", "reminder_4h", "reminder_1h"] },
      { name: "notification_status", labels: ["pending", "sent", "failed", "cancelled", "skipped"] },
      // 0009 (E5.4): dritte Stufe „noch nichts kassiert" vor deposit_received
      { name: "payment_status", labels: ["not_collected", "deposit_received", "fully_paid"] },
    ]);
  });

  it("RLS aktiv auf bookings, booking_audit_log, notifications", async () => {
    const rows = await sql`
      select tablename, rowsecurity from pg_tables
      where schemaname = 'public' and tablename in ('bookings', 'booking_audit_log', 'notifications')
      order by tablename
    `;
    expect(rows).toEqual([
      { tablename: "booking_audit_log", rowsecurity: true },
      { tablename: "bookings", rowsecurity: true },
      { tablename: "notifications", rowsecurity: true },
    ]);
  });

  it("Grants: authenticated NUR SELECT auf allen drei Tabellen, anon nichts", async () => {
    const rows = await sql`
      select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privs
      from information_schema.table_privileges
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
        and table_name in ('bookings', 'booking_audit_log', 'notifications')
      group by grantee, table_name order by grantee, table_name
    `;
    expect(rows).toEqual([
      { grantee: "authenticated", table_name: "booking_audit_log", privs: "SELECT" },
      { grantee: "authenticated", table_name: "bookings", privs: "SELECT" },
      { grantee: "authenticated", table_name: "notifications", privs: "SELECT" },
    ]);
  });
});

describe("Handover-Funktion schreibt weiterhin (Hard Rule 4)", () => {
  it("Online-Buchung: Promoter-Spalten NULL, amount_due_cents = Gesamt − kassiert", async () => {
    const [b] = await sql`
      select channel, payment_type, promoter_id, payment_status, idempotency_key, paid_seats,
             total_amount_cents, amount_paid_cents, amount_due_cents, status
      from bookings where id = ${onlineBookingId}
    `;
    expect(b).toEqual({
      channel: "online",
      payment_type: "full",
      promoter_id: null,
      payment_status: null,
      idempotency_key: null,
      paid_seats: null,
      total_amount_cents: 8000,
      amount_paid_cents: 8000,
      amount_due_cents: 0,
      status: "pending",
    });
  });

  it("release_departure_seats() (setzt nur status = cancelled) bleibt mit den Storno-Checks verträglich", async () => {
    // Zweite Online-Buchung über die Funktion, damit der Zähler stimmt und die Freigabe echt ist.
    const [o] = await sql`
      select (reserve_departure_seats(${departureId}::uuid, 1, 4000, 4000, 'TEST-e51 Online 2', 'e51-online2@example.invalid', null, null, false, false, null)).id as id
    `;
    const [r] = await sql`select (release_departure_seats(${o.id}::uuid)).status::text as status`;
    expect(r.status).toBe("cancelled");
    const [b] = await sql`select cancelled_at, cancelled_by from bookings where id = ${o.id}`;
    expect(b).toEqual({ cancelled_at: null, cancelled_by: null });
    await sql`delete from bookings where id = ${o.id}`;
  });
});

describe("Promoter-Verkauf als bookings-Zeile — Checks (Hard Rule 7 in der DB)", () => {
  it("vollständige Zeile: amount_due_cents = Rest im Bus, Provision gespeichert", async () => {
    const [b] = await sql`
      select seats, paid_seats, free_persons, amount_due_cents, commission_total_cents, payment_status::text as payment_status
      from bookings where id = ${ownBookingId}
    `;
    expect(b).toEqual({
      seats: 3,
      paid_seats: 3,
      free_persons: 0,
      amount_due_cents: 3000,
      commission_total_cents: 3000,
      payment_status: "deposit_received",
    });
  });

  it("10+1: 11 Sitze belegt, 10 bezahlt, 1 gratis — Sitze = bezahlt + gratis wird erzwungen", async () => {
    const id = await insertBooking(
      promoterRow({ seats: 11, paid_seats: 10, free_persons: 1, total_amount_cents: 40000, amount_paid_cents: 30000, deposit_total_cents: 30000, commission_total_cents: 10000 }),
    );
    const [b] = await sql`select seats, paid_seats, free_persons, amount_due_cents from bookings where id = ${id}`;
    expect(b).toEqual({ seats: 11, paid_seats: 10, free_persons: 1, amount_due_cents: 10000 });
    await sql`delete from bookings where id = ${id}`;
    await expect(insertBooking(promoterRow({ seats: 11, paid_seats: 10, free_persons: 0 }))).rejects.toThrow(
      /seats_split_consistent/,
    );
  });

  it("channel = promoter ohne Promoter / ohne Snapshot / ohne Zahlungsstatus → promoter_booking_complete", async () => {
    for (const missing of [
      "promoter_id",
      "idempotency_key",
      "paid_seats",
      "ticket_price_cents_snapshot",
      "commission_per_ticket_cents_snapshot",
      "group_threshold_snapshot",
      "commission_total_cents",
      "payment_status",
      "sold_at",
    ]) {
      await expect(insertBooking(promoterRow({ [missing]: null }))).rejects.toThrow(/promoter_booking_complete|seats_split_consistent/);
    }
  });

  it("Anzahlung gewählt ohne Anzahlungs-Snapshot → promoter_deposit_snapshot_present", async () => {
    await expect(insertBooking(promoterRow({ deposit_amount_cents_snapshot: null }))).rejects.toThrow(
      /promoter_deposit_snapshot_present/,
    );
  });

  it("Zahlungsstatus muss zu Beträgen und Zahlart passen", async () => {
    // fully_paid, aber nicht alles kassiert
    await expect(insertBooking(promoterRow({ payment_status: "fully_paid" }))).rejects.toThrow(
      /payment_status_matches_amounts/,
    );
    // deposit_received bei Vollzahlung
    await expect(
      insertBooking(promoterRow({ payment_type: "full", payment_status: "deposit_received" })),
    ).rejects.toThrow(/payment_status_matches_amounts/);
    // deposit_received, aber schon alles kassiert
    await expect(insertBooking(promoterRow({ amount_paid_cents: 12000 }))).rejects.toThrow(
      /payment_status_matches_amounts/,
    );
    // kassiert > Gesamt — gilt für jeden Kanal
    await expect(
      insertBooking(promoterRow({ amount_paid_cents: 12001, payment_status: "fully_paid" })),
    ).rejects.toThrow(/amount_paid_within_total/);
  });

  it("Idempotenz-Schlüssel ist eindeutig (RISKS Nr. 11)", async () => {
    const key = "0e510000-0000-4000-8000-000000000001";
    const id = await insertBooking(promoterRow({ idempotency_key: key }));
    await expect(insertBooking(promoterRow({ idempotency_key: key }))).rejects.toThrow(
      /bookings_idempotency_key_key/,
    );
    await sql`delete from bookings where id = ${id}`;
  });

  it("Storno-Felder gehören zusammen und verlangen status cancelled/refunded", async () => {
    await expect(
      insertBooking(promoterRow({ status: "cancelled", cancelled_at: new Date() })),
    ).rejects.toThrow(/cancellation_fields_consistent/);
    await expect(
      insertBooking(promoterRow({ status: "confirmed", cancelled_at: new Date(), cancelled_by: OPERATOR })),
    ).rejects.toThrow(/cancellation_fields_consistent/);
    const id = await insertBooking(
      promoterRow({ status: "cancelled", cancelled_at: new Date(), cancelled_by: OPERATOR, cancellation_reason: "TEST-e51 Storno" }),
    );
    const [b] = await sql`select cancelled_by, status::text as status from bookings where id = ${id}`;
    expect(b).toEqual({ cancelled_by: OPERATOR, status: "cancelled" });
    await sql`delete from bookings where id = ${id}`;
  });
});

describe("RLS bookings — Promoter nur eigene, Operator alle, inaktiv nichts, anon nichts", () => {
  it("Promoter sieht genau seine eigene Buchung (nicht die des anderen, nicht die Online-Buchung)", async () => {
    const rows = await asUser(PROMOTER, (tx) => tx`select id from bookings where departure_id = ${departureId}`);
    expect(rows.map((r) => r.id)).toEqual([ownBookingId]);
  });

  it("network_operator sieht alle drei Buchungen des Termins", async () => {
    const rows = await asUser(OPERATOR, (tx) => tx`select id from bookings where departure_id = ${departureId}`);
    expect(rows.map((r) => r.id).sort()).toEqual([ownBookingId, otherBookingId, onlineBookingId].sort());
  });

  it("deaktiviertes Profil sieht nichts — auch nicht seine eigene Buchung", async () => {
    const rows = await asUser(INACTIVE, (tx) => tx`select id from bookings where departure_id = ${departureId}`);
    expect(rows).toEqual([]);
  });

  it("anon: permission denied", async () => {
    await expect(asUser(null, (tx) => tx`select id from bookings`)).rejects.toThrow(/permission denied/);
  });

  it("authenticated darf nicht schreiben — auch der Operator nicht, auch nicht die eigene Zeile (nur Funktionen in E5.3)", async () => {
    for (const id of [PROMOTER, OPERATOR]) {
      await expect(
        asUser(id, (tx) => tx`update bookings set payment_status = 'fully_paid', amount_paid_cents = 12000 where id = ${ownBookingId}`),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(id, (tx) => tx`delete from bookings where id = ${ownBookingId}`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        asUser(id, (tx) => tx`insert into bookings (departure_id, channel, payment_type, seats, total_amount_cents, customer_name, customer_email) values (${departureId}, 'online', 'full', 1, 0, 'x', 'x@x.test')`),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe("RLS booking_audit_log + notifications — folgen der Buchung", () => {
  it("Promoter liest Audit-Log und Nachrichten nur seiner eigenen Buchung", async () => {
    const audit = await asUser(PROMOTER, (tx) => tx`select booking_id, action::text as action from booking_audit_log`);
    expect(audit).toEqual([{ booking_id: ownBookingId, action: "sold" }]);
    const notes = await asUser(PROMOTER, (tx) => tx`select booking_id, kind::text as kind, status::text as status from notifications order by kind`);
    expect(notes).toEqual([
      { booking_id: ownBookingId, kind: "booking_confirmation", status: "pending" },
      { booking_id: ownBookingId, kind: "reminder_4h", status: "pending" },
    ]);
  });

  it("network_operator liest alles; deaktiviert nichts; anon permission denied", async () => {
    const audit = await asUser(OPERATOR, (tx) => tx`select booking_id from booking_audit_log where booking_id in (${ownBookingId}, ${otherBookingId})`);
    expect(audit).toHaveLength(2);
    const notes = await asUser(OPERATOR, (tx) => tx`select id from notifications where booking_id in (${ownBookingId}, ${otherBookingId})`);
    expect(notes).toHaveLength(4);
    expect(await asUser(INACTIVE, (tx) => tx`select id from booking_audit_log`)).toEqual([]);
    expect(await asUser(INACTIVE, (tx) => tx`select id from notifications`)).toEqual([]);
    await expect(asUser(null, (tx) => tx`select id from booking_audit_log`)).rejects.toThrow(/permission denied/);
    await expect(asUser(null, (tx) => tx`select id from notifications`)).rejects.toThrow(/permission denied/);
  });

  it("authenticated darf weder Audit-Log noch Nachrichten schreiben (append-only über Funktionen)", async () => {
    for (const id of [PROMOTER, OPERATOR]) {
      await expect(
        asUser(id, (tx) => tx`insert into booking_audit_log (booking_id, action) values (${ownBookingId}, 'cancelled')`),
      ).rejects.toThrow(/permission denied/);
      await expect(asUser(id, (tx) => tx`delete from booking_audit_log`)).rejects.toThrow(/permission denied/);
      await expect(
        asUser(id, (tx) => tx`update notifications set status = 'sent', sent_at = now() where booking_id = ${ownBookingId}`),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("Nachrichten: pro Buchung und Art nur eine; status sent verlangt sent_at", async () => {
    await expect(
      sql`insert into notifications (booking_id, kind, recipient_name, scheduled_for) values (${ownBookingId}, 'reminder_4h', 'x', now())`,
    ).rejects.toThrow(/notifications_booking_kind_key/);
    await expect(
      sql`insert into notifications (booking_id, kind, recipient_name, scheduled_for, status) values (${ownBookingId}, 'reminder_1h', 'x', now(), 'sent')`,
    ).rejects.toThrow(/notifications_sent_has_timestamp/);
  });

  it("Löschen der Buchung räumt Audit-Log und Nachrichten mit ab (ON DELETE CASCADE)", async () => {
    const id = await insertBooking(promoterRow());
    await sql`insert into booking_audit_log (booking_id, action) values (${id}, 'sold')`;
    await sql`insert into notifications (booking_id, kind, recipient_name, scheduled_for) values (${id}, 'booking_confirmation', 'x', now())`;
    await sql`delete from bookings where id = ${id}`;
    const [a] = await sql`select count(*)::int as n from booking_audit_log where booking_id = ${id}`;
    const [n] = await sql`select count(*)::int as n from notifications where booking_id = ${id}`;
    expect([a.n, n.n]).toEqual([0, 0]);
  });
});
