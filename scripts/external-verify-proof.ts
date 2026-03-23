import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { hiddenEdgeInputSchema, SERVICE_ID, type HiddenEdgeScanInput } from "@growthbase/core";

import {
  buildHiddenEdgePurchaseBody,
  createDemoAgentIdentity,
  createPaidFetch,
  createSignedPolicy,
  getApiBaseUrl,
  getDemoInput,
  postPurchaseRequest,
  spenderAccount,
  type HiddenEdgePurchaseSuccess,
  type VerifyTransactionBundle
} from "../apps/agent-demo/src/client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");

type FailureClassification =
  | "PRE_PAYMENT_SERVICEABILITY_FAILED"
  | "PAYMENT_ACCEPTED_ARTIFACT_FAILED"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_FAILED"
  | "ARTIFACT_GENERATION_FAILED"
  | "insufficient_funds"
  | "UNKNOWN";

async function main() {
  const apiBaseUrl = getApiBaseUrl().replace(/\/$/, "");
  const proofLabel = process.env.PROOF_LABEL?.trim() || "external-verify";
  const nonce = process.env.POLICY_NONCE?.trim() || `${proofLabel}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const input = loadInput();
  const agentIdentity = createDemoAgentIdentity();
  const policy = await createSignedPolicy({ nonce, spenderWallet: getFixedSpenderWallet() });

  let paidFetch: typeof fetch;
  try {
    paidFetch = await createPaidFetch();
  } catch (error) {
    const output = buildFailureOutput(proofLabel, apiBaseUrl, "paid_fetch_init", {
      message: error instanceof Error ? error.message : String(error)
    });
    const paths = writeFailureProofOutput(proofLabel, output);
    printSummary({ outcome: "failure", proofPaths: paths, ...output });
    process.exitCode = 1;
    return;
  }

  const body = buildHiddenEdgePurchaseBody({
    policy,
    agentIdentity,
    input
  });

  const purchaseResponse = await postPurchaseRequest(paidFetch, body, apiBaseUrl);
  const purchaseText = await purchaseResponse.text();
  const purchaseBody = tryParseJson(purchaseText);

  if (!purchaseResponse.ok) {
    const classification = classifyHttpFailure(purchaseResponse.status, purchaseBody, purchaseText);
    const output = buildFailureOutput(proofLabel, apiBaseUrl, "purchase", {
      httpStatus: purchaseResponse.status,
      classification,
      responseBody: purchaseBody,
      responseTextSample: truncate(purchaseText, 8000)
    });
    const paths = writeFailureProofOutput(proofLabel, output);
    printSummary({
      outcome: "failure",
      failureStage: "purchase",
      receiptId: null,
      transactionId: null,
      verifyUrl: null,
      fullyVerified: null,
      classification,
      proofPaths: paths
    });
    process.exitCode = 1;
    return;
  }

  const purchase = purchaseBody as Partial<HiddenEdgePurchaseSuccess>;
  if (!purchase.receiptId || typeof purchase.receiptId !== "string") {
    const output = buildFailureOutput(proofLabel, apiBaseUrl, "purchase_parse", {
      httpStatus: purchaseResponse.status,
      classification: "UNKNOWN" as FailureClassification,
      responseBody: purchaseBody,
      message: "200 response missing receiptId"
    });
    const paths = writeFailureProofOutput(proofLabel, output);
    printSummary({ outcome: "failure", proofPaths: paths, ...output });
    process.exitCode = 1;
    return;
  }

  const receiptUrl = `${apiBaseUrl}/receipts/${encodeURIComponent(purchase.receiptId)}`;
  const receiptRes = await fetch(receiptUrl);
  const receiptText = await receiptRes.text();
  const receiptJson = tryParseJson(receiptText);

  if (!receiptRes.ok) {
    const output = buildFailureOutput(proofLabel, apiBaseUrl, "receipt_fetch", {
      receiptId: purchase.receiptId,
      purchaseSummary: pickPurchaseSummary(purchase),
      httpStatus: receiptRes.status,
      classification: "UNKNOWN",
      responseBody: receiptJson,
      responseTextSample: truncate(receiptText, 8000)
    });
    const paths = writeFailureProofOutput(proofLabel, output);
    printSummary({
      outcome: "failure",
      failureStage: "receipt_fetch",
      receiptId: purchase.receiptId,
      transactionId: purchase.transactionId ?? null,
      verifyUrl: purchase.verifyUrl ?? null,
      fullyVerified: null,
      proofPaths: paths
    });
    process.exitCode = 1;
    return;
  }

  const bundleUrl = `${apiBaseUrl}/receipts/${encodeURIComponent(purchase.receiptId)}/verify-bundle`;
  const bundleRes = await fetch(bundleUrl);
  const bundleText = await bundleRes.text();
  const bundleJson = tryParseJson(bundleText);

  if (!bundleRes.ok) {
    const output = buildFailureOutput(proofLabel, apiBaseUrl, "verify_bundle_fetch", {
      receiptId: purchase.receiptId,
      purchaseSummary: pickPurchaseSummary(purchase),
      receipt: receiptJson,
      httpStatus: bundleRes.status,
      classification: "UNKNOWN",
      responseBody: bundleJson,
      responseTextSample: truncate(bundleText, 8000)
    });
    const paths = writeFailureProofOutput(proofLabel, output);
    printSummary({
      outcome: "failure",
      failureStage: "verify_bundle_fetch",
      receiptId: purchase.receiptId,
      transactionId: purchase.transactionId ?? null,
      verifyUrl: purchase.verifyUrl ?? null,
      fullyVerified: null,
      proofPaths: paths
    });
    process.exitCode = 1;
    return;
  }

  const verifyBundle = bundleJson as VerifyTransactionBundle;
  const successOutput = {
    generatedAt: new Date().toISOString(),
    proofKind: "external-verify-bundle",
    outcome: "success" as const,
    apiBaseUrl,
    serviceId: SERVICE_ID,
    purchase: {
      receiptId: purchase.receiptId,
      transactionId: purchase.transactionId,
      verifyUrl: purchase.verifyUrl,
      deliveryStatus: purchase.deliveryStatus,
      artifact: purchase.artifact,
      proof: purchase.proof
    },
    receipt: receiptJson,
    verifyBundle,
    verification: verifyBundle.verification
  };

  const paths = writeSuccessProofOutput(proofLabel, purchase.receiptId, successOutput);

  printSummary({
    outcome: "success",
    receiptId: purchase.receiptId,
    transactionId: purchase.transactionId,
    verifyUrl: purchase.verifyUrl,
    fullyVerified: verifyBundle.verification.fullyVerified,
    proofPaths: paths
  });
}

function pickPurchaseSummary(purchase: Partial<HiddenEdgePurchaseSuccess>) {
  return {
    receiptId: purchase.receiptId,
    transactionId: purchase.transactionId,
    verifyUrl: purchase.verifyUrl,
    deliveryStatus: purchase.deliveryStatus
  };
}

function buildFailureOutput(
  proofLabel: string,
  apiBaseUrl: string,
  failureStage: string,
  details: Record<string, unknown>
) {
  return {
    generatedAt: new Date().toISOString(),
    proofKind: "external-verify-bundle-failure",
    outcome: "failure" as const,
    proofLabel,
    apiBaseUrl,
    serviceId: SERVICE_ID,
    failureStage,
    ...details
  };
}

function classifyHttpFailure(
  status: number,
  body: unknown,
  rawText: string
): FailureClassification {
  const code = getEnvelopeCode(body);
  const haystack = `${rawText} ${JSON.stringify(body)}`.toLowerCase();

  if (code === "ARTIFACT_GENERATION_FAILED") {
    return "ARTIFACT_GENERATION_FAILED";
  }
  if (code === "PRE_PAYMENT_SERVICEABILITY_FAILED" || status === 503) {
    return "PRE_PAYMENT_SERVICEABILITY_FAILED";
  }
  if (code === "PAYMENT_ACCEPTED_ARTIFACT_FAILED") {
    return "PAYMENT_ACCEPTED_ARTIFACT_FAILED";
  }
  if (status === 402) {
    if (code === "PAYMENT_REQUIRED" || code === "PAYMENT_FAILED") {
      if (haystack.includes("insufficient") || haystack.includes("underfund") || haystack.includes("balance")) {
        return "insufficient_funds";
      }
      return code === "PAYMENT_REQUIRED" ? "PAYMENT_REQUIRED" : "PAYMENT_FAILED";
    }
    if (haystack.includes("insufficient") || haystack.includes("underfund")) {
      return "insufficient_funds";
    }
    return "PAYMENT_REQUIRED";
  }
  if (code === "PAYMENT_FAILED") {
    return "PAYMENT_FAILED";
  }
  if (haystack.includes("insufficient") && haystack.includes("fund")) {
    return "insufficient_funds";
  }
  return "UNKNOWN";
}

function getEnvelopeCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const err = (body as { error?: { code?: string } }).error;
  return err && typeof err.code === "string" ? err.code : undefined;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function loadInput(): HiddenEdgeScanInput {
  const base = getDemoInput();
  if (!process.env.HIDDEN_EDGE_INPUT_JSON?.trim()) {
    return base;
  }

  return hiddenEdgeInputSchema.parse({
    ...base,
    ...(JSON.parse(process.env.HIDDEN_EDGE_INPUT_JSON) as Record<string, unknown>)
  });
}

function getFixedSpenderWallet(): `0x${string}` | undefined {
  if (process.env.POLICY_SPENDER_WALLET?.trim()) {
    return process.env.POLICY_SPENDER_WALLET.trim() as `0x${string}`;
  }

  return process.env.FORCE_FIXED_SPENDER === "1" ? spenderAccount.address : undefined;
}

function writeSuccessProofOutput(proofLabel: string, receiptId: string, output: Record<string, unknown>) {
  const proofDir = path.join(workspaceRoot, "data", "proofs");
  fs.mkdirSync(proofDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runPath = path.join(proofDir, `external-verify-proof-${proofLabel}-${timestamp}-${receiptId}.json`);
  const latestPath = path.join(proofDir, `external-verify-proof-${proofLabel}.latest.json`);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;

  fs.writeFileSync(runPath, serialized);
  fs.writeFileSync(latestPath, serialized);

  return {
    run: path.relative(workspaceRoot, runPath).replace(/\\/g, "/"),
    latest: path.relative(workspaceRoot, latestPath).replace(/\\/g, "/")
  };
}

function writeFailureProofOutput(proofLabel: string, output: Record<string, unknown>) {
  const proofDir = path.join(workspaceRoot, "data", "proofs");
  fs.mkdirSync(proofDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runPath = path.join(proofDir, `external-verify-proof-${proofLabel}-failure-${timestamp}.json`);
  const latestPath = path.join(proofDir, `external-verify-proof-${proofLabel}.failure.latest.json`);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;

  fs.writeFileSync(runPath, serialized);
  fs.writeFileSync(latestPath, serialized);

  return {
    run: path.relative(workspaceRoot, runPath).replace(/\\/g, "/"),
    latest: path.relative(workspaceRoot, latestPath).replace(/\\/g, "/")
  };
}

function printSummary(payload: Record<string, unknown>) {
  console.log(JSON.stringify(payload, null, 2));
}

await main();
