import { describe, expect, it } from "vitest";

import { createHiddenEdgeOffer } from "@growthbase/hidden-edge";

import { createTestEnv } from "../helpers";
import { assertCompatiblePaymentConfig, formatAtomicUsdcPriceForX402 } from "../../apps/api/src/services/localX402";
import { createSellerIdentity } from "../../apps/api/src/services/profile";

describe("x402 payment config", () => {
  it("accepts matching offer and x402 networks", () => {
    const env = createTestEnv();
    const offer = createHiddenEdgeOffer({
      sellerWallet: env.sellerWallet,
      sellerIdentity: createSellerIdentity(env)
    });

    expect(() => assertCompatiblePaymentConfig(env, offer)).not.toThrow();
  });

  it("rejects mismatched offer and x402 networks", () => {
    const env = {
      ...createTestEnv(),
      x402Network: "eip155:84532" as const
    };
    const offer = createHiddenEdgeOffer({
      sellerWallet: env.sellerWallet,
      sellerIdentity: createSellerIdentity(env)
    });

    expect(() => assertCompatiblePaymentConfig(env, offer)).toThrow(
      "X402_NETWORK (eip155:84532) must match offer.network (eip155:8453)"
    );
  });

  it("formats atomic USDC price for x402 money parsing", () => {
    expect(formatAtomicUsdcPriceForX402("50000")).toBe("0.05");
    expect(formatAtomicUsdcPriceForX402("1")).toBe("0.000001");
    expect(formatAtomicUsdcPriceForX402("50000000000")).toBe("50000");
  });
});
