import { createDatabase, runMigrations } from "@growthbase/db";

let databasePromise: Promise<ReturnType<typeof createDatabase>> | null = null;

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export async function fetchApiJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${pathname}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getWebDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = createDatabase(process.env.DATABASE_URL);
      await runMigrations(database);
      return database;
    })();
  }

  return databasePromise;
}
