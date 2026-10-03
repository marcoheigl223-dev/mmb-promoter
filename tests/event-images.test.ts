import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connect, readEnvLocal } from "./db";

// E5.3 — Migration 0008: Event-Bilder (Auftrag Marco 02.10.2026).
// Zwei Ebenen:
//   1. DB (postgres.js, Rolle `authenticated` + JWT-Claim `sub` wie in den
//      anderen RLS-Tests): Spalten + Checks, Bucket privat/Limit/MIME, vier
//      Policies auf storage.objects (nur network_operator schreibt, aktive
//      Profile lesen, inaktiv/anon nichts), Spalten-Grants, Funktion
//      create_departure_from_template() kopiert image_path ohne Live-Bezug.
//   2. Storage-API über HTTP (nur wenn der Storage-Container läuft): Upload
//      nur als Operator (Promoter 403, anon abgelehnt), falscher MIME-Typ und
//      zu große Datei abgelehnt, signierte URL für Promoter (Bild lesbar),
//      nicht für inaktive/anon, DELETE nur Operator.
// Die Reserve-Funktion aus 0002 bleibt unberührt (eigener Identitätstest).

const OPERATOR = "11111111-1111-4111-8111-111111111111";
const PROMOTER = "22222222-2222-4222-8222-222222222222";
const INACTIVE = "33333333-3333-4333-8333-333333333333";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnvLocal("NEXT_PUBLIC_SUPABASE_URL") ?? "http://127.0.0.1:45321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? readEnvLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_)) {
  throw new Error(`Tests laufen nur gegen localhost, nicht gegen ${URL_}`);
}

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

const BUCKET = "event-images";
const PREFIX = "templates/00000000-0000-4000-8000-00000000e053/";
// 1×1-Pixel-PNG (67 Byte)
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// storage.objects trägt den Statement-Trigger protect_objects_delete (storage-api):
// direktes DELETE wirft 42501, außer das GUC storage.allow_delete_query ist 'true'.
// Im Test wird es gesetzt, damit allein die RLS-Policy entscheidet. Die App
// löscht nie direkt, sondern über die Storage-API (storage.remove()).
const ALLOW_DELETE = "select set_config('storage.allow_delete_query', 'true', true)";

async function cleanup() {
  await sql`delete from tour_departures where title like 'TEST-e53-%'`;
  await sql`delete from event_templates where name like 'TEST-e53-%'`;
  // Nur Zeilen ohne echte Datei (DB-Ebene) bzw. Reste nach Fehlschlag.
  await sql.begin(async (tx) => {
    await tx.unsafe(ALLOW_DELETE);
    await tx`delete from storage.objects where bucket_id = ${BUCKET} and name like ${PREFIX + "%"}`;
  });
}

beforeAll(cleanup);

afterAll(async () => {
  await cleanup();
  await sql.end();
});

// ---------------------------------------------------------------------------
// 1. Datenbank
// ---------------------------------------------------------------------------

describe("Migration 0008 — Spalten, Bucket, Policies", () => {
  it("image_path auf event_templates und tour_departures (nullable text)", async () => {
    const cols = await sql`
      select table_name as t, data_type as d, is_nullable as n from information_schema.columns
      where table_schema = 'public' and column_name = 'image_path' order by table_name
    `;
    expect(cols).toEqual([
      { t: "event_templates", d: "text", n: "YES" },
      { t: "tour_departures", d: "text", n: "YES" },
    ]);
  });

  it("Bucket event-images ist privat, 5 MiB, nur jpeg/png/webp", async () => {
    const [b] = await sql`select public, file_size_limit::int, allowed_mime_types from storage.buckets where id = ${BUCKET}`;
    expect(b).toEqual({
      public: false,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
  });

  it("vier Policies auf storage.objects, alle nur für authenticated (anon: keine → nichts)", async () => {
    const pol = await sql`
      select policyname as p, cmd as c, roles as r from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname like 'event_images_%' order by 1
    `;
    expect(pol).toEqual([
      { p: "event_images_delete_network_operator", c: "DELETE", r: ["authenticated"] },
      { p: "event_images_insert_network_operator", c: "INSERT", r: ["authenticated"] },
      { p: "event_images_select_active_profile", c: "SELECT", r: ["authenticated"] },
      { p: "event_images_update_network_operator", c: "UPDATE", r: ["authenticated"] },
    ]);
    const [rls] = await sql`select rowsecurity from pg_tables where schemaname = 'storage' and tablename = 'objects'`;
    expect(rls).toEqual({ rowsecurity: true });
  });

  it("Spalten-Grants: authenticated darf image_path setzen (Zeilen-Policies bleiben die Schranke)", async () => {
    const grants = await sql`
      select table_name as t, string_agg(privilege_type, ',' order by privilege_type) as p
      from information_schema.column_privileges
      where table_schema = 'public' and column_name = 'image_path' and grantee = 'authenticated'
      group by table_name order by 1
    `;
    expect(grants).toEqual([
      { t: "event_templates", p: "INSERT,SELECT,UPDATE" },
      { t: "tour_departures", p: "INSERT,SELECT,UPDATE" },
    ]);
  });

  it("Check: kein '..', kein führender '/', max. 500 Zeichen, leer verboten", async () => {
    const [{ id }] = await asUser(OPERATOR, (tx) =>
      tx`insert into event_templates (name, title, capacity_total) values ('TEST-e53-check', 'TEST-e53 Check', 5) returning id`,
    );
    for (const bad of ["templates/../x.webp", "/templates/x.webp", "", "a".repeat(501)]) {
      await expect(
        asUser(OPERATOR, (tx) => tx`update event_templates set image_path = ${bad} where id = ${id}`),
      ).rejects.toMatchObject({ code: "23514" });
    }
    const ok = await asUser(OPERATOR, (tx) =>
      tx`update event_templates set image_path = 'templates/x/y.webp' where id = ${id} returning image_path`,
    );
    expect(ok).toEqual([{ image_path: "templates/x/y.webp" }]);
  });
});

describe("storage.objects — RLS auf DB-Ebene", () => {
  const name = PREFIX + "db-level.webp";

  it("Promoter, inaktiv und anon können kein Objekt im Bucket anlegen", async () => {
    await expect(
      asUser(PROMOTER, (tx) => tx`insert into storage.objects (bucket_id, name) values (${BUCKET}, ${name})`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(INACTIVE, (tx) => tx`insert into storage.objects (bucket_id, name) values (${BUCKET}, ${name})`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(null, (tx) => tx`insert into storage.objects (bucket_id, name) values (${BUCKET}, ${name})`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("Operator legt an; Promoter sieht es, inaktiv/anon nicht; nur Operator löscht", async () => {
    const ins = await asUser(OPERATOR, (tx) =>
      tx`insert into storage.objects (bucket_id, name) values (${BUCKET}, ${name}) returning name`,
    );
    expect(ins).toEqual([{ name }]);

    const promoterSees = await asUser(PROMOTER, (tx) => tx`select name from storage.objects where name = ${name}`);
    expect(promoterSees).toEqual([{ name }]);
    const inactiveSees = await asUser(INACTIVE, (tx) => tx`select name from storage.objects where name = ${name}`);
    expect(inactiveSees).toEqual([]);
    const anonSees = await asUser(null, (tx) => tx`select name from storage.objects where name = ${name}`);
    expect(anonSees).toEqual([]);

    const promoterDel = await asUser(PROMOTER, async (tx) => {
      await tx.unsafe(ALLOW_DELETE);
      return tx`delete from storage.objects where name = ${name} returning name`;
    });
    expect(promoterDel).toEqual([]);
    const promoterUpd = await asUser(PROMOTER, (tx) =>
      tx`update storage.objects set name = ${name + ".x"} where name = ${name} returning name`,
    );
    expect(promoterUpd).toEqual([]);

    const operatorDel = await asUser(OPERATOR, async (tx) => {
      await tx.unsafe(ALLOW_DELETE);
      return tx`delete from storage.objects where name = ${name} returning name`;
    });
    expect(operatorDel).toEqual([{ name }]);
  });
});

describe("create_departure_from_template() kopiert image_path (kein Live-Bezug)", () => {
  it("Event übernimmt das Vorlagen-Bild; spätere Änderung an der Vorlage ändert es nicht", async () => {
    const path1 = PREFIX + "vorlage-1.webp";
    const path2 = PREFIX + "vorlage-2.webp";
    const [{ id: tplId }] = await asUser(OPERATOR, (tx) =>
      tx`insert into event_templates (name, title, capacity_total, image_path) values ('TEST-e53-tpl', 'TEST-e53-tpl Event', 8, ${path1}) returning id`,
    );
    const [{ dep }] = await asUser(OPERATOR, (tx) =>
      tx`select create_departure_from_template(${tplId}::uuid, '2026-11-01T10:00:00+01:00'::timestamptz) as dep`,
    );
    const [d1] = await sql`select image_path, template_id from tour_departures where id = ${dep as string}`;
    expect(d1).toEqual({ image_path: path1, template_id: tplId });

    await asUser(OPERATOR, (tx) => tx`update event_templates set image_path = ${path2} where id = ${tplId}`);
    const [d2] = await sql`select image_path from tour_departures where id = ${dep as string}`;
    expect(d2).toEqual({ image_path: path1 });

    // Vorlage ohne Bild → Event ohne Bild
    await asUser(OPERATOR, (tx) => tx`update event_templates set image_path = null where id = ${tplId}`);
    const [{ dep: dep2 }] = await asUser(OPERATOR, (tx) =>
      tx`select create_departure_from_template(${tplId}::uuid, '2026-11-02T10:00:00+01:00'::timestamptz) as dep`,
    );
    const [d3] = await sql`select image_path from tour_departures where id = ${dep2 as string}`;
    expect(d3).toEqual({ image_path: null });
  });

  it("Promoter kann image_path am Termin nicht setzen (Policy → 0 Zeilen)", async () => {
    const [{ id }] = await sql`select id from tour_departures where title = 'TEST-e53-tpl Event' limit 1`;
    const upd = await asUser(PROMOTER, (tx) =>
      tx`update tour_departures set image_path = 'departures/x/hack.webp' where id = ${id} returning id`,
    );
    expect(upd).toEqual([]);
    const [row] = await sql`select image_path from tour_departures where id = ${id}`;
    expect(row.image_path).not.toBe("departures/x/hack.webp");
  });
});

// ---------------------------------------------------------------------------
// 2. Storage-API über HTTP (Upload, Policies in Aktion, signierte URLs)
// ---------------------------------------------------------------------------

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON!, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function storageUp(): Promise<boolean> {
  try {
    const res = await fetch(`${URL_}/storage/v1/bucket`, { headers: { apikey: ANON! } });
    return res.status < 500;
  } catch {
    return false;
  }
}

function upload(token: string | null, path: string, body: Buffer, contentType: string) {
  const headers: Record<string, string> = { apikey: ANON!, "Content-Type": contentType };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Node-fetch nimmt Buffer als Body; die lib.dom-Typen kennen ihn nicht.
  return fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, { method: "POST", headers, body: body as unknown as BodyInit });
}

function sign(token: string | null, path: string) {
  const headers: Record<string, string> = { apikey: ANON!, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${URL_}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expiresIn: 60 }),
  });
}

/**
 * storage-api (lokale Version) antwortet bei Fehlern mit HTTP 400 und trägt den
 * eigentlichen Code im Body: {"statusCode":"403"|"413"|"415", "error": …}.
 * Geprüft wird deshalb der Body-Code; bei Erfolg der HTTP-Status.
 */
async function errCode(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { statusCode?: string | number };
  return String(body.statusCode ?? res.status);
}

function remove(token: string, path: string) {
  return fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: ANON!, Authorization: `Bearer ${token}` },
  });
}

describe("Storage-API (HTTP) — nur Operator lädt hoch, aktive Profile lesen über signierte URL", async () => {
  const up = await storageUp();
  let operator = "";
  let promoter = "";
  let inactive = "";
  const path = PREFIX + "http-level.png";

  beforeAll(async () => {
    if (!up) return;
    [operator, promoter, inactive] = await Promise.all([
      login("operator@mmb-promoter.test", "operator-test-2026"),
      login("promoter@mmb-promoter.test", "promoter-test-2026"),
      login("inactive-promoter@mmb-promoter.test", "inactive-test-2026"),
    ]);
  });

  it.skipIf(!up)("Promoter und anon können nicht hochladen", async () => {
    const asPromoter = await upload(promoter, path, PNG_1PX, "image/png");
    expect(await errCode(asPromoter)).toBe("403");
    const asAnon = await upload(null, path, PNG_1PX, "image/png");
    expect(["401", "403"]).toContain(await errCode(asAnon));
    const [{ n }] = await sql`select count(*)::int as n from storage.objects where bucket_id = ${BUCKET} and name = ${path}`;
    expect(n).toBe(0);
  });

  it.skipIf(!up)("falscher MIME-Typ und zu große Datei werden vom Bucket abgelehnt", async () => {
    const text = await upload(operator, PREFIX + "notes.txt", Buffer.from("kein Bild"), "text/plain");
    expect(await errCode(text)).toBe("415");
    const big = await upload(operator, PREFIX + "big.png", Buffer.alloc(6 * 1024 * 1024, 1), "image/png");
    expect(await errCode(big)).toBe("413");
    const [{ n }] = await sql`select count(*)::int as n from storage.objects where bucket_id = ${BUCKET} and name like ${PREFIX + "%"}`;
    expect(n).toBe(0);
  });

  it.skipIf(!up)("Operator lädt hoch; Promoter bekommt signierte URL und kann das Bild laden; inaktiv/anon nicht", async () => {
    const res = await upload(operator, path, PNG_1PX, "image/png");
    expect(res.status).toBe(200);

    const signed = await sign(promoter, path);
    expect(signed.status).toBe(200);
    const { signedURL } = (await signed.json()) as { signedURL: string };
    const img = await fetch(`${URL_}/storage/v1${signedURL}`);
    expect(img.status).toBe(200);
    expect(Buffer.from(await img.arrayBuffer()).equals(PNG_1PX)).toBe(true);

    const inactiveSign = await sign(inactive, path);
    expect(inactiveSign.status).toBeGreaterThanOrEqual(400);
    const anonSign = await sign(null, path);
    expect(anonSign.status).toBeGreaterThanOrEqual(400);
    // Ohne signierte URL ist das Objekt nicht erreichbar (Bucket privat).
    const direct = await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${path}`, { headers: { apikey: ANON! } });
    expect(direct.status).toBeGreaterThanOrEqual(400);
  });

  it.skipIf(!up)("Promoter kann nicht löschen, Operator schon", async () => {
    const asPromoter = await remove(promoter, path);
    expect(await errCode(asPromoter)).toBe("403");
    const [{ n }] = await sql`select count(*)::int as n from storage.objects where bucket_id = ${BUCKET} and name = ${path}`;
    expect(n).toBe(1);

    const asOperator = await remove(operator, path);
    expect(asOperator.status).toBe(200);
    const [{ n: after }] = await sql`select count(*)::int as n from storage.objects where bucket_id = ${BUCKET} and name = ${path}`;
    expect(after).toBe(0);
  });
});
