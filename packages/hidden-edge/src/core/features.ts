import type {
  HiddenEdgeScanInput,
  NormalizedMarketSnapshot,
  PersistedNormalizedSnapshot
} from "@growthbase/core";

export type FeatureCandidate = {
  marketId: string;
  eventId: string;
  marketSlug: string;
  eventTitle: string;
  recommendedSide: "YES" | "NO";
  marketProb: number;
  fairLow: number;
  fairMid: number;
  fairHigh: number;
  allInEntry: number;
  hiddenEdgeBps: number;
  maxSafeSizeUsd: number;
  score: number;
  reasonCodes: string[];
  action: "ENTER_NOW" | "WATCH_CLOSE" | "SKIP";
  expiresAt: string;
  sortKey: string;
};

type SideContext = {
  side: "YES" | "NO";
  ask: number;
  askSize: number;
  bid: number;
  midpoint: number;
  historyMean: number | null;
};

const RISK_BUFFER_BY_MODE = {
  conservative: 0.03,
  standard: 0.015,
  aggressive: 0.0075
} as const;

const RISK_CAP_BY_MODE = {
  conservative: 50,
  standard: 150,
  aggressive: 500
} as const;

export function buildFeatureCandidates(
  snapshot: PersistedNormalizedSnapshot,
  input: HiddenEdgeScanInput,
  now = new Date()
): FeatureCandidate[] {
  return snapshot.markets.flatMap((market) => buildMarketCandidates(market, input, now));
}

function buildMarketCandidates(
  market: NormalizedMarketSnapshot,
  input: HiddenEdgeScanInput,
  now: Date
): FeatureCandidate[] {
  const sides = expandSides(market, input.sidePolicy);
  const ageMs = Math.max(0, now.getTime() - new Date(market.observedAt).getTime());

  return sides.map((side) => {
    const spread = Math.max(side.ask - side.bid, market.tickSize);
    const historyAnchor = side.historyMean == null ? side.midpoint : (side.midpoint + side.historyMean) / 2;
    const fairMid = clampProbability(historyAnchor);
    const riskBuffer = RISK_BUFFER_BY_MODE[input.riskMode] + spread / 2;
    const fairLow = clampProbability(fairMid - riskBuffer);
    const fairHigh = clampProbability(fairMid + riskBuffer);
    const allInEntry = clampProbability(Math.min(side.ask, fairMid));
    const hiddenEdgeBps = Math.round((fairMid - side.ask) * 10_000);
    const bookCapacityUsd = side.askSize * Math.max(side.ask, market.tickSize);
    const maxSafeSizeUsd = roundAmount(
      Math.min(input.requestedNotionalUsd, bookCapacityUsd, RISK_CAP_BY_MODE[input.riskMode])
    );
    const feePenalty = market.feeBps / 10;
    const agePenalty = ageMs > input.maxBookAgeMs ? (ageMs - input.maxBookAgeMs) / 100 : 0;
    const liquidityBoost = Math.min(25, bookCapacityUsd / 5);
    const score = Number((hiddenEdgeBps - feePenalty - agePenalty + liquidityBoost).toFixed(4));
    const action =
      hiddenEdgeBps >= 25 && ageMs <= input.maxBookAgeMs && maxSafeSizeUsd > 0
        ? "ENTER_NOW"
        : hiddenEdgeBps >= 0
          ? "WATCH_CLOSE"
          : "SKIP";
    const reasonCodes = [
      hiddenEdgeBps > 0 ? "EDGE_POSITIVE" : "EDGE_NEGATIVE",
      ageMs <= input.maxBookAgeMs ? "BOOK_FRESH" : "BOOK_STALE",
      maxSafeSizeUsd > 0 ? "SIZE_AVAILABLE" : "NO_LIQUID_SIZE",
      market.historyMeanYes != null || market.historyMeanNo != null ? "HISTORY_ANCHORED" : "MIDPOINT_ONLY"
    ];

    return {
      marketId: market.marketId,
      eventId: market.eventId,
      marketSlug: market.marketSlug,
      eventTitle: market.eventTitle,
      recommendedSide: side.side,
      marketProb: side.midpoint,
      fairLow,
      fairMid,
      fairHigh,
      allInEntry,
      hiddenEdgeBps,
      maxSafeSizeUsd,
      score,
      reasonCodes,
      action,
      expiresAt: new Date(new Date(market.observedAt).getTime() + input.maxBookAgeMs).toISOString(),
      sortKey: `${market.marketId}:${side.side}`
    };
  });
}

function expandSides(
  market: NormalizedMarketSnapshot,
  policy: HiddenEdgeScanInput["sidePolicy"]
): SideContext[] {
  const yesSide: SideContext = {
    side: "YES",
    ask: market.bestYesAsk,
    askSize: market.bestYesAskSize,
    bid: market.bestYesBid,
    midpoint: market.midProbYes,
    historyMean: market.historyMeanYes
  };
  const noSide: SideContext = {
    side: "NO",
    ask: market.bestNoAsk,
    askSize: market.bestNoAskSize,
    bid: market.bestNoBid,
    midpoint: market.midProbNo,
    historyMean: market.historyMeanNo
  };

  if (policy === "YES_ONLY") {
    return [yesSide];
  }

  if (policy === "NO_ONLY") {
    return [noSide];
  }

  return [yesSide, noSide];
}

function clampProbability(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}

function roundAmount(value: number): number {
  return Number(Math.max(0, value).toFixed(2));
}
