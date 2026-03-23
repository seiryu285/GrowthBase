import { afterEach, describe, expect, it, vi } from "vitest";

import { GrowthBaseError } from "@growthbase/core";
import { createInMemoryDatabase, runMigrations } from "@growthbase/db";

import { createConfiguredHiddenEdgeServiceAdapter } from "../../apps/api/src/services/hiddenEdgeRuntime";
import { agentAccount, createHiddenEdgeInput, createTestEnv } from "../helpers";

const FIXED_NOW = "2026-03-22T00:00:10.000Z";
const FRESH_BOOK_TS = "2026-03-22T00:00:08.000Z";
const STALE_BOOK_TS = "2026-03-21T23:59:54.000Z";
const LIVE_DEFAULT_MAX_BOOK_AGE_MS = 15000;
const EVENT_SLUG = "fed-decision-in-october";

describe("market-data runtime mode", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("normalizes live Polymarket data into snapshot provenance metadata", async () => {
    const database = createInMemoryDatabase();
    cleanups.push(() => database.close());
    await runMigrations(database);

    const fetchMock = createPolymarketFetchMock({ bookTimestamp: FRESH_BOOK_TS });
    const env = {
      ...createTestEnv(),
      marketDataMode: "live" as const,
      polymarketGammaBaseUrl: "https://gamma.example",
      polymarketClobBaseUrl: "https://clob.example",
      polymarketEventSlugs: [EVENT_SLUG]
    };
    const service = createConfiguredHiddenEdgeServiceAdapter(env, {
      fetchImpl: fetchMock,
      now: () => new Date(FIXED_NOW)
    });

    const result = await service.runPaid({
      database,
      policyId: "policy_live_test",
      agentWallet: agentAccount.address,
      input: createHiddenEdgeInput()
    });

    expect(result.snapshot.sourceMode).toBe("live");
    expect(result.snapshot.fetchedAt).toBe(FIXED_NOW);
    expect(result.snapshot.provenance).toMatchObject({
      discovery: {
        strategy: "configured-slugs",
        configuredEventSlugs: [EVENT_SLUG]
      },
      marketData: {
        source: "polymarket-clob",
        allowedBookAgeMs: LIVE_DEFAULT_MAX_BOOK_AGE_MS
      }
    });
    expect(result.snapshot.markets[0]).toMatchObject({
      marketId: "market-fed",
      marketSlug: "fed-cut-yes",
      yesTokenId: "token-fed-yes",
      noTokenId: "token-fed-no"
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rejects stale live Polymarket books instead of degrading silently", async () => {
    const database = createInMemoryDatabase();
    cleanups.push(() => database.close());
    await runMigrations(database);

    const env = {
      ...createTestEnv(),
      marketDataMode: "live" as const,
      polymarketGammaBaseUrl: "https://gamma.example",
      polymarketClobBaseUrl: "https://clob.example",
      polymarketEventSlugs: [EVENT_SLUG]
    };
    const service = createConfiguredHiddenEdgeServiceAdapter(env, {
      fetchImpl: createPolymarketFetchMock({ bookTimestamp: STALE_BOOK_TS }),
      now: () => new Date(FIXED_NOW)
    });

    await expect(
      service.runPaid({
        database,
        policyId: "policy_live_stale",
        agentWallet: agentAccount.address,
        input: createHiddenEdgeInput()
      })
    ).rejects.toMatchObject({
      code: "ARTIFACT_GENERATION_FAILED",
      message: "Live Polymarket order book is stale."
    } satisfies Partial<GrowthBaseError>);
  });

  it("fails the pre-payment serviceability check when live books are already stale", async () => {
    const database = createInMemoryDatabase();
    cleanups.push(() => database.close());
    await runMigrations(database);

    const env = {
      ...createTestEnv(),
      marketDataMode: "live" as const,
      polymarketGammaBaseUrl: "https://gamma.example",
      polymarketClobBaseUrl: "https://clob.example",
      polymarketEventSlugs: [EVENT_SLUG]
    };
    const service = createConfiguredHiddenEdgeServiceAdapter(env, {
      fetchImpl: createPolymarketFetchMock({ bookTimestamp: STALE_BOOK_TS }),
      now: () => new Date(FIXED_NOW)
    });

    await expect(
      service.assessServiceability({
        database,
        policyId: "policy_live_preflight_stale",
        agentWallet: agentAccount.address,
        input: createHiddenEdgeInput()
      })
    ).rejects.toMatchObject({
      code: "ARTIFACT_GENERATION_FAILED",
      message: "Live Polymarket order book is stale."
    } satisfies Partial<GrowthBaseError>);
  });

  it("uses the 15000ms live freshness default from env/runtime config", async () => {
    const env = createTestEnv();

    expect(env.polymarketMaxBookAgeMs).toBe(LIVE_DEFAULT_MAX_BOOK_AGE_MS);
  });

  it("uses fixture mode without touching live upstream fetches", async () => {
    const database = createInMemoryDatabase();
    cleanups.push(() => database.close());
    await runMigrations(database);

    const fetchMock = vi.fn(async () => {
      throw new Error("fixture mode should not fetch live Polymarket data");
    });
    const service = createConfiguredHiddenEdgeServiceAdapter(createTestEnv(), {
      fetchImpl: fetchMock,
      now: () => new Date(FIXED_NOW)
    });

    const result = await service.runPaid({
      database,
      policyId: "policy_fixture_mode",
      agentWallet: agentAccount.address,
      input: createHiddenEdgeInput()
    });

    expect(result.snapshot.sourceMode).toBe("fixture");
    expect(result.snapshot.fetchedAt).toBe(FIXED_NOW);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function createPolymarketFetchMock(args: { bookTimestamp: string }) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);

    if (url.hostname === "gamma.example" && url.pathname === "/events" && url.searchParams.get("slug") === EVENT_SLUG) {
      return jsonResponse([
        {
          id: "event-fed",
          slug: EVENT_SLUG,
          title: "Will the Fed cut rates in October?",
          active: true,
          closed: false,
          markets: [
            {
              id: "market-fed",
              slug: "fed-cut-yes",
              question: "Will the Fed cut rates in October?",
              active: true,
              closed: false,
              feeBps: 20,
              tickSize: 0.01,
              clobTokenIds: JSON.stringify(["token-fed-yes", "token-fed-no"]),
              outcomes: JSON.stringify(["Yes", "No"])
            }
          ]
        }
      ]);
    }

    if (url.hostname === "clob.example" && url.pathname === "/book" && url.searchParams.get("token_id") === "token-fed-yes") {
      return jsonResponse(createBookPayload("token-fed-yes", args.bookTimestamp, 0.56, 180, 0.58, 160));
    }

    if (url.hostname === "clob.example" && url.pathname === "/book" && url.searchParams.get("token_id") === "token-fed-no") {
      return jsonResponse(createBookPayload("token-fed-no", args.bookTimestamp, 0.41, 170, 0.43, 150));
    }

    if (url.hostname === "clob.example" && url.pathname === "/prices-history" && url.searchParams.get("market") === "token-fed-yes") {
      return jsonResponse({
        history: [
          { t: "2026-03-21T21:00:00.000Z", p: 0.55 },
          { t: "2026-03-21T22:00:00.000Z", p: 0.56 },
          { t: "2026-03-21T23:00:00.000Z", p: 0.57 }
        ]
      });
    }

    if (url.hostname === "clob.example" && url.pathname === "/prices-history" && url.searchParams.get("market") === "token-fed-no") {
      return jsonResponse({
        history: [
          { t: "2026-03-21T21:00:00.000Z", p: 0.45 },
          { t: "2026-03-21T22:00:00.000Z", p: 0.44 },
          { t: "2026-03-21T23:00:00.000Z", p: 0.43 }
        ]
      });
    }

    throw new Error(`Unhandled fetch: ${url.toString()}`);
  });
}

function createBookPayload(
  tokenId: string,
  timestamp: string,
  bidPrice: number,
  bidSize: number,
  askPrice: number,
  askSize: number
) {
  return {
    market: "condition-fed",
    asset_id: tokenId,
    timestamp,
    tick_size: "0.01",
    bids: [{ price: String(bidPrice), size: String(bidSize) }],
    asks: [{ price: String(askPrice), size: String(askSize) }]
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
