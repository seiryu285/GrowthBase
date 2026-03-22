import { HonoAdapter } from "@x402/hono";
import { z } from "zod";

import {
  GrowthBaseError,
  agentIdentityRefSchema,
  createErrorEnvelope,
  delegationPolicySchema
} from "@growthbase/core";
import { deriveGrowthHistory } from "@growthbase/growth";
import {
  appendCommerceReceipt,
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

function extractPayer(paymentPayload: any): `0x${string}` | null {
  return paymentPayload?.payload?.authorization?.from ?? null;
}

export async function processPurchase(c: any, deps: AppDependencies, serviceId: string) {
  if (serviceId !== deps.offer.serviceId) {
    return c.json(createErrorEnvelope("SERVICE_NOT_ALLOWED", "Only one service is available in P0.", { serviceId }), 404);
  }

  try {
    const payload = purchaseBodySchema.parse(await c.req.json());
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

    const payer = extractPayer(paymentResult.paymentPayload);

    if (!payer || payer.toLowerCase() !== payload.policy.spenderWallet.toLowerCase()) {
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

    const run = await deps.serviceAdapter.runPaid({
      database: deps.database,
      policyId: payload.policy.policyId,
      agentWallet: payload.policy.agentWallet,
      input: serviceInput
    });

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
        ...settlement,
        payer,
        replayed: run.replayed
      },
      buyerWallet: payer,
      deliveryStatus: run.deliveryStatus,
      anchorPrivateKey: deps.env.anchorPrivateKey,
      anchorContractAddress: deps.env.receiptAnchorAddress
    });

    return c.json(
      {
        artifact: run.artifact,
        proof: run.proof,
        receiptId: receipt.receiptId,
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

function applyResponseInstructions(c: any, response: { status: number; headers: Record<string, string>; body?: unknown }) {
  for (const [key, value] of Object.entries(response.headers)) {
    c.header(key, value);
  }

  return c.json(response.body ?? {}, response.status);
}
