import type { TypedData, TypedDataDomain } from "viem";

import type { DelegationPolicy, UnsignedDelegationPolicy } from "@growthbase/core";
import { POLICY_EIP712_NAME, POLICY_EIP712_VERSION } from "@growthbase/core";

export const delegationPolicyTypedData = {
  DelegationPolicy: [
    { name: "policyId", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "humanOwner", type: "address" },
    { name: "agentWallet", type: "address" },
    { name: "spenderWallet", type: "address" },
    { name: "token", type: "address" },
    { name: "maxTotalSpend", type: "string" },
    { name: "maxPricePerCall", type: "string" },
    { name: "validFrom", type: "string" },
    { name: "validUntil", type: "string" },
    { name: "allowedServices", type: "string[]" },
    { name: "nonce", type: "string" },
    { name: "schemaVersion", type: "string" }
  ]
} as const satisfies TypedData;

export function getDelegationPolicyDomain(chainId: number): TypedDataDomain {
  return {
    name: POLICY_EIP712_NAME,
    version: POLICY_EIP712_VERSION,
    chainId
  };
}

export function getDelegationPolicyMessage(policy: DelegationPolicy | UnsignedDelegationPolicy) {
  return {
    policyId: policy.policyId,
    chainId: BigInt(policy.chainId),
    humanOwner: policy.humanOwner as `0x${string}`,
    agentWallet: policy.agentWallet as `0x${string}`,
    spenderWallet: policy.spenderWallet as `0x${string}`,
    token: policy.token as `0x${string}`,
    maxTotalSpend: policy.maxTotalSpend,
    maxPricePerCall: policy.maxPricePerCall,
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
    allowedServices: policy.allowedServices as readonly string[],
    nonce: policy.nonce,
    schemaVersion: policy.schemaVersion
  };
}
