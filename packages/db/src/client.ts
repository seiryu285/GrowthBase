import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "./schema";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "../..");

export type GrowthBaseDatabase = {
  filename: string;
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
  close: () => void;
};

function isRelativeDatabasePath(value: string): boolean {
  return !value.startsWith(":") && !path.isAbsolute(value);
}

function isMisconfiguredWindowsPathOnPosix(normalized: string): boolean {
  if (os.platform() === "win32") {
    return false;
  }

  if (/^[a-zA-Z]:[/\\]/.test(normalized)) {
    return true;
  }

  if (normalized.includes("Program Files")) {
    return true;
  }

  return normalized.includes("/C:/") || normalized.includes("/C:\\");
}

export function resolveDatabaseFilename(databaseUrl?: string): string {
  const configured = databaseUrl?.trim();

  if (!configured) {
    return path.resolve(workspaceRoot, "data", "growthbase.sqlite");
  }

  let normalized = configured.startsWith("file:") ? configured.slice(5) : configured;

  if (isMisconfiguredWindowsPathOnPosix(normalized)) {
    return "/app/data/growthbase.sqlite";
  }

  if (!isRelativeDatabasePath(normalized)) {
    return normalized;
  }

  return path.resolve(workspaceRoot, normalized);
}

export function createDatabase(filename?: string): GrowthBaseDatabase {
  const resolvedFilename = resolveDatabaseFilename(filename);

  if (resolvedFilename !== ":memory:") {
    fs.mkdirSync(path.dirname(resolvedFilename), { recursive: true });
  }

  const sqlite = new Database(resolvedFilename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return {
    filename: resolvedFilename,
    sqlite,
    db: drizzle(sqlite, { schema }),
    close: () => sqlite.close()
  };
}

export function createInMemoryDatabase(): GrowthBaseDatabase {
  return createDatabase(":memory:");
}

export function parseJsonColumn<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function serializeJsonColumn(value: unknown): string {
  return JSON.stringify(value);
}
