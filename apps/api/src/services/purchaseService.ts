import { HonoAdapter } from "@x402/hono";
import { z } from "zod";

import {
  GrowthBaseError,
  SCHEMA_VERSION,
  agentIdentityRefSchema,
  createErrorEnvelope,
  delegationPolicySchema
} from "@growthbase/core";
import { deriveGrowthHistory } from "@growthbase/growth";
import {
  appendPaidArtifactFailureRecord,
  appendCommerceReceipt,
  computeRequestHash,
  getReceiptById,
  listReceiptsByAgentWallet,
  listReceiptsByPolicyId,
  reconstructTransaction
} from "@growthbase/receipt";
import {
  assertDelegationPolicyActive,
  assertDelegationPolicyValid,
  assertPriceAllowed,
  assertServiceAllowed
} from "@growthbase/policy";

import type { AppDependencies } from "../app";

const purchaseBodySchema = z.object({
  policy: delegationPolicySchema,
  agentIdentity: agentIdentityRefSchema,
  input: z.unknown()
});

const REQUIRED_PURCHASE_FIELDS = ["policy", "agentIdentity", "input"] as const;
const REQUIRED_POLICY_FIELDS = [
  "policyId",
  "chainId",
  "humanOwner",
  "agentWallet",
  "token",
  "maxTotalSpend",
  "maxPricePerCall",
  "validFrom",
  "validUntil",
  "allowedServices",
  "nonce",
  "signature",
  "schemaVersion"
] as const;
const OPTIONAL_POLICY_FIELDS = ["spenderWallet"] as const;
const REQUIRED_AGENT_IDENTITY_FIELDS = ["standard", "agentRegistry", "agentId", "agentURI", "agentWallet", "schemaVersion"] as const;

function extractVerifiedPayer(paymentEvidence: any): `0x${string}` | null {
  return paymentEvidence?.payer ?? paymentEvidence?.payload?.authorization?.from ?? null;
}

function buildPurchaseSpec(deps: AppDependencies, serviceId: string) {
  const endpoint = `${deps.env.apiBaseUrl}/purchase/${serviceId}`;
  const agentIdentityExample = {
    standard: "ERC-8004",
    agentRegistry: "eip155:8453:0xAGENT_REGISTRY",
    agentId: "1",
    agentURI: "https://agent.example/.well-known/agent.json",
    agentWallet: "0xAGENT_WALLET",
    schemaVersion: SCHEMA_VERSION
  };
  const policyExample = {
    policyId: "policy_example",
    chainId: 8453,
    humanOwner: "0xHUMAN_OWNER",
    agentWallet: "0xAGENT_WALLET",
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    maxTotalSpend: "1.00",
    maxPricePerCall: "0.05",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: "2026-01-02T00:00:00.000Z",
    allowedServices: [serviceId],
    nonce: "policy-nonce-example",
    signature: "0xSIGNED_EIP712_POLICY",
    schemaVersion: SCHEMA_VERSION
  };

  return {
    serviceId,
    endpoint,
    method: "POST",
    bodyType: "application/json",
    schemaVersion: SCHEMA_VERSION,
    requiredTopLevelFields: [...REQUIRED_PURCHASE_FIELDS],
    openPayerDefault: true,
    fixedSpenderOptInField: "policy.spenderWallet",
    payment: {
      method: deps.offer.paymentMethod,
      network: deps.offer.network,
      priceAtomic: deps.offer.price,
      currency: deps.offer.currency,
      payTo: deps.env.x402PayTo,
      flow: [
        "Send the JSON body without x402 payment first and expect HTTP 402.",
        "Retry the exact same POST with verified x402 payment headers."
      ]
    },
    body: {
      policy: {
        requiredFields: [...REQUIRED_POLICY_FIELDS],
        optionalFields: [...OPTIONAL_POLICY_FIELDS],
        openPayerDefault: true,
        notes: [
          "Omit spenderWallet to accept any cryptographically verified payer.",
          "Set spenderWallet to require the verified payer to match one fixed address."
        ],
        example: policyExample,
        fixedSpenderExample: {
          ...policyExample,
          spenderWallet: "0xFIXED_PAYER"
        }
      },
      agentIdentity: {
        requiredFields: [...REQUIRED_AGENT_IDENTITY_FIELDS],
        example: agentIdentityExample
      },
      inputSchema: deps.offer.inputSchema,
      example: {
        policy: policyExample,
        agentIdentity: agentIdentityExample,
        input: deps.serviceAdapter.discovery.input
      }
    },
    inspection: {
      receiptUrlTemplate: `${deps.env.apiBaseUrl}/receipts/{receiptId}`,
      actualPayerFieldPaths: ["buyerWallet", "paymentResponse.payer"]
    }
  };
}

function createPurchaseRequestError(deps: AppDependencies, serviceId: string, message: string, details?: Record<string, unknown>) {
  return createErrorEnvelope("POLICY_INVALID", message, {
    ...details,
    purchaseSpec: buildPurchaseSpec(deps, serviceId)
  });
}

function buildSettledPaymentResponse(
  settlement: { success: true; transaction: string; network: string; extensions?: Record<string, unknown> },
  payer: `0x${string}`,
  replayed?: boolean
) {
  return {
    success: settlement.success,
    transaction: settlement.transaction,
    network: settlement.network,
    ...(settlement.extensions ? { extensions: settlement.extensions } : {}),
    ...(typeof replayed === "boolean" ? { replayed } : {}),
    payer
  };
}

function buildPostPaymentFailureDetails(
  details: Record<string, unknown> | undefined,
  paymentResponse: Record<string, unknown>,
  buyerWallet: `0x${string}`,
  extras: Record<string, unknown> = {}
) {
  return {
    ...details,
    ...extras,
    paymentAccepted: true,
    buyerWallet,
    paymentResponse,
    actualPayerFieldPaths: ["buyerWallet", "paymentResponse.payer"]
  };
}

function buildPrePaymentServiceabilityFailureDetails(
  details: Record<string, unknown> | undefined,
  requestHash: `0x${string}`,
  serviceId: string
) {
  return {
    ...details,
    serviceId,
    requestHash,
    executionOutcome: "PRE_PAYMENT_SERVICEABILITY_FAILED",
    retryable: true
  };
}

export async function processPurchase(c: any, deps: AppDependencies, serviceId: string) {
  if (serviceId !== deps.offer.serviceId) {
    return c.json(createErrorEnvelope("SERVICE_NOT_ALLOWED", "Only one service is available in P0.", { serviceId }), 404);
  }

  try {
    const json = await c.req
      .json()
      .catch(() => Symbol.for("invalid_json"));

    if (json === Symbol.for("invalid_json")) {
      return c.json(createPurchaseRequestError(deps, serviceId, "Request body must be valid JSON."), 400);
    }

    const parsedBody = purchaseBodySchema.safeParse(json);

    if (!parsedBody.success) {
      return c.json(
        createPurchaseRequestError(deps, serviceId, "Request body must include policy, agentIdentity, and input.", {
          issues: parsedBody.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }),
        400
      );
    }

    const payload = parsedBody.data;
    const serviceInput = deps.serviceAdapter.parseInput(payload.input);
    const priorReceipts = listReceiptsByPolicyId(deps.database, payload.policy.policyId);
    const priorSpentAtomic = priorReceipts.reduce((total, receipt) => total + BigInt(receipt.price), 0n);

    await assertDelegationPolicyValid(payload.policy);
    assertDelegationPolicyActive(payload.policy, deps.isPolicyRevoked(payload.policy.policyId));
    assertServiceAllowed(payload.policy, serviceId);
    assertPriceAllowed(payload.policy, deps.offer.price, priorSpentAtomic);

    if (payload.agentIdentity.agentWallet.toLowerCase() !== payload.policy.agentWallet.toLowerCase()) {
      throw new GrowthBaseError("POLICY_INVALID", "Agent identity does not match the delegated agent wallet.", 403, {
        policyId: payload.policy.policyId
      });
    }

    const requestHash = computeRequestHash({
      policyId: payload.policy.policyId,
      serviceId: deps.offer.serviceId,
      agentWallet: payload.policy.agentWallet as `0x${string}`,
      input: serviceInput,
      schemaVersion: SCHEMA_VERSION
    });

    try {
      await deps.serviceAdapter.assessServiceability({
        database: deps.database,
        policyId: payload.policy.policyId,
        agentWallet: payload.policy.agentWallet as `0x${string}`,
        input: serviceInput
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Service is temporarily unavailable.";
      const details = buildPrePaymentServiceabilityFailureDetails(
        error instanceof GrowthBaseError ? error.details : undefined,
        requestHash,
        serviceId
      );

      return c.json(createErrorEnvelope("PRE_PAYMENT_SERVICEABILITY_FAILED", message, details), 503);
    }

    const paymentResult = await deps.httpServer.processHTTPRequest({
      adapter: new HonoAdapter(c),
      path: c.req.path,
      method: c.req.method,
      paymentHeader: c.req.header("payment-signature") ?? c.req.header("PAYMENT-SIGNATURE") ?? undefined
    });

    if (paymentResult.type === "payment-error") {
      if (paymentResult.response.status === 402) {
        deps.serviceAdapter.metrics.quoteCount += 1;
      }

      return applyResponseInstructions(c, paymentResult.response);
    }

    if (paymentResult.type !== "payment-verified") {
      throw new GrowthBaseError("PAYMENT_FAILED", "Payment verification did not complete.", 402);
    }

    const payer = extractVerifiedPayer(paymentResult.paymentPayload);

    if (!payer) {
      deps.serviceAdapter.metrics.paidFailureCount += 1;
      return c.json(
        createErrorEnvelope("PAYMENT_FAILED", "Verified payment evidence did not include a payer address."),
        402
      );
    }

    if (payload.policy.spenderWallet && payer.toLowerCase() !== payload.policy.spenderWallet.toLowerCase()) {
      deps.serviceAdapter.metrics.paidFailureCount += 1;
      return c.json(
        createErrorEnvelope("POLICY_INVALID", "Payment payer does not match the delegated spender wallet.", {
          expected: payload.policy.spenderWallet,
          received: payer
        }),
        403
      );
    }

    const settlement = await deps.httpServer.processSettlement(
      paymentResult.paymentPayload,
      paymentResult.paymentRequirements,
      paymentResult.declaredExtensions
    );

    if (!settlement.success) {
      deps.serviceAdapter.metrics.paidFailureCount += 1;
      return applyResponseInstructions(c, settlement.response);
    }

    const settledPayer = (extractVerifiedPayer(settlement) ?? payer) as `0x${string}`;
    const settledPaymentResponse = buildSettledPaymentResponse(settlement, settledPayer);

    let run;

    try {
      run = await deps.serviceAdapter.runPaid({
        database: deps.database,
        policyId: payload.policy.policyId,
        agentWallet: payload.policy.agentWallet as `0x${string}`,
        input: serviceInput
      });
    } catch (error) {
      const failureCode = error instanceof GrowthBaseError ? error.code : "ARTIFACT_GENERATION_FAILED";
      const failureMessage = error instanceof Error ? error.message : "Artifact generation failed.";
      const failureStatus = error instanceof GrowthBaseError ? error.status : 500;
      const failureDetails = error instanceof GrowthBaseError ? error.details : undefined;

      try {
        const failureRecord = appendPaidArtifactFailureRecord({
          database: deps.database,
          policy: payload.policy,
          offer: deps.offer,
          agentIdentity: payload.agentIdentity,
          input: serviceInput,
          paymentScheme: paymentResult.paymentRequirements.scheme,
          paymentNetwork: paymentResult.paymentRequirements.network,
          paymentAsset: ((paymentResult.paymentRequirements as { asset?: string }).asset ??
            payload.policy.token) as `0x${string}`,
          paymentResponse: settledPaymentResponse,
          buyerWallet: settledPayer,
          failureCode,
          failureMessage,
          failureDetails
        });
        const paymentFailureDetails = buildPostPaymentFailureDetails(failureDetails, settledPaymentResponse, settledPayer, {
          serviceId,
          requestHash,
          executionOutcome: "PAYMENT_ACCEPTED_ARTIFACT_FAILED",
          deliveryStatus: "PAID_BUT_ARTIFACT_FAILED",
          artifactFailureCode: failureCode,
          artifactFailureStatus: failureStatus,
          failureRecordId: failureRecord.failureId,
          durableRecordPersisted: true
        });

        return c.json(
          createErrorEnvelope("PAYMENT_ACCEPTED_ARTIFACT_FAILED", failureMessage, paymentFailureDetails),
          failureStatus,
          settlement.headers
        );
      } catch (durabilityError) {
        const paymentFailureDetails = buildPostPaymentFailureDetails(failureDetails, settledPaymentResponse, settledPayer, {
          serviceId,
          requestHash,
          executionOutcome: "PAYMENT_ACCEPTED_ARTIFACT_FAILED",
          deliveryStatus: "PAID_BUT_ARTIFACT_FAILED",
          artifactFailureCode: failureCode,
          artifactFailureStatus: failureStatus,
          durableRecordPersisted: false,
          durabilityWriteError: durabilityError instanceof Error ? durabilityError.message : "Unknown durability write failure."
        });

        return c.json(
          createErrorEnvelope("PAYMENT_ACCEPTED_ARTIFACT_FAILED", failureMessage, paymentFailureDetails),
          500,
          settlement.headers
        );
      }
    }

    const receipt = appendCommerceReceipt({
      database: deps.database,
      policy: payload.policy,
      offer: deps.offer,
      agentIdentity: payload.agentIdentity,
      input: run.requestRecord.input,
      artifact: run.artifact,
      artifactHash: run.artifactHash,
      snapshotHash: run.snapshotHash,
      proofHash: run.proofHash,
      paymentScheme: paymentResult.paymentRequirements.scheme,
      paymentNetwork: paymentResult.paymentRequirements.network,
      paymentResponse: {
        ...settledPaymentResponse,
        replayed: run.replayed
      },
      buyerWallet: settledPayer,
      deliveryStatus: run.deliveryStatus,
      anchorPrivateKey: deps.env.anchorPrivateKey,
      anchorContractAddress: deps.env.receiptAnchorAddress
    });

    const verifyUrl = `${deps.env.publicWebAppUrl}/verify?receiptId=${encodeURIComponent(receipt.receiptId)}`;

    return c.json(
      {
        artifact: run.artifact,
        proof: run.proof,
        receiptId: receipt.receiptId,
        transactionId: settlement.transaction,
        verifyUrl,
        deliveryStatus: receipt.deliveryStatus
      },
      200,
      settlement.headers
    );
  } catch (error) {
    if (error instanceof GrowthBaseError) {
      return c.json(error.toEnvelope(), error.status);
    }

    const message = error instanceof Error ? error.message : "Artifact generation failed.";
    return c.json(createErrorEnvelope("ARTIFACT_GENERATION_FAILED", message), 500);
  }
}

export function buildReceiptRoutesState(deps: AppDependencies) {
  return {
    getReceiptById: (receiptId: string) => getReceiptById(deps.database, receiptId),
    listAgentReceipts: (agentWallet: string) => listReceiptsByAgentWallet(deps.database, agentWallet),
    listGrowthHistory: (agentWallet: string) => deriveGrowthHistory(deps.database, agentWallet),
    reconstructTransaction: (receiptId: string) => reconstructTransaction(deps.database, receiptId)
  };
}

export function getPurchaseSpec(deps: AppDependencies, serviceId: string) {
  if (serviceId !== deps.offer.serviceId) {
    throw new GrowthBaseError("SERVICE_NOT_ALLOWED", "Only one service is available in P0.", 404, { serviceId });
  }

  return buildPurchaseSpec(deps, serviceId);
}

function applyResponseInstructions(c: any, response: { status: number; headers: Record<string, string>; body?: unknown }) {
  for (const [key, value] of Object.entries(response.headers)) {
    c.header(key, value);
  }

  return c.json(response.body ?? {}, response.status);
}
