import { describe, expect, it } from "vitest";

import { loadEnv } from "../../apps/api/src/env";

describe("api env defaults", () => {
  it("defaults live Polymarket book freshness to 15000ms", () => {
    const env = loadEnv({});

    expect(env.polymarketMaxBookAgeMs).toBe(15000);
  });

  it("defaults the demo input to the live-friendly baseline", () => {
    const env = loadEnv({});

    expect(env.demoUniverse).toBe("auto");
    expect(env.demoSidePolicy).toBe("BOTH");
    expect(env.demoRequestedNotionalUsd).toBe(100);
    expect(env.demoMaxCandidates).toBe(10);
    expect(env.demoRiskMode).toBe("standard");
    expect(env.demoMaxBookAgeMs).toBe(15000);
  });
});
