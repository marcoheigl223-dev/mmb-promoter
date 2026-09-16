import { afterAll, describe, expect, it } from "vitest";
import { connect, DATABASE_URL } from "./db";

// Rauchtest: Ist die lokale Instanz erreichbar und ist es die richtige?
// Scheitert dieser Test, sind alle anderen Ergebnisse wertlos → zuerst
// `supabase start` (AGENTS.md, Ports 4532x).
describe("lokale Datenbank", () => {
  const sql = connect();
  afterAll(() => sql.end());

  it(`ist erreichbar unter ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`, async () => {
    const [row] = await sql<{ db: string; version: string }[]>`
      select current_database() as db, version() as version
    `;
    expect(row.db).toBe("postgres");
    expect(row.version).toMatch(/^PostgreSQL 17/);
  });

  it("gehört zur mmb-promoter-Instanz, nicht zur Boots-Instanz", async () => {
    // Die Boots-Instanz läuft auf 54322; ein versehentlicher Test dagegen
    // würde deren Daten anfassen (Hard Rule 10).
    expect(DATABASE_URL).toContain(":45322/");
  });
});
