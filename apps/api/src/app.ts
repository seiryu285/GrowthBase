import { Hono } from "hono";
import { eq } from "drizzle-orm";

import { createDatabase, policyRevocations, runMigrations, type GrowthBaseDatabase } from "@growthbase/db";

import type { ApiEnv } from "./env";
import { loadEnv } from "./env";
import { registerGrowthRoutes } from "./routes/growth";
import { registerIdentityRoutes } from "./routes/identity";
import { registerOfferRoutes } from "./routes/offers";
import { registerPurchaseRoutes } from "./routes/purchase";
import { registerReceiptRoutes } from "./routes/receipts";
import { getCatalog } from "./services/catalog";
import { createConfiguredHiddenEdgeServiceAdapter } from "./services/hiddenEdgeRuntime";
import { createPaymentServer } from "./services/localX402";
import { loadAgentProfile, loadAgentRegistration } from "./services/profile";
import type { ServiceAdapter } from "./services/serviceAdapter";

export type AppDependencies = {
  env: ApiEnv;
  database: GrowthBaseDatabase;
  serviceAdapter: ServiceAdapter;
  offer: ServiceAdapter["offer"];
  catalog: ReturnType<typeof getCatalog>;
  profile: ReturnType<typeof loadAgentProfile>;
  registration: ReturnType<typeof loadAgentRegistration>;
  httpServer: Awaited<ReturnType<typeof createPaymentServer>>["httpServer"];
  isPolicyRevoked: (policyId: string) => boolean;
};

export async function createApp(overrides?: Partial<Pick<AppDependencies, "env" | "database" | "serviceAdapter">>) {
  const env = overrides?.env ?? loadEnv();
  const database = overrides?.database ?? createDatabase(env.databaseUrl);

  await runMigrations(database);

  const serviceAdapter: ServiceAdapter = overrides?.serviceAdapter ?? createConfiguredHiddenEdgeServiceAdapter(env);
  const offer = serviceAdapter.offer;
  const catalog = getCatalog(serviceAdapter);
  const profile = loadAgentProfile(env, offer);
  const registration = loadAgentRegistration(env, offer);
  const x402 = await createPaymentServer(env, serviceAdapter);

  const deps: AppDependencies = {
    env,
    database,
    serviceAdapter,
    offer,
    catalog,
    profile,
    registration,
    httpServer: x402.httpServer,
    isPolicyRevoked: (policyId) =>
      Boolean(
        database.db
          .select()
          .from(policyRevocations)
          .where(eq(policyRevocations.policyId, policyId))
          .get()
      )
  };

  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "GrowthBase API",
      serviceId: offer.serviceId
    })
  );

  registerOfferRoutes(app, deps);
  registerPurchaseRoutes(app, deps);
  registerReceiptRoutes(app, deps);
  registerGrowthRoutes(app, deps);
  registerIdentityRoutes(app, deps);

  return { app, deps };
}
