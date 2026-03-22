import {
  PolymarketSnapshotNormalizer,
  createHiddenEdgeServiceAdapter,
  createPolymarketDataAdapter,
  createPolymarketDiscoveryAdapter
} from "@growthbase/hidden-edge";

import type { ApiEnv } from "../env";
import { createFixtureMarketDataAdapter, createFixtureMarketDiscoveryAdapter } from "./fixtureHiddenEdge";
import { createSellerIdentity } from "./profile";

type HiddenEdgeRuntimeOverrides = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function createConfiguredHiddenEdgeServiceAdapter(
  env: ApiEnv,
  overrides: HiddenEdgeRuntimeOverrides = {}
) {
  const sellerIdentity = createSellerIdentity(env);

  if (env.marketDataMode === "fixture") {
    return createHiddenEdgeServiceAdapter({
      sellerWallet: env.sellerWallet,
      sellerIdentity,
      marketDiscovery: createFixtureMarketDiscoveryAdapter(),
      marketData: createFixtureMarketDataAdapter(),
      snapshotNormalizer: new PolymarketSnapshotNormalizer(),
      now: overrides.now
    });
  }

  return createHiddenEdgeServiceAdapter({
    sellerWallet: env.sellerWallet,
    sellerIdentity,
    marketDiscovery: createPolymarketDiscoveryAdapter({
      fetchImpl: overrides.fetchImpl,
      gammaBaseUrl: env.polymarketGammaBaseUrl,
      eventSlugs: env.polymarketEventSlugs,
      marketSlugs: env.polymarketMarketSlugs,
      fetchTimeoutMs: env.polymarketFetchTimeoutMs,
      failClosed: true,
      now: overrides.now
    }),
    marketData: createPolymarketDataAdapter({
      fetchImpl: overrides.fetchImpl,
      clobBaseUrl: env.polymarketClobBaseUrl,
      fetchTimeoutMs: env.polymarketFetchTimeoutMs,
      maxBookAgeMs: env.polymarketMaxBookAgeMs,
      failClosed: true,
      now: overrides.now
    }),
    snapshotNormalizer: new PolymarketSnapshotNormalizer({ failClosed: true }),
    now: overrides.now
  });
}
