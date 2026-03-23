import { describe, expect, it } from "vitest";

import { createHiddenEdgeOffer } from "@growthbase/hidden-edge";
import { generateAgentRegistration } from "@growthbase/identity";

import { createTestEnv } from "../helpers";
import { loadAgentProfile } from "../../apps/api/src/services/profile";
import { createSellerIdentity } from "../../apps/api/src/services/profile";

describe("identity", () => {
  it("generates ERC-8004-compatible registration JSON", () => {
    const env = createTestEnv();
    const offer = createHiddenEdgeOffer({
      sellerWallet: env.sellerWallet,
      sellerIdentity: createSellerIdentity(env)
    });
    const profile = loadAgentProfile(env, offer);
    const registration = generateAgentRegistration(profile);

    expect(registration.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    expect(registration.registrations[0]?.agentRegistry).toBe(profile.identity.agentRegistry);
    expect(registration.x402Support).toBe(true);
    expect(profile.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "purchase-spec",
          endpoint: `${env.apiBaseUrl}/purchase/${offer.serviceId}`
        })
      ])
    );
  });
});
