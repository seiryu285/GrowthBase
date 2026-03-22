import {
  combineHashes,
  hashCanonicalValue,
  hashToDeterministicUuid,
  hiddenEdgeArtifactSchema,
  type HiddenEdgeScanArtifact
} from "@growthbase/core";

import type { FeatureCandidate } from "./features";

export const ENGINE_VERSION = "hidden-edge-engine/1";
export const FEATURE_VERSION = "hidden-edge-features/1";
export const SCORING_VERSION = "hidden-edge-score/1";

export type BuildArtifactInput = {
  requestHash: `0x${string}`;
  snapshotId: string;
  snapshotHash: `0x${string}`;
  asOf: string;
  marketsScanned: number;
  marketsEligible: number;
  rankedCandidates: FeatureCandidate[];
};

export function computeHiddenEdgeArtifactHash(artifact: HiddenEdgeScanArtifact): `0x${string}` {
  return hashCanonicalValue(hiddenEdgeArtifactSchema.parse(artifact));
}

export function buildHiddenEdgeArtifact(input: BuildArtifactInput): HiddenEdgeScanArtifact {
  const scanId = hashToDeterministicUuid(combineHashes([input.requestHash, input.snapshotHash]));

  return hiddenEdgeArtifactSchema.parse({
    scanId,
    asOf: input.asOf,
    snapshotId: input.snapshotId,
    engineVersion: ENGINE_VERSION,
    featureVersion: FEATURE_VERSION,
    scoringVersion: SCORING_VERSION,
    marketsScanned: input.marketsScanned,
    marketsEligible: input.marketsEligible,
    candidates: input.rankedCandidates.map((candidate, index) => ({
      rank: index + 1,
      marketId: candidate.marketId,
      eventId: candidate.eventId,
      marketSlug: candidate.marketSlug,
      eventTitle: candidate.eventTitle,
      recommendedSide: candidate.recommendedSide,
      marketProb: candidate.marketProb,
      fairLow: candidate.fairLow,
      fairMid: candidate.fairMid,
      fairHigh: candidate.fairHigh,
      allInEntry: candidate.allInEntry,
      hiddenEdgeBps: candidate.hiddenEdgeBps,
      maxSafeSizeUsd: candidate.maxSafeSizeUsd,
      score: candidate.score,
      reasonCodes: candidate.reasonCodes,
      action: candidate.action,
      expiresAt: candidate.expiresAt
    }))
  });
}
