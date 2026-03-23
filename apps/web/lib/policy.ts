import { SCHEMA_VERSION, SERVICE_ID, type UnsignedDelegationPolicy } from "@growthbase/core";
import { createUnsignedDelegationPolicy } from "@growthbase/policy";

export const defaultPolicyForm = {
  chainId: 8453,
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  maxTotalSpend: "1.00",
  maxPricePerCall: "0.05",
  allowedServices: [SERVICE_ID],
  validForHours: 24
};

export function createPolicyPreview(args: {
  humanOwner: `0x${string}`;
  agentWallet: `0x${string}`;
  spenderWallet?: `0x${string}`;
  token: `0x${string}`;
  maxTotalSpend: string;
  maxPricePerCall: string;
  validUntil: string;
  chainId?: number;
}): UnsignedDelegationPolicy {
  return createUnsignedDelegationPolicy({
    chainId: args.chainId ?? defaultPolicyForm.chainId,
    humanOwner: args.humanOwner,
    agentWallet: args.agentWallet,
    spenderWallet: args.spenderWallet,
    token: args.token,
    maxTotalSpend: args.maxTotalSpend,
    maxPricePerCall: args.maxPricePerCall,
    validFrom: new Date().toISOString(),
    validUntil: args.validUntil,
    allowedServices: defaultPolicyForm.allowedServices,
    nonce: crypto.randomUUID()
  });
}
