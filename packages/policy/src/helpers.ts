import {
  GrowthBaseError,
  SCHEMA_VERSION,
  SERVICE_ID,
  delegationPolicySchema,
  hashCanonicalValue,
  shortHashId,
  stripKeys,
  type DelegationPolicy,
  type PolicyStatus,
  type UnsignedDelegationPolicy,
  unsignedDelegationPolicySchema,
  usdDecimalToAtomic
} from "@growthbase/core";
import { policyStatusSchema } from "@growthbase/core";
import { verifyTypedData } from "viem";

import { delegationPolicyTypedData, getDelegationPolicyDomain, getDelegationPolicyMessage } from "./eip712";

type PolicyDraftInput = Omit<UnsignedDelegationPolicy, "policyId" | "schemaVersion"> & {
  policyId?: string;
};

export function createUnsignedDelegationPolicy(input: PolicyDraftInput): UnsignedDelegationPolicy {
  const spenderWallet = input.spenderWallet ?? undefined;
  const draft = unsignedDelegationPolicySchema.parse({
    ...input,
    spenderWallet,
    policyId:
      input.policyId ??
      shortHashId(
        "policy",
        hashCanonicalValue({
          humanOwner: input.humanOwner,
          agentWallet: input.agentWallet,
          spenderWallet,
          nonce: input.nonce,
          chainId: input.chainId
        })
      ),
    schemaVersion: SCHEMA_VERSION
  });

  return draft;
}

export function attachDelegationSignature(
  policy: UnsignedDelegationPolicy,
  signature: `0x${string}`
): DelegationPolicy {
  return delegationPolicySchema.parse({
    ...policy,
    signature
  });
}

export function computeDelegationPolicyHash(policy: DelegationPolicy | UnsignedDelegationPolicy): `0x${string}` {
  const unsignedPolicy =
    "signature" in policy ? stripKeys(policy as DelegationPolicy, ["signature"]) : (policy as UnsignedDelegationPolicy);
  return hashCanonicalValue(unsignedPolicy);
}

export async function verifyDelegationPolicySignature(policy: DelegationPolicy): Promise<boolean> {
  const parsed = delegationPolicySchema.parse(policy);
  return verifyTypedData({
    address: parsed.humanOwner as `0x${string}`,
    domain: getDelegationPolicyDomain(parsed.chainId),
    types: delegationPolicyTypedData,
    primaryType: "DelegationPolicy",
    message: getDelegationPolicyMessage(parsed),
    signature: parsed.signature as `0x${string}`
  });
}

export function getDelegationPolicyStatus(
  policy: DelegationPolicy | UnsignedDelegationPolicy,
  revoked = false,
  now = new Date()
): PolicyStatus {
  if (revoked) {
    return policyStatusSchema.parse("REVOKED");
  }

  if (now.getTime() > new Date(policy.validUntil).getTime()) {
    return policyStatusSchema.parse("EXPIRED");
  }

  return policyStatusSchema.parse("ACTIVE");
}

export function assertDelegationPolicyActive(
  policy: DelegationPolicy | UnsignedDelegationPolicy,
  revoked = false,
  now = new Date()
): PolicyStatus {
  const status = getDelegationPolicyStatus(policy, revoked, now);

  if (status === "EXPIRED" || status === "REVOKED") {
    throw new GrowthBaseError("POLICY_EXPIRED", `Delegation policy is ${status.toLowerCase()}.`, 403, {
      policyId: policy.policyId,
      policyStatus: status
    });
  }

  return status;
}

export function assertServiceAllowed(policy: DelegationPolicy | UnsignedDelegationPolicy, serviceId = SERVICE_ID): void {
  if (!policy.allowedServices.includes(serviceId)) {
    throw new GrowthBaseError("SERVICE_NOT_ALLOWED", "Delegation policy does not allow this service.", 403, {
      policyId: policy.policyId,
      serviceId
    });
  }
}

export function assertPriceAllowed(
  policy: DelegationPolicy | UnsignedDelegationPolicy,
  price: string,
  priorSpent = 0n
): void {
  const priceAtomic = BigInt(price);
  const maxPerCall = usdDecimalToAtomic(policy.maxPricePerCall);
  const maxTotal = usdDecimalToAtomic(policy.maxTotalSpend);

  if (priceAtomic > maxPerCall || priorSpent + priceAtomic > maxTotal) {
    throw new GrowthBaseError("PRICE_EXCEEDS_POLICY", "Requested price exceeds delegation policy limits.", 403, {
      policyId: policy.policyId,
      price,
      priorSpent: priorSpent.toString()
    });
  }
}

export async function assertDelegationPolicyValid(policy: DelegationPolicy): Promise<void> {
  delegationPolicySchema.parse(policy);

  const isValid = await verifyDelegationPolicySignature(policy);

  if (!isValid) {
    throw new GrowthBaseError("POLICY_INVALID", "Delegation policy signature verification failed.", 403, {
      policyId: policy.policyId
    });
  }
}
