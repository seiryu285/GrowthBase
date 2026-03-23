import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

import {
  SCHEMA_VERSION,
  SERVICE_ID,
  hiddenEdgeInputSchema,
  type AgentIdentityRef,
  type DelegationPolicy,
  type HiddenEdgeScanArtifact,
  type HiddenEdgeScanInput,
  type HiddenEdgeScanProof
} from "@growthbase/core";
import {
  attachDelegationSignature,
  createUnsignedDelegationPolicy,
  delegationPolicyTypedData,
  getDelegationPolicyDomain,
  getDelegationPolicyMessage
} from "@growthbase/policy";

import { getPurchaseApiBaseUrl } from "./purchaseApiBase";

/** Default dev keys (Anvil-style); override via env for real hosts — mirrors `apps/agent-demo`. */
const DEFAULT_HUMAN_PK = "0x59c6995e998f97a5a0044966f094538c5f8fb9d5392b6f0dff78eaef918a1960" as const;
const DEFAULT_AGENT_PK = "0x8b3a350cf5c34c9194ca4e293f4b25d1ce058c6b05c9010d6ea3dcb3ce1f4b54" as const;
const DEFAULT_SPENDER_PK = "0x0dbbe8f4f4b9b7cbdeb18f0bc33bd583a14bc58c41cab36161f245d36b2b1f7f" as const;

function envOrDefaultHexKey(value: string | undefined, fallback: `0x${string}`): `0x${string}` {
  const trimmed = value?.trim();
  return (trimmed ? trimmed : fallback) as `0x${string}`;
}

const HUMAN_PRIVATE_KEY = envOrDefaultHexKey(process.env.GROWTHBASE_HUMAN_PRIVATE_KEY, DEFAULT_HUMAN_PK);
const AGENT_PRIVATE_KEY = envOrDefaultHexKey(process.env.GROWTHBASE_AGENT_PRIVATE_KEY, DEFAULT_AGENT_PK);
const SPENDER_PRIVATE_KEY = envOrDefaultHexKey(process.env.GROWTHBASE_SPENDER_PRIVATE_KEY, DEFAULT_SPENDER_PK);

const humanAccount = privateKeyToAccount(HUMAN_PRIVATE_KEY);
const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);
const spenderAccount = privateKeyToAccount(SPENDER_PRIVATE_KEY);

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDemoInput(): HiddenEdgeScanInput {
  return hiddenEdgeInputSchema.parse({
    universe: process.env.GROWTHBASE_DEMO_UNIVERSE ?? "auto",
    sidePolicy: process.env.GROWTHBASE_DEMO_SIDE_POLICY ?? "BOTH",
    requestedNotionalUsd: readNumberEnv("GROWTHBASE_DEMO_REQUESTED_NOTIONAL_USD", 100),
    maxCandidates: readNumberEnv("GROWTHBASE_DEMO_MAX_CANDIDATES", 10),
    riskMode: process.env.GROWTHBASE_DEMO_RISK_MODE ?? "standard",
    maxBookAgeMs: readNumberEnv("GROWTHBASE_DEMO_MAX_BOOK_AGE_MS", 15000)
  });
}

async function createPaidFetch() {
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: spenderAccount,
    networks: ["eip155:8453"]
  });
  return wrapFetchWithPayment(fetch, client);
}

function createDemoAgentIdentity(): AgentIdentityRef {
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
  spenderWallet?: `0x${string}`;
};

async function createSignedPolicy(options: CreateSignedPolicyOptions = {}) {
  const now = Date.now();
  const unsigned = createUnsignedDelegationPolicy({
    chainId: 8453,
    humanOwner: humanAccount.address,
    agentWallet: agentAccount.address,
    spenderWallet: options.spenderWallet,
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

type HiddenEdgePurchaseBody = {
  policy: DelegationPolicy;
  agentIdentity: AgentIdentityRef;
  input: HiddenEdgeScanInput;
};

export type DemoPurchaseSuccess = {
  artifact: HiddenEdgeScanArtifact;
  proof: HiddenEdgeScanProof;
  receiptId: string;
  transactionId: string;
  verifyUrl: string;
  deliveryStatus: string;
};

async function postPurchaseRequest(
  fetchImpl: typeof fetch,
  body: HiddenEdgePurchaseBody,
  baseUrl: string
) {
  return fetchImpl(`${baseUrl}/purchase/${SERVICE_ID}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

/**
 * Full client path: JSON body → POST (402 + x402 retry with payment header) → 200 JSON.
 * Same behavior as `apps/agent-demo` `purchaseHiddenEdgeScan`.
 */
export async function runDemoPurchase(): Promise<DemoPurchaseSuccess> {
  const baseUrl = getPurchaseApiBaseUrl();
  const fetchWithPayment = await createPaidFetch();
  const input = getDemoInput();

  const body: HiddenEdgePurchaseBody = {
    policy: await createSignedPolicy(),
    agentIdentity: createDemoAgentIdentity(),
    input
  };

  const response = await postPurchaseRequest(fetchWithPayment, body, baseUrl);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Purchase failed (${response.status}): ${text}`);
  }

  return (await response.json()) as DemoPurchaseSuccess;
}
