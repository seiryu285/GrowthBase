import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  buildHiddenEdgePurchaseBody,
  createDemoAgentIdentity,
  createPaidFetch,
  createSignedPolicy,
  fetchGrowthHistory,
  fetchReceipt,
  fetchVerifyBundle,
  getApiBaseUrl,
  probeHiddenEdgePurchase,
  purchaseHiddenEdgeScan
} from "./client";

const DEFAULT_INPUT = {
  universe: "auto",
  sidePolicy: "BOTH",
  requestedNotionalUsd: 100,
  maxCandidates: 5,
  riskMode: "standard",
  maxBookAgeMs: 10000
} as const;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../../..");

async function main() {
  const apiBaseUrl = getApiBaseUrl();
  const proofLabel = process.env.PROOF_LABEL?.trim() || "live";
  const nonce = process.env.POLICY_NONCE?.trim() || `${proofLabel}-proof-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const input = loadInput();
  const agentIdentity = createDemoAgentIdentity();
  const policy = await createSignedPolicy({ nonce });
  const body = buildHiddenEdgePurchaseBody({
    policy,
    agentIdentity,
    input
  });

  const unpaid = await probeHiddenEdgePurchase(body, apiBaseUrl);
  const unpaidChallenge = unpaid.headers.get("payment-required") ?? unpaid.headers.get("PAYMENT-REQUIRED");

  if (unpaid.status !== 402 || !unpaidChallenge) {
    throw new Error(`Expected unpaid probe to return 402 with payment-required header, received ${unpaid.status}.`);
  }

  const paidFetch = await createPaidFetch();
  const purchase = await purchaseHiddenEdgeScan(paidFetch, input, apiBaseUrl, {
    policy,
    agentIdentity
  });
  const receipt = await fetchReceipt(purchase.receiptId, apiBaseUrl);
  const growthHistory = await fetchGrowthHistory(agentIdentity.agentWallet, apiBaseUrl);
  const reconstruction = await fetchVerifyBundle(purchase.receiptId, apiBaseUrl);

  const output = {
    proofLabel,
    apiBaseUrl,
    nonce,
    input,
    unpaid: {
      status: unpaid.status,
      challengeHeaderPresent: Boolean(unpaidChallenge)
    },
    paid: {
      status: 200,
      receiptId: purchase.receiptId,
      deliveryStatus: purchase.deliveryStatus
    },
    receipt: {
      receiptId: receipt.receiptId,
      receiptHash: receipt.receiptHash,
      requestHash: receipt.requestHash,
      artifactHash: receipt.artifactHash,
      snapshotHash: receipt.snapshotHash,
      proofHash: receipt.proofHash,
      paymentResponse: receipt.paymentResponse
    },
    artifact: {
      scanId: purchase.artifact.scanId,
      snapshotId: purchase.artifact.snapshotId,
      asOf: purchase.artifact.asOf,
      marketsScanned: purchase.artifact.marketsScanned,
      marketsEligible: purchase.artifact.marketsEligible,
      topCandidate: purchase.artifact.candidates[0] ?? null
    },
    snapshot: {
      snapshotId: reconstruction.snapshot.snapshotId,
      asOf: reconstruction.snapshot.asOf,
      sourceMode: reconstruction.snapshot.sourceMode ?? null,
      fetchedAt: reconstruction.snapshot.fetchedAt ?? null,
      provenance: reconstruction.snapshot.provenance ?? null,
      marketCount: reconstruction.snapshot.markets.length
    },
    growth: {
      latestReceiptId: growthHistory[0]?.receiptId ?? null,
      latestServiceId: growthHistory[0]?.serviceId ?? null,
      entryCount: growthHistory.length
    },
    verification: reconstruction.verification
  };

  const outputPath = writeProofOutput(proofLabel, purchase.receiptId, output);
  console.log(JSON.stringify({ ...output, outputPath }, null, 2));
}

function loadInput() {
  if (!process.env.HIDDEN_EDGE_INPUT_JSON?.trim()) {
    return { ...DEFAULT_INPUT };
  }

  return {
    ...DEFAULT_INPUT,
    ...(JSON.parse(process.env.HIDDEN_EDGE_INPUT_JSON) as Record<string, unknown>)
  };
}

function writeProofOutput(proofLabel: string, receiptId: string, output: Record<string, unknown>) {
  const proofDir = path.join(workspaceRoot, "data", "proofs");
  fs.mkdirSync(proofDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runPath = path.join(proofDir, `hidden-edge-${proofLabel}-proof-${timestamp}-${receiptId}.json`);
  const latestPath = path.join(proofDir, `hidden-edge-${proofLabel}-proof.latest.json`);
  const serialized = JSON.stringify(output, null, 2);

  fs.writeFileSync(runPath, serialized);
  fs.writeFileSync(latestPath, serialized);

  return latestPath;
}

await main();
