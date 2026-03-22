import {
  hashCanonicalValue,
  hashToDeterministicUuid,
  persistedNormalizedSnapshotSchema,
  type PersistedNormalizedSnapshot
} from "@growthbase/core";

import type { MarketDataResult } from "./marketData";
import type { MarketDiscoveryResult } from "./marketDiscovery";

export type SnapshotNormalizationInput = {
  requestHash: `0x${string}`;
  discovery: MarketDiscoveryResult;
  marketData: MarketDataResult;
};

export interface SnapshotNormalizer {
  normalize(input: SnapshotNormalizationInput): PersistedNormalizedSnapshot;
}

export function computeNormalizedSnapshotHash(snapshot: PersistedNormalizedSnapshot): `0x${string}` {
  return hashCanonicalValue({
    ...snapshot,
    snapshotId: undefined,
    markets: snapshot.markets.map((market) => ({
      ...market,
      snapshotId: undefined
    }))
  });
}

export function finalizeNormalizedSnapshot(
  snapshot: Omit<PersistedNormalizedSnapshot, "snapshotId" | "markets"> & {
    markets: Array<Omit<PersistedNormalizedSnapshot["markets"][number], "snapshotId">>;
  }
): PersistedNormalizedSnapshot {
  const baseSnapshot = persistedNormalizedSnapshotSchema.parse({
    ...snapshot,
    snapshotId: "00000000-0000-5000-8000-000000000000",
    markets: snapshot.markets.map((market) => ({
      ...market,
      snapshotId: "00000000-0000-5000-8000-000000000000"
    }))
  });
  const snapshotHash = computeNormalizedSnapshotHash(baseSnapshot);
  const snapshotId = hashToDeterministicUuid(snapshotHash);
  return persistedNormalizedSnapshotSchema.parse({
    ...snapshot,
    snapshotId,
    markets: snapshot.markets.map((market) => ({
      ...market,
      snapshotId
    }))
  });
}
