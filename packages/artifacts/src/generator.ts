import {
  hiddenEdgeArtifactSchema,
  hiddenEdgeProofSchema,
  hashCanonicalValue,
  type HiddenEdgeScanArtifact,
  type HiddenEdgeScanProof,
  type PersistedNormalizedSnapshot
} from "@growthbase/core";

export function computeHiddenEdgeArtifactHash(artifact: HiddenEdgeScanArtifact): `0x${string}` {
  return hashCanonicalValue(hiddenEdgeArtifactSchema.parse(artifact));
}

export function computeHiddenEdgeProofHash(proof: HiddenEdgeScanProof): `0x${string}` {
  return hashCanonicalValue(hiddenEdgeProofSchema.parse(proof));
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
