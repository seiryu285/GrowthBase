import { SERVICE_ID, type AgentIdentityRef } from "@growthbase/core";

import { createPolymarketDataAdapter } from "../adapters/polymarket/data";
import { createPolymarketDiscoveryAdapter } from "../adapters/polymarket/discovery";
import { PolymarketSnapshotNormalizer } from "../adapters/polymarket/normalize";
import type { MarketDataAdapter } from "../adapters/marketData";
import type { MarketDiscoveryAdapter } from "../adapters/marketDiscovery";
import type { SnapshotNormalizer } from "../adapters/snapshotNormalizer";
import { createHiddenEdgeDiscoveryMetadata, createHiddenEdgeOffer } from "./offer";
import { createHiddenEdgeRunner, type ServiceMetrics } from "./run";

export type CreateHiddenEdgeServiceAdapterOptions = {
  sellerWallet: `0x${string}`;
  sellerIdentity: AgentIdentityRef;
  marketDiscovery?: MarketDiscoveryAdapter;
  marketData?: MarketDataAdapter;
  snapshotNormalizer?: SnapshotNormalizer;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export function createHiddenEdgeServiceAdapter(options: CreateHiddenEdgeServiceAdapterOptions) {
  const metrics: ServiceMetrics = {
    quoteCount: 0,
    paidRunCount: 0,
    paidSuccessCount: 0,
    paidFailureCount: 0,
    artifactLatencyMsLast: 0,
    snapshotPersistFailureCount: 0,
    proofPersistFailureCount: 0,
    idempotentReplayCount: 0,
    upstreamDegradedCount: 0
  };

  const marketDiscovery =
    options.marketDiscovery ??
    createPolymarketDiscoveryAdapter({
      fetchImpl: options.fetchImpl
    });
  const marketData =
    options.marketData ??
    createPolymarketDataAdapter({
      fetchImpl: options.fetchImpl
    });
  const snapshotNormalizer = options.snapshotNormalizer ?? new PolymarketSnapshotNormalizer();
  const runner = createHiddenEdgeRunner({
    marketDiscovery,
    marketData,
    snapshotNormalizer,
    metrics,
    now: options.now
  });

  return {
    serviceId: SERVICE_ID,
    offer: createHiddenEdgeOffer({
      sellerWallet: options.sellerWallet,
      sellerIdentity: options.sellerIdentity
    }),
    discovery: createHiddenEdgeDiscoveryMetadata(),
    parseInput: runner.parseInput,
    assessServiceability: runner.assessServiceability,
    runPaid: runner.run,
    metrics
  };
}
