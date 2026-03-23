import { and, desc, eq } from "drizzle-orm";
import type { Hono } from "hono";

import { createErrorEnvelope, GrowthBaseError } from "@growthbase/core";
import { receiptRecords } from "@growthbase/db";
import { reconstructTransaction } from "@growthbase/receipt";

import type { AppDependencies } from "../app";
import { getRecommendedLiveDemoInput, parseLiveDemoInputOverrides } from "../services/liveDemoConfig";

export function registerOfferRoutes(app: Hono, deps: AppDependencies) {
  app.get("/offers", (c) => c.json(deps.catalog));

  app.get("/offers/:serviceId", (c) => {
    const serviceId = c.req.param("serviceId");

    if (serviceId !== deps.offer.serviceId) {
      return c.json(createErrorEnvelope("SERVICE_NOT_ALLOWED", "Unknown service.", { serviceId }), 404);
    }

    return c.json({
      offer: deps.offer,
      discovery: deps.catalog.discovery[0],
      purchase: {
        endpoint: `${deps.env.apiBaseUrl}/purchase/${serviceId}`,
        method: "POST",
        specUrl: `${deps.env.apiBaseUrl}/purchase/${serviceId}`
      }
    });
  });

  app.get("/offers/:serviceId/live-readiness", async (c) => {
    const serviceId = c.req.param("serviceId");

    if (serviceId !== deps.offer.serviceId) {
      return c.json(createErrorEnvelope("SERVICE_NOT_ALLOWED", "Unknown service.", { serviceId }), 404);
    }

    let input;
    try {
      input = parseLiveDemoInputOverrides(c.req.query(), deps.env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid live readiness input.";
      return c.json(createErrorEnvelope("POLICY_INVALID", message, { serviceId, query: c.req.query() }), 400);
    }

    try {
      const readiness = await deps.serviceAdapter.assessServiceability({
        database: deps.database,
        policyId: `live-readiness:${serviceId}`,
        agentWallet: deps.env.agentWallet,
        input
      });

      return c.json({
        serviceId,
        runtimeMode: deps.env.marketDataMode,
        recommendedInput: getRecommendedLiveDemoInput(deps.env),
        checkedInput: input,
        configuredEventSlugs: deps.env.polymarketEventSlugs,
        configuredMarketSlugs: deps.env.polymarketMarketSlugs,
        readiness: {
          ok: true,
          checkedAt: readiness.checkedAt,
          sourceMode: readiness.sourceMode,
          replayed: readiness.replayed,
          message: "Current live input passed the pre-payment serviceability gate."
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Serviceability check failed.";

      return c.json({
        serviceId,
        runtimeMode: deps.env.marketDataMode,
        recommendedInput: getRecommendedLiveDemoInput(deps.env),
        checkedInput: input,
        configuredEventSlugs: deps.env.polymarketEventSlugs,
        configuredMarketSlugs: deps.env.polymarketMarketSlugs,
        readiness: {
          ok: false,
          checkedAt: new Date().toISOString(),
          code: error instanceof GrowthBaseError ? error.code : "ARTIFACT_GENERATION_FAILED",
          status: error instanceof GrowthBaseError ? error.status : 503,
          message,
          details: error instanceof GrowthBaseError ? error.details : undefined
        }
      });
    }
  });

  app.get("/offers/:serviceId/latest-artifact", async (c) => {
    const serviceId = c.req.param("serviceId");

    if (serviceId !== deps.offer.serviceId) {
      return c.json(createErrorEnvelope("SERVICE_NOT_ALLOWED", "Unknown service.", { serviceId }), 404);
    }

    const latestReceipt = deps.database.db
      .select({
        receiptId: receiptRecords.receiptId,
        timestamp: receiptRecords.timestamp
      })
      .from(receiptRecords)
      .where(and(eq(receiptRecords.serviceId, serviceId), eq(receiptRecords.deliveryStatus, "DELIVERED")))
      .orderBy(desc(receiptRecords.timestamp))
      .get();

    if (!latestReceipt) {
      return c.json(
        createErrorEnvelope("PAYMENT_FAILED", "No delivered live artifact is stored for this service yet.", { serviceId }),
        404
      );
    }

    try {
      const bundle = await reconstructTransaction(deps.database, latestReceipt.receiptId);

      return c.json({
        serviceId,
        receiptId: latestReceipt.receiptId,
        timestamp: latestReceipt.timestamp,
        verifyBundleUrl: `${deps.env.apiBaseUrl}/receipts/${latestReceipt.receiptId}/verify-bundle`,
        bundle
      });
    } catch (cause) {
      if (cause instanceof GrowthBaseError) {
        return c.json(cause.toEnvelope(), cause.status);
      }

      const message = cause instanceof Error ? cause.message : "Latest artifact could not be reconstructed.";
      return c.json(createErrorEnvelope("PAYMENT_FAILED", message, { serviceId, receiptId: latestReceipt.receiptId }), 500);
    }
  });
}
