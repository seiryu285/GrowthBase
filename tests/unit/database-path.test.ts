import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveDatabaseFilename } from "@growthbase/db";

describe("resolveDatabaseFilename (posix)", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { configurable: true, value: originalPlatform });
  });

  it("maps misconfigured Windows-style DATABASE_URL to /app/data/growthbase.sqlite", () => {
    expect(resolveDatabaseFilename("C:/Program Files/Git/data/growthbase.sqlite")).toBe("/app/data/growthbase.sqlite");
  });

  it("preserves explicit POSIX absolute paths", () => {
    expect(resolveDatabaseFilename("/app/data/growthbase.sqlite")).toBe("/app/data/growthbase.sqlite");
  });
});
