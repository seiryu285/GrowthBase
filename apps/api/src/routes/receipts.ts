import type { Hono } from "hono";

import { createErrorEnvelope, GrowthBaseError } from "@growthbase/core";
import { buildVerificationReport, reconstructTransaction } from "@growthbase/receipt";

import type { AppDependencies } from "../app";
import { buildReceiptRoutesState } from "../services/purchaseService";

export function registerReceiptRoutes(app: Hono, deps: AppDependencies) {
  const state = buildReceiptRoutesState(deps);

  app.get("/receipts/:receiptId/verify-bundle", async (c) => {
    const receiptId = c.req.param("receiptId");

    try {
      const bundle = await reconstructTransaction(deps.database, receiptId);
      return c.json({
        ...bundle,
        verificationReport: buildVerificationReport(bundle.verification)
      });
    } catch (cause) {
      if (cause instanceof GrowthBaseError) {
        return c.json(cause.toEnvelope(), cause.status);
      }

      const message = cause instanceof Error ? cause.message : "Verification failed.";
      return c.json(createErrorEnvelope("PAYMENT_FAILED", message, { receiptId }), 500);
    }
  });

  app.get("/receipts/:receiptId", (c) => {
    const receipt = state.getReceiptById(c.req.param("receiptId"));

    if (!receipt) {
      return c.json(createErrorEnvelope("PAYMENT_FAILED", "Receipt not found.", { receiptId: c.req.param("receiptId") }), 404);
    }

    return c.json(receipt);
  });

  app.get("/agents/:agentWallet/receipts", (c) => c.json({ receipts: state.listAgentReceipts(c.req.param("agentWallet")) }));
}
