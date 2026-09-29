import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect } from "./db";

// E2.1/E2.3 — RLS deny-by-default + erste Policies aus Migration 0003.
// Jeder Test simuliert einen Request als Supabase-Rolle `authenticated` mit dem
// JWT-Claim `sub` = Nutzer-ID (so liest auth.uid() den Nutzer). Alles in einer
// Transaktion mit `set local`, damit nichts an der Verbindung hängen bleibt.

const OPERATOR = "11111111-1111-4111-8111-111111111111";
const PROMOTER = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "33333333-3333-4333-8333-333333333333";
const UNKNOWN = "99999999-9999-4999-8999-999999999999";

const sql = connect(1);

type Row = Record<string, unknown>;

/** Führt `query` als `authenticated` mit gegebener sub aus (null = anon). */
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

beforeAll(async () => {
  const [row] = await sql`
    insert into tour_departures (title, starts_at, capacity_total)
    values ('TEST-rls-departure', now() + interval '7 days', 5)
    returning id
  `;
  departureId = row.id as string;
});

afterAll(async () => {
  await sql`delete from tour_departures where title like 'TEST-rls-%'`;
  await sql.end();
});

describe("Migration 0003 — Struktur", () => {
  it("RLS ist auf profiles, tour_departures, bookings aktiv", async () => {
    const rows = await sql`
      select tablename, rowsecurity from pg_tables
      where schemaname = 'public' and tablename in ('profiles','tour_departures','bookings')
      order by tablename
    `;
    expect(rows.map((r) => [r.tablename, r.rowsecurity])).toEqual([
      ["bookings", true],
      ["profiles", true],
      ["tour_departures", true],
    ]);
  });

  it("Seed: je Rolle ein aktives Konto + ein deaktivierter Promoter", async () => {
    const rows = await sql`select id, role, active from profiles order by id`;
    expect(rows).toEqual([
      { id: OPERATOR, role: "network_operator", active: true },
      { id: PROMOTER, role: "promoter", active: true },
      { id: INACTIVE, role: "promoter", active: false },
    ]);
  });

  it("Rollen-Helfer sind security definer mit festem search_path", async () => {
    const rows = await sql`
      select proname, prosecdef, proconfig
      from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('current_profile_role','is_active_profile','is_network_operator')
      order by proname
    `;
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.prosecdef).toBe(true);
      expect(r.proconfig).toEqual(["search_path=public"]);
    }
  });
});

describe("profiles — Rolle kommt aus der DB, nicht aus dem Token", () => {
  it("Promoter sieht nur die eigene Zeile", async () => {
    const rows = await asUser(PROMOTER, (tx) => tx`select id, role from profiles order by id`);
    expect(rows).toEqual([{ id: PROMOTER, role: "promoter" }]);
  });

  it("network_operator sieht alle Profile", async () => {
    const rows = await asUser(OPERATOR, (tx) => tx`select id from profiles order by id`);
    expect(rows.map((r) => r.id)).toEqual([OPERATOR, PROMOTER, INACTIVE]);
  });

  it("deaktivierter Promoter sieht noch die eigene Zeile (für die Sperr-Anzeige), sonst nichts", async () => {
    const rows = await asUser(INACTIVE, (tx) => tx`select id, active from profiles`);
    expect(rows).toEqual([{ id: INACTIVE, active: false }]);
  });

  it("Token mit unbekannter sub sieht kein Profil — auch wenn der Claim role='network_operator' behauptet", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      // Gefälschter Fach-Rollen-Claim im Token: darf keine Wirkung haben.
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: UNKNOWN, role: "authenticated", app_role: "network_operator" })}, true)`;
      return tx`select id from profiles`;
    });
    expect(rows).toEqual([]);
  });

  it("Promoter mit gefälschtem Token-Claim bleibt Promoter (is_network_operator() = false)", async () => {
    const [row] = await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: PROMOTER, role: "authenticated", user_role: "network_operator" })}, true)`;
      return tx`select is_network_operator() as op, current_profile_role()::text as role, (select count(*) from profiles)::int as visible`;
    });
    expect(row).toEqual({ op: false, role: "promoter", visible: 1 });
  });

  it("anon hat kein Recht auf profiles", async () => {
    await expect(asUser(null, (tx) => tx`select id from profiles`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("Helfer-Funktionen", () => {
  it("current_profile_role(): operator / promoter / NULL für inaktiv / NULL für unbekannt", async () => {
    const roleOf = async (id: string) => {
      const [r] = await asUser(id, (tx) => tx`select current_profile_role()::text as role`);
      return r.role;
    };
    expect(await roleOf(OPERATOR)).toBe("network_operator");
    expect(await roleOf(PROMOTER)).toBe("promoter");
    expect(await roleOf(INACTIVE)).toBeNull();
    expect(await roleOf(UNKNOWN)).toBeNull();
  });

  it("is_active_profile(): true nur für aktive Profile", async () => {
    const activeOf = async (id: string) => {
      const [r] = await asUser(id, (tx) => tx`select is_active_profile() as a`);
      return r.a;
    };
    expect(await activeOf(OPERATOR)).toBe(true);
    expect(await activeOf(PROMOTER)).toBe(true);
    expect(await activeOf(INACTIVE)).toBe(false);
    expect(await activeOf(UNKNOWN)).toBe(false);
  });
});

describe("tour_departures — nur aktive Profile lesen", () => {
  it("aktiver Promoter und Operator sehen den Termin", async () => {
    for (const id of [PROMOTER, OPERATOR]) {
      const rows = await asUser(id, (tx) => tx`select id from tour_departures where id = ${departureId}`);
      expect(rows).toHaveLength(1);
    }
  });

  it("deaktivierter Promoter sieht keinen Termin (0 Zeilen, kein Fehler)", async () => {
    const rows = await asUser(INACTIVE, (tx) => tx`select id from tour_departures`);
    expect(rows).toEqual([]);
  });

  it("authenticated darf keine Termine schreiben (kein Grant)", async () => {
    await expect(
      asUser(OPERATOR, (tx) => tx`update tour_departures set capacity_total = 99 where id = ${departureId}`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("bookings — für authenticated komplett gesperrt", () => {
  it("weder Promoter noch Operator dürfen bookings lesen", async () => {
    for (const id of [PROMOTER, OPERATOR, INACTIVE]) {
      await expect(asUser(id, (tx) => tx`select id from bookings`)).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("reserve_departure_seats() bleibt für authenticated nicht aufrufbar (E1 unverändert)", async () => {
    await expect(
      asUser(PROMOTER, (tx) => tx`select reserve_departure_seats(${departureId}::uuid, 1, 0, 0, 'x', 'x@x.test', null, null, false, false, null)`),
    ).rejects.toThrow(/permission denied/);
  });
});
