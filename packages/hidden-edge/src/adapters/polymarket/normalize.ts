import {
  GrowthBaseError,
  persistedNormalizedSnapshotSchema,
  type PersistedNormalizedSnapshot
} from "@growthbase/core";

import {
  finalizeNormalizedSnapshot,
  type SnapshotNormalizationInput,
  type SnapshotNormalizer
} from "../snapshotNormalizer";

type PolymarketSnapshotNormalizerOptions = {
  failClosed?: boolean;
};

export class PolymarketSnapshotNormalizer implements SnapshotNormalizer {
  private readonly failClosed: boolean;

  constructor(options: PolymarketSnapshotNormalizerOptions = {}) {
    this.failClosed = options.failClosed ?? false;
  }

  normalize(input: SnapshotNormalizationInput): PersistedNormalizedSnapshot {
    const byMarketId = new Map(input.marketData.records.map((record) => [record.marketId, record]));
    const normalizationIssues: string[] = [];
    const markets = input.discovery.descriptors
      .map((descriptor) => {
        const record = byMarketId.get(descriptor.marketId);

        if (!record) {
          normalizationIssues.push(`missing market data for ${descriptor.marketId}`);
          return null;
        }

        const bestYesBid = record.yesBook.bids[0];
        const bestYesAsk = record.yesBook.asks[0];
        const bestNoBid = record.noBook.bids[0];
        const bestNoAsk = record.noBook.asks[0];

        if (!bestYesBid || !bestYesAsk || !bestNoBid || !bestNoAsk) {
          normalizationIssues.push(`missing best bid/ask quotes for ${descriptor.marketId}`);
          return null;
        }

        const tickSize = descriptor.tickSize ?? record.tickSize ?? record.yesBook.tickSize ?? record.noBook.tickSize ?? 0.01;

        return {
          marketId: descriptor.marketId,
          eventId: descriptor.eventId,
          marketSlug: descriptor.marketSlug,
          eventTitle: descriptor.eventTitle,
          yesTokenId: descriptor.yesTokenId,
          noTokenId: descriptor.noTokenId,
          bestYesBid: bestYesBid.price,
          bestYesBidSize: bestYesBid.size,
          bestYesAsk: bestYesAsk.price,
          bestYesAskSize: bestYesAsk.size,
          bestNoBid: bestNoBid.price,
          bestNoBidSize: bestNoBid.size,
          bestNoAsk: bestNoAsk.price,
          bestNoAskSize: bestNoAsk.size,
          midProbYes: roundProbability((bestYesBid.price + bestYesAsk.price) / 2),
          midProbNo: roundProbability((bestNoBid.price + bestNoAsk.price) / 2),
          historyMeanYes: computeHistoryMean(record.yesHistory),
          historyMeanNo: computeHistoryMean(record.noHistory),
          feeBps: Math.max(0, Math.round(record.feeBps ?? descriptor.feeBps ?? 0)),
          tickSize,
          observedAt: record.observedAt,
          rawRefs: {
            ...descriptor.rawRefs,
            ...record.rawRefs
          }
        };
      })
      .filter((market): market is Omit<PersistedNormalizedSnapshot["markets"][number], "snapshotId"> => market !== null);

    if (this.failClosed && normalizationIssues.length > 0) {
      throw new GrowthBaseError(
        "ARTIFACT_GENERATION_FAILED",
        "Live Polymarket snapshot normalization failed.",
        502,
        {
          sourceMode: input.marketData.sourceMode,
          issues: normalizationIssues,
          descriptorCount: input.discovery.descriptors.length,
          recordCount: input.marketData.records.length
        }
      );
    }

    return persistedNormalizedSnapshotSchema.parse(
      finalizeNormalizedSnapshot({
        asOf: input.marketData.observedAt,
        requestHash: input.requestHash,
        universe: input.discovery.selector.raw,
        sourceMode: input.marketData.sourceMode,
        fetchedAt: input.marketData.fetchedAt,
        provenance: {
          discovery: input.discovery.provenance,
          marketData: input.marketData.provenance
        },
        markets,
        schemaVersion: "1"
      })
    );
  }
}

function computeHistoryMean(points: Array<{ price: number }>): number | null {
  if (!points.length) {
    return null;
  }

  const total = points.reduce((sum, point) => sum + point.price, 0);
  return roundProbability(total / points.length);
}

function roundProbability(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
}
