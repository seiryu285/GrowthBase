import { describe, expect, it } from "vitest";

import { GrowthBaseError } from "@growthbase/core";
import {
  assertDelegationPolicyActive,
  assertDelegationPolicyValid,
  assertPriceAllowed,
  assertServiceAllowed,
  verifyDelegationPolicySignature
} from "@growthbase/policy";

import { createSignedPolicy } from "../helpers";

describe("policy", () => {
  it("accepts a valid policy signature", async () => {
    const policy = await createSignedPolicy();
    await expect(verifyDelegationPolicySignature(policy)).resolves.toBe(true);
    await expect(assertDelegationPolicyValid(policy)).resolves.toBeUndefined();
  });

  it("rejects an invalid policy signature", async () => {
    const policy = await createSignedPolicy();
    policy.maxPricePerCall = "0.04";

    await expect(verifyDelegationPolicySignature(policy)).resolves.toBe(false);
    await expect(assertDelegationPolicyValid(policy)).rejects.toMatchObject<GrowthBaseError>({
      code: "POLICY_INVALID"
    });
  });

  it("rejects an expired policy", async () => {
    const policy = await createSignedPolicy({
      validFrom: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      validUntil: new Date(Date.now() - 60 * 60 * 1000).toISOString()
    });

    expect(() => assertDelegationPolicyActive(policy)).toThrowError(GrowthBaseError);
  });

  it("rejects a disallowed service", async () => {
    const policy = await createSignedPolicy({ allowedServices: ["other-service"] });

    expect(() => assertServiceAllowed(policy, "some-other-service")).toThrowError(GrowthBaseError);
  });

  it("rejects over-price requests", async () => {
    const policy = await createSignedPolicy();

    expect(() => assertPriceAllowed(policy, "50001")).toThrowError(GrowthBaseError);
  });
});
