import { defineConfig } from "vitest/config";

// Tests laufen gegen die LOKALE Supabase-Instanz (Ports 4532x, AGENTS.md).
// Test-Dateien laufen nacheinander, nicht parallel: Sie teilen sich eine
// Datenbank und legen dort Termine/Buchungen an. Parallelität innerhalb
// eines Tests (8 gleichzeitige Reservierungen) ist davon unberührt.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
