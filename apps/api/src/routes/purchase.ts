import type { Hono } from "hono";

import type { AppDependencies } from "../app";
import { processPurchase } from "../services/purchaseService";

export function registerPurchaseRoutes(app: Hono, deps: AppDependencies) {
  app.post("/purchase/:serviceId", async (c) => processPurchase(c, deps, c.req.param("serviceId")));
}
