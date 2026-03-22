import { afterEach, describe, expect, it } from "vitest";

import { ARTIFACT_KIND, CAPABILITY_ID, PAYMENT_METHOD, SERVICE_CATEGORY, SERVICE_ID, SERVICE_NETWORK, SERVICE_PRICE_ATOMIC } from "@growthbase/core";

import { createTestHarness } from "../helpers";

describe("offers", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("lists the flagship service in the catalog and direct offer route", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const [catalogResponse, offerResponse] = await Promise.all([
      harness.app.request("http://growthbase.test/offers"),
      harness.app.request(`http://growthbase.test/offers/${SERVICE_ID}`)
    ]);

    expect(catalogResponse.status).toBe(200);
    expect(offerResponse.status).toBe(200);

    const catalog = (await catalogResponse.json()) as { offers: Array<Record<string, unknown>> };
    const offerRoute = (await offerResponse.json()) as { offer: Record<string, unknown> };
    const offer = catalog.offers[0] ?? {};

    expect(offer.serviceId).toBe(SERVICE_ID);
    expect(offer.capabilityId).toBe(CAPABILITY_ID);
    expect(offer.artifactType).toBe(ARTIFACT_KIND);
    expect(offer.network).toBe(SERVICE_NETWORK);
    expect(offer.price).toBe(SERVICE_PRICE_ATOMIC);
    expect(offer.paymentMethod).toBe(PAYMENT_METHOD);
    expect(offer.category).toBe(SERVICE_CATEGORY);
    expect(offer.tags).toEqual([
      "polymarket",
      "scanner",
      "hidden-edge",
      "prediction-market",
      "entry",
      "agents"
    ]);
    expect(offerRoute.offer.serviceId).toBe(SERVICE_ID);
  });
});
