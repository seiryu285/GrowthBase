import type { Hono } from "hono";

import { createErrorEnvelope } from "@growthbase/core";

import type { AppDependencies } from "../app";

export function registerOfferRoutes(app: Hono, deps: AppDependencies) {
  app.get("/offers", (c) => c.json(deps.catalog));

  app.get("/offers/:serviceId", (c) => {
    const serviceId = c.req.param("serviceId");

    if (serviceId !== deps.offer.serviceId) {
      return c.json(createErrorEnvelope("SERVICE_NOT_ALLOWED", "Unknown service.", { serviceId }), 404);
    }

    return c.json({
      offer: deps.offer,
      discovery: deps.catalog.discovery[0]
    });
  });
}
