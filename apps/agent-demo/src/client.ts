import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

import {
  SCHEMA_VERSION,
  SERVICE_ID,
  type AgentIdentityRef,
  type CommerceReceipt,
  type DelegationPolicy,
  type GrowthHistoryEntry,
  type HiddenEdgeScanArtifact,
  type HiddenEdgeScanInput,
  type HiddenEdgeScanProof,
  type ServiceOffer
} from "@growthbase/core";
import {
  attachDelegationSignature,
  createUnsignedDelegationPolicy,
  delegationPolicyTypedData,
  getDelegationPolicyDomain,
  getDelegationPolicyMessage
} from "@growthbase/policy";

const HUMAN_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f094538c5f8fb9d5392b6f0dff78eaef918a1960";
const AGENT_PRIVATE_KEY = "0x8b3a350cf5c34c9194ca4e293f4b25d1ce058c6b05c9010d6ea3dcb3ce1f4b54";
const SPENDER_PRIVATE_KEY = "0x0dbbe8f4f4b9b7cbdeb18f0bc33bd583a14bc58c41cab36161f245d36b2b1f7f";

export const humanAccount = privateKeyToAccount(HUMAN_PRIVATE_KEY);
export const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);
export const spenderAccount = privateKeyToAccount(SPENDER_PRIVATE_KEY);

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}

export async function createPaidFetch() {
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: spenderAccount,
    networks: ["eip155:8453"]
  });
  return wrapFetchWithPayment(fetch, client);
}

export function createDemoAgentIdentity(): AgentIdentityRef {
  return {
    standard: "ERC-8004",
    agentRegistry: "eip155:8453:0x9999999999999999999999999999999999999999",
    agentId: "9001",
    agentURI: "https://demo.growthbase.local/agent.json",
    agentWallet: agentAccount.address,
    schemaVersion: SCHEMA_VERSION
  };
}

type CreateSignedPolicyOptions = {
  nonce?: string;
  validFrom?: string;
  validUntil?: string;
};

export async function createSignedPolicy(options: CreateSignedPolicyOptions = {}) {
  const now = Date.now();
  const unsigned = createUnsignedDelegationPolicy({
    chainId: 8453,
    humanOwner: humanAccount.address,
    agentWallet: agentAccount.address,
    spenderWallet: spenderAccount.address,
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    maxTotalSpend: "1.00",
    maxPricePerCall: "0.05",
    validFrom: options.validFrom ?? new Date(now - 60 * 1000).toISOString(),
    validUntil: options.validUntil ?? new Date(now + 60 * 60 * 1000).toISOString(),
    allowedServices: [SERVICE_ID],
    nonce: options.nonce ?? "demo-policy-1"
  });

  const signature = await humanAccount.signTypedData({
    domain: getDelegationPolicyDomain(unsigned.chainId),
    types: delegationPolicyTypedData,
    primaryType: "DelegationPolicy",
    message: getDelegationPolicyMessage(unsigned)
  });

  return attachDelegationSignature(unsigned, signature);
}

export type HiddenEdgePurchaseBody = {
  policy: DelegationPolicy;
  agentIdentity: AgentIdentityRef;
  input: HiddenEdgeScanInput;
};

export async function discoverOffers(baseUrl = getApiBaseUrl()) {
  const response = await fetch(`${baseUrl}/offers`);
  return (await response.json()) as { offers: ServiceOffer[] };
}

export async function purchaseHiddenEdgeScan(
  fetchWithPayment: typeof fetch,
  input: HiddenEdgeScanInput,
  baseUrl = getApiBaseUrl(),
  options: {
    policy?: DelegationPolicy;
    agentIdentity?: AgentIdentityRef;
  } = {}
) {
  const body = buildHiddenEdgePurchaseBody({
    policy: options.policy ?? (await createSignedPolicy()),
    agentIdentity: options.agentIdentity ?? createDemoAgentIdentity(),
    input
  });
  const response = await submitHiddenEdgePurchase(fetchWithPayment, body, baseUrl);

  if (!response.ok) {
    throw new Error(`Purchase failed with status ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as {
    artifact: HiddenEdgeScanArtifact;
    proof: HiddenEdgeScanProof;
    receiptId: string;
    deliveryStatus: string;
  };
}

export function buildHiddenEdgePurchaseBody(args: HiddenEdgePurchaseBody): HiddenEdgePurchaseBody {
  return {
    policy: args.policy,
    agentIdentity: args.agentIdentity,
    input: args.input
  };
}

export function probeHiddenEdgePurchase(body: HiddenEdgePurchaseBody, baseUrl = getApiBaseUrl()) {
  return submitHiddenEdgePurchase(fetch, body, baseUrl);
}

async function submitHiddenEdgePurchase(fetchImpl: typeof fetch, body: HiddenEdgePurchaseBody, baseUrl: string) {
  return fetchImpl(`${baseUrl}/purchase/${SERVICE_ID}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export async function fetchReceipt(receiptId: string, baseUrl = getApiBaseUrl()) {
  const response = await fetch(`${baseUrl}/receipts/${receiptId}`);
  return (await response.json()) as CommerceReceipt;
}

export async function fetchGrowthHistory(agentWallet = agentAccount.address, baseUrl = getApiBaseUrl()) {
  const response = await fetch(`${baseUrl}/agents/${agentWallet}/growth-history`);
  const json = (await response.json()) as { entries: GrowthHistoryEntry[] };
  return json.entries;
}
