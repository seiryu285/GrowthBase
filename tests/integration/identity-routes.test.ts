import { afterEach, describe, expect, it } from "vitest";

import { createTestHarness } from "../helpers";

describe("identity routes", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("serves the profile and registration JSON", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const [profileResponse, registrationResponse] = await Promise.all([
      harness.app.request("http://growthbase.test/agent-profile"),
      harness.app.request("http://growthbase.test/.well-known/agent-registration.json")
    ]);

    expect(profileResponse.status).toBe(200);
    expect(registrationResponse.status).toBe(200);

    const profile = (await profileResponse.json()) as { identity: { agentRegistry: string } };
    const registration = (await registrationResponse.json()) as { type: string; registrations: Array<{ agentRegistry: string }> };

    expect(registration.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    expect(registration.registrations[0]?.agentRegistry).toBe(profile.identity.agentRegistry);
  });
});
