import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { connect } from "./db";

// Hard Rule 4 / RISKS Nr. 3: Die Funktionen in der Datenbank müssen exakt dem
// Übergabe-Artefakt entsprechen. Verglichen wird der von Postgres selbst
// erzeugte Funktionstext (pg_get_functiondef) mit dem CREATE-Block in
// docs/handover/reserve-function-final.sql — dieselbe Quelle, aus der das
// Artefakt im Boots-Projekt erzeugt wurde.

const HANDOVER = resolve(process.cwd(), "docs/handover/reserve-function-final.sql");

const RESERVE_SIGNATURE =
  "reserve_departure_seats(uuid,integer,integer,integer,text,text,text,text,boolean,boolean,text)";
const RELEASE_SIGNATURE = "release_departure_seats(uuid)";

function normalize(text: string) {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

/** CREATE-Block einer Funktion aus der Handover-Datei: von der CREATE-Zeile bis zur schließenden `$function$`-Zeile. */
function handoverBlock(name: string) {
  const lines = readFileSync(HANDOVER, "utf8").replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) =>
    l.startsWith(`CREATE OR REPLACE FUNCTION public.${name}(`),
  );
  expect(start, `CREATE-Block für ${name} in Handover-Datei`).toBeGreaterThan(-1);
  const end = lines.findIndex((l, i) => i > start && l === "$function$");
  expect(end, `schließendes $function$ für ${name}`).toBeGreaterThan(start);
  return normalize(lines.slice(start, end + 1).join("\n"));
}

describe("Handover-Funktionen sind unverändert in der Datenbank", () => {
  const sql = connect();
  afterAll(() => sql.end());

  for (const [name, signature] of [
    ["reserve_departure_seats", RESERVE_SIGNATURE],
    ["release_departure_seats", RELEASE_SIGNATURE],
  ] as const) {
    it(`${name}: pg_get_functiondef == docs/handover/reserve-function-final.sql`, async () => {
      const [row] = await sql<{ def: string }[]>`
        select pg_get_functiondef(${"public." + signature}::regprocedure) as def
      `;
      expect(normalize(row.def)).toBe(handoverBlock(name));
    });
  }

  it("das atomare UPDATE steht wörtlich in der DB-Funktion", async () => {
    const [row] = await sql<{ def: string }[]>`
      select pg_get_functiondef(${"public." + RESERVE_SIGNATURE}::regprocedure) as def
    `;
    expect(row.def).toContain("and seats_booked_total + p_seats <= capacity_total");
    expect(row.def).toContain("raise exception 'SOLD_OUT' using errcode = 'P0001'");
  });

  it("nur service_role darf reservieren/freigeben, nie anon/authenticated", async () => {
    for (const signature of [RESERVE_SIGNATURE, RELEASE_SIGNATURE]) {
      const [row] = await sql<{ anon: boolean; auth: boolean; svc: boolean }[]>`
        select
          has_function_privilege('anon', ${"public." + signature}, 'execute') as anon,
          has_function_privilege('authenticated', ${"public." + signature}, 'execute') as auth,
          has_function_privilege('service_role', ${"public." + signature}, 'execute') as svc
      `;
      expect(row, signature).toEqual({ anon: false, auth: false, svc: true });
    }
  });
});
