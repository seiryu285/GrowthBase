import type { Hono } from "hono";

import type { AppDependencies } from "../app";
import { buildReceiptRoutesState } from "../services/purchaseService";

export function registerGrowthRoutes(app: Hono, deps: AppDependencies) {
  const state = buildReceiptRoutesState(deps);

  app.get("/agents/:agentWallet/growth-history", (c) =>
    c.json({ entries: state.listGrowthHistory(c.req.param("agentWallet")) })
  );
}
