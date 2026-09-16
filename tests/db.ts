import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

// Verbindungs-URL der lokalen Test-Datenbank.
// Reihenfolge: Umgebungsvariable DATABASE_URL → Eintrag in .env.local →
// Standardwert der lokalen Instanz (supabase/config.toml, [db] port = 45322).
// Niemals eine Cloud-URL hier eintragen: die Tests legen Daten an und löschen sie.
const LOCAL_DEFAULT = "postgresql://postgres:postgres@127.0.0.1:45322/postgres";

function readEnvLocal(key: string): string | undefined {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      if (line.slice(0, eq).trim() !== key) continue;
      return line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // keine .env.local — Standardwert verwenden
  }
  return undefined;
}

export const DATABASE_URL =
  process.env.DATABASE_URL ?? readEnvLocal("DATABASE_URL") ?? LOCAL_DEFAULT;

if (!/127\.0\.0\.1|localhost/.test(DATABASE_URL)) {
  throw new Error(
    `Tests laufen nur gegen eine lokale Datenbank, nicht gegen: ${DATABASE_URL}`,
  );
}

/**
 * Neue Verbindung(en) zur Test-DB. `max` = Anzahl gleichzeitiger Verbindungen —
 * der Überbuchungstest braucht mindestens so viele, wie er parallele Aufrufe macht,
 * sonst würde der Pool die Aufrufe serialisieren und der Test nichts beweisen.
 */
export function connect(max = 1) {
  return postgres(DATABASE_URL, { max, onnotice: () => {} });
}
