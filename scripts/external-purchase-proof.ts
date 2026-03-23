import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";

import { SERVICE_ID, type HiddenEdgeScanInput } from "@growthbase/core";

import {
  buildHiddenEdgePurchaseBody,
  createDemoAgentIdentity,
  createSignedPolicy,
  getApiBaseUrl,
  spenderAccount
} from "../apps/agent-demo/src/client";

const DEFAULT_INPUT: HiddenEdgeScanInput = {
  universe: "auto",
  sidePolicy: "BOTH",
  requestedNotionalUsd: 100,
  maxCandidates: 5,
  riskMode: "standard",
  maxBookAgeMs: 15000
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const LIVE_RAILWAY_API_BASE_URL = "https://growthbase-production.up.railway.app";

type ProofTarget = "live" | "deterministic-demo";

async function main() {
  const apiBaseUrl = resolveApiBaseUrl().replace(/\/$/, "");
  const proofTarget = resolveProofTarget(apiBaseUrl);
  const serviceId = process.env.SERVICE_ID?.trim() || SERVICE_ID;
  const label = process.env.PROOF_LABEL?.trim() || `${proofTarget}-${sanitizeLabel(new URL(apiBaseUrl).hostname)}`;
  const nonce = process.env.POLICY_NONCE?.trim() || `${label}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const input = loadInput();
  const fixedSpenderWallet = getFixedSpenderWallet();
  const agentIdentity = createDemoAgentIdentity();
  const policy = await createSignedPolicy({
    nonce,
    spenderWallet: fixedSpenderWallet
  });
  const body = buildHiddenEdgePurchaseBody({
    policy,
    agentIdentity,
    input
  });
  const output = createOutputPaths(label);

  writeJson(output.bodyRunPath, body);
  writeJson(output.bodyLatestPath, body);

  const spec = await fetchJson(`${apiBaseUrl}/purchase/${serviceId}`, { method: "GET" });
  const unpaid = await fetchJson(`${apiBaseUrl}/purchase/${serviceId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: spenderAccount,
    networks: ["eip155:8453"]
  });

  const paidFetch = wrapFetchWithPayment(fetch, client);
  const paid = await fetchJson(`${apiBaseUrl}/purchase/${serviceId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  }, paidFetch);

  const paidReceiptId =
    typeof paid.body === "object" && paid.body && "receiptId" in paid.body && typeof paid.body.receiptId === "string"
      ? paid.body.receiptId
      : null;
  const receipt = paidReceiptId ? await fetchJson(`${apiBaseUrl}/receipts/${paidReceiptId}`, { method: "GET" }) : null;
  const paidResponsePayment = inspectPaidResponsePayment(paid);
  const evidence = {
    generatedAt: new Date().toISOString(),
    proofTarget,
    apiBaseUrl,
    serviceId,
    spenderAddress: spenderAccount.address,
    expectedRuntimeMode: proofTarget === "live" ? "live" : "fixture",
    policyMode: fixedSpenderWallet ? "fixed-spender" : "open-payer",
    bodyPaths: {
      latest: relativeToWorkspace(output.bodyLatestPath),
      run: relativeToWorkspace(output.bodyRunPath)
    },
    spec,
    unpaid,
    unpaidChallenge: parsePaymentRequired(unpaid),
    paid,
    paidChallenge: parsePaymentRequired(paid),
    paidResponsePayment,
    receipt,
    actualPayerInspection: {
      receiptFieldPaths: ["buyerWallet", "paymentResponse.payer"],
      paidResponseFieldPaths: ["error.details.buyerWallet", "error.details.paymentResponse.payer"],
      receiptValues:
        receipt && typeof receipt.body === "object" && receipt.body
          ? {
              buyerWallet: "buyerWallet" in receipt.body ? receipt.body.buyerWallet : null,
              paymentResponsePayer:
                "paymentResponse" in receipt.body &&
                receipt.body.paymentResponse &&
                typeof receipt.body.paymentResponse === "object" &&
                "payer" in receipt.body.paymentResponse
                  ? receipt.body.paymentResponse.payer
                  : null
            }
          : null,
      paidResponseValues: paidResponsePayment
    },
    rerun: {
      liveRailwayCommand:
        "set PROOF_TARGET=live && set API_BASE_URL=https://growthbase-production.up.railway.app && set GROWTHBASE_SPENDER_PRIVATE_KEY=0xYOUR_FUNDED_BASE_USDC_KEY && pnpm.cmd proof:external",
      deterministicDemoCommand:
        "set PROOF_TARGET=deterministic-demo && set API_BASE_URL=https://YOUR-FIXTURE-HOST && pnpm.cmd proof:external"
    }
  };

  writeJson(output.evidenceRunPath, evidence);
  writeJson(output.evidenceLatestPath, evidence);

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        proofTarget,
        serviceId,
        policyMode: evidence.policyMode,
        specStatus: spec.status,
        unpaidStatus: unpaid.status,
        paidStatus: paid.status,
        paymentAccepted: paidResponsePayment?.paymentAccepted ?? false,
        paidResponsePayer: paidResponsePayment?.paymentResponsePayer ?? null,
        failureRecordId: paidResponsePayment?.failureRecordId ?? null,
        receiptId: paidReceiptId,
        evidencePath: relativeToWorkspace(output.evidenceLatestPath),
        bodyPath: relativeToWorkspace(output.bodyLatestPath)
      },
      null,
      2
    )
  );
}

function createOutputPaths(label: string) {
  const proofDir = path.join(workspaceRoot, "data", "proofs");
  fs.mkdirSync(proofDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = `${label}-${timestamp}`;

  return {
    bodyRunPath: path.join(proofDir, `purchase-body-${suffix}.json`),
    bodyLatestPath: path.join(proofDir, `purchase-body-${label}.latest.json`),
    evidenceRunPath: path.join(proofDir, `external-purchase-proof-${suffix}.json`),
    evidenceLatestPath: path.join(proofDir, `external-purchase-proof-${label}.latest.json`)
  };
}

function loadInput(): HiddenEdgeScanInput {
  if (!process.env.HIDDEN_EDGE_INPUT_JSON?.trim()) {
    return { ...DEFAULT_INPUT };
  }

  return {
    ...DEFAULT_INPUT,
    ...(JSON.parse(process.env.HIDDEN_EDGE_INPUT_JSON) as Partial<HiddenEdgeScanInput>)
  };
}

function getFixedSpenderWallet(): `0x${string}` | undefined {
  if (process.env.POLICY_SPENDER_WALLET?.trim()) {
    return process.env.POLICY_SPENDER_WALLET.trim() as `0x${string}`;
  }

  return process.env.FORCE_FIXED_SPENDER === "1" ? spenderAccount.address : undefined;
}

async function fetchJson(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(url, init);
  const text = await response.text();

  return {
    url,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: tryParseJson(text) ?? text
  };
}

function parsePaymentRequired(result: Awaited<ReturnType<typeof fetchJson>>) {
  try {
    return new x402HTTPClient(new x402Client()).getPaymentRequiredResponse(
      (name) => result.headers[name.toLowerCase()] ?? null,
      result.body
    );
  } catch {
    return null;
  }
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function sanitizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolveApiBaseUrl() {
  if (process.env.API_BASE_URL?.trim()) {
    return process.env.API_BASE_URL.trim();
  }

  const configuredTarget = process.env.PROOF_TARGET?.trim();

  if (configuredTarget === "live" && process.env.LIVE_API_BASE_URL?.trim()) {
    return process.env.LIVE_API_BASE_URL.trim();
  }

  if (configuredTarget === "deterministic-demo" && process.env.DEMO_API_BASE_URL?.trim()) {
    return process.env.DEMO_API_BASE_URL.trim();
  }

  return getApiBaseUrl();
}

function resolveProofTarget(apiBaseUrl: string): ProofTarget {
  const configuredTarget = process.env.PROOF_TARGET?.trim();

  if (configuredTarget === "live" || configuredTarget === "deterministic-demo") {
    return configuredTarget;
  }

  return apiBaseUrl.includes(LIVE_RAILWAY_API_BASE_URL.replace(/^https?:\/\//, "")) ? "live" : "deterministic-demo";
}

function inspectPaidResponsePayment(result: Awaited<ReturnType<typeof fetchJson>>) {
  if (!result.body || typeof result.body !== "object" || !("error" in result.body)) {
    return null;
  }

  const error = result.body.error;

  if (!error || typeof error !== "object" || !("details" in error)) {
    return null;
  }

  const details = error.details;

  if (!details || typeof details !== "object") {
    return null;
  }

  const paymentResponse =
    "paymentResponse" in details && details.paymentResponse && typeof details.paymentResponse === "object"
      ? details.paymentResponse
      : null;

  return {
    errorCode: "code" in error ? error.code : null,
    paymentAccepted: "paymentAccepted" in details ? details.paymentAccepted : null,
    buyerWallet: "buyerWallet" in details ? details.buyerWallet : null,
    executionOutcome: "executionOutcome" in details ? details.executionOutcome : null,
    deliveryStatus: "deliveryStatus" in details ? details.deliveryStatus : null,
    artifactFailureCode: "artifactFailureCode" in details ? details.artifactFailureCode : null,
    failureRecordId: "failureRecordId" in details ? details.failureRecordId : null,
    paymentResponsePayer: paymentResponse && "payer" in paymentResponse ? paymentResponse.payer : null,
    paymentResponseTransaction: paymentResponse && "transaction" in paymentResponse ? paymentResponse.transaction : null,
    paymentResponseNetwork: paymentResponse && "network" in paymentResponse ? paymentResponse.network : null
  };
}

function writeJson(targetPath: string, value: unknown) {
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

function relativeToWorkspace(targetPath: string) {
  return path.relative(workspaceRoot, targetPath).replace(/\\/g, "/");
}

await main();
