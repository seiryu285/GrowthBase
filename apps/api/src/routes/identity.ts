import type { Hono } from "hono";

import type { AppDependencies } from "../app";

export function registerIdentityRoutes(app: Hono, deps: AppDependencies) {
  app.get("/agent-profile", (c) => c.json(deps.profile));
  app.get("/.well-known/agent-registration.json", (c) => c.json(deps.registration));
}
