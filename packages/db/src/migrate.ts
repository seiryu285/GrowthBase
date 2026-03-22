import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";

import { createDatabase } from "./client";
import { appliedMigrations } from "./schema";
import type { GrowthBaseDatabase } from "./client";

const drizzleDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

export async function runMigrations(database: GrowthBaseDatabase): Promise<void> {
  const migrationFiles = fs
    .readdirSync(drizzleDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS applied_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  for (const file of migrationFiles) {
    const alreadyApplied = database.db
      .select()
      .from(appliedMigrations)
      .where(eq(appliedMigrations.name, file))
      .get();

    if (alreadyApplied) {
      continue;
    }

    const sql = fs.readFileSync(path.join(drizzleDir, file), "utf8");
    database.sqlite.exec(sql);
    database.db.insert(appliedMigrations).values({
      name: file,
      appliedAt: new Date().toISOString()
    }).run();
  }
}

async function main() {
  const database = createDatabase(process.env.DATABASE_URL);

  try {
    await runMigrations(database);
  } finally {
    database.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
