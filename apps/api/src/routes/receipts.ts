import type { Hono } from "hono";

import { createErrorEnvelope } from "@growthbase/core";

import type { AppDependencies } from "../app";
import { buildReceiptRoutesState } from "../services/purchaseService";

export function registerReceiptRoutes(app: Hono, deps: AppDependencies) {
  const state = buildReceiptRoutesState(deps);

  app.get("/receipts/:receiptId", (c) => {
    const receipt = state.getReceiptById(c.req.param("receiptId"));

    if (!receipt) {
      return c.json(createErrorEnvelope("PAYMENT_FAILED", "Receipt not found.", { receiptId: c.req.param("receiptId") }), 404);
    }

    return c.json(receipt);
  });

  app.get("/agents/:agentWallet/receipts", (c) => c.json({ receipts: state.listAgentReceipts(c.req.param("agentWallet")) }));
}
