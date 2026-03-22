import type { HiddenEdgeScanInput } from "@growthbase/core";

import type { FeatureCandidate } from "./features";

export function rankFeatureCandidates(candidates: FeatureCandidate[], input: HiddenEdgeScanInput): FeatureCandidate[] {
  return [...candidates]
    .filter((candidate) => candidate.hiddenEdgeBps > 0 && candidate.maxSafeSizeUsd > 0)
    .sort(compareCandidates)
    .slice(0, input.maxCandidates);
}

function compareCandidates(left: FeatureCandidate, right: FeatureCandidate): number {
  return (
    right.score - left.score ||
    right.hiddenEdgeBps - left.hiddenEdgeBps ||
    left.marketId.localeCompare(right.marketId) ||
    left.recommendedSide.localeCompare(right.recommendedSide)
  );
}
