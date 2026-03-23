import type { Hono } from "hono";

import { createErrorEnvelope, GrowthBaseError } from "@growthbase/core";

import type { AppDependencies } from "../app";
import { getPurchaseSpec, processPurchase } from "../services/purchaseService";

export function registerPurchaseRoutes(app: Hono, deps: AppDependencies) {
  app.get("/purchase/:serviceId", (c) => {
    try {
      return c.json(getPurchaseSpec(deps, c.req.param("serviceId")));
    } catch (error) {
      if (error instanceof GrowthBaseError) {
        c.status(error.status as any);
        return c.json(error.toEnvelope());
      }

      const message = error instanceof Error ? error.message : "Purchase spec could not be generated.";
      return c.json(createErrorEnvelope("ARTIFACT_GENERATION_FAILED", message), 500);
    }
  });

  app.post("/purchase/:serviceId", async (c) => processPurchase(c, deps, c.req.param("serviceId")));
}
