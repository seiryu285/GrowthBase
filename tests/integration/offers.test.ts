import { afterEach, describe, expect, it, vi } from "vitest";

import { ARTIFACT_KIND, CAPABILITY_ID, PAYMENT_METHOD, SERVICE_CATEGORY, SERVICE_ID, SERVICE_NETWORK, SERVICE_PRICE_ATOMIC } from "@growthbase/core";
import { GrowthBaseError } from "@growthbase/core";

import { createHiddenEdgeInput, createSignedPolicy, createTestAgentIdentity, createTestHarness } from "../helpers";

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
    const offerRoute = (await offerResponse.json()) as {
      offer: Record<string, unknown>;
      purchase: { endpoint: string; method: string; specUrl: string };
    };
    const offer = catalog.offers[0] ?? {};

    expect(offer.serviceId).toBe(SERVICE_ID);
    expect(offer.capabilityId).toBe(CAPABILITY_ID);
    expect(offer.artifactType).toBe(ARTIFACT_KIND);
    expect(offer.network).toBe(SERVICE_NETWORK);
    expect(offer.price).toBe(SERVICE_PRICE_ATOMIC);
    expect(offer.paymentMethod).toBe(PAYMENT_METHOD);
    expect(offer.category).toBe(SERVICE_CATEGORY);
    expect((offer.inputSchema as any)?.properties?.maxBookAgeMs).toMatchObject({
      minimum: 1000,
      maximum: 15000,
      default: 15000
    });
    expect(offer.tags).toEqual([
      "polymarket",
      "scanner",
      "hidden-edge",
      "prediction-market",
      "entry",
      "agents"
    ]);
    expect(offerRoute.offer.serviceId).toBe(SERVICE_ID);
    expect(offerRoute.purchase).toMatchObject({
      endpoint: `http://growthbase.test/purchase/${SERVICE_ID}`,
      method: "POST",
      specUrl: `http://growthbase.test/purchase/${SERVICE_ID}`
    });
    expect((offerRoute.offer.inputSchema as any)?.properties?.maxBookAgeMs?.default).toBe(15000);
  });

  it("reports live readiness for the recommended demo input", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.app.request(`http://growthbase.test/offers/${SERVICE_ID}/live-readiness`);
    const json = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      serviceId: SERVICE_ID,
      runtimeMode: "fixture",
      recommendedInput: {
        universe: "auto",
        sidePolicy: "BOTH",
        requestedNotionalUsd: 100,
        maxCandidates: 10,
        riskMode: "standard",
        maxBookAgeMs: 15000
      },
      readiness: {
        ok: true,
        sourceMode: "fixture",
        replayed: false
      }
    });
  });

  it("returns a non-charging readiness failure summary when serviceability is blocked", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    harness.deps.serviceAdapter.assessServiceability = vi.fn(async () => {
      throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket order book is stale.", 502, {
        sourceMode: "live",
        marketId: "824952"
      });
    });

    const response = await harness.app.request(`http://growthbase.test/offers/${SERVICE_ID}/live-readiness`);
    const json = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      serviceId: SERVICE_ID,
      readiness: {
        ok: false,
        code: "ARTIFACT_GENERATION_FAILED",
        status: 502,
        message: "Live Polymarket order book is stale.",
        details: {
          sourceMode: "live",
          marketId: "824952"
        }
      }
    });
  });

  it("returns the latest delivered artifact bundle for the flagship service", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const paid = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy(),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(paid.status).toBe(200);

    const purchase = (await paid.json()) as { receiptId: string };
    const latest = await harness.app.request(`http://growthbase.test/offers/${SERVICE_ID}/latest-artifact`);
    const json = (await latest.json()) as Record<string, any>;

    expect(latest.status).toBe(200);
    expect(json.receiptId).toBe(purchase.receiptId);
    expect(json.bundle?.receipt?.receiptId).toBe(purchase.receiptId);
    expect(Array.isArray(json.bundle?.artifact?.candidates)).toBe(true);
  });
});
