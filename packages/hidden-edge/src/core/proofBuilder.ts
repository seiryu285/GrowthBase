import {
  ARTIFACT_KIND,
  hashCanonicalValue,
  hiddenEdgeProofSchema,
  type HiddenEdgeScanProof
} from "@growthbase/core";

import { ENGINE_VERSION, FEATURE_VERSION, SCORING_VERSION } from "./artifactBuilder";

export function computeHiddenEdgeProofHash(proof: HiddenEdgeScanProof): `0x${string}` {
  return hashCanonicalValue(hiddenEdgeProofSchema.parse(proof));
}

export function buildHiddenEdgeProof(args: {
  artifactHash: `0x${string}`;
  snapshotHash: `0x${string}`;
  snapshotId: string;
  requestHash: `0x${string}`;
  generatedAt: string;
}): HiddenEdgeScanProof {
  return hiddenEdgeProofSchema.parse({
    artifact_hash: args.artifactHash,
    snapshot_hash: args.snapshotHash,
    snapshot_id: args.snapshotId,
    request_hash: args.requestHash,
    engine_version: ENGINE_VERSION,
    feature_version: FEATURE_VERSION,
    scoring_version: SCORING_VERSION,
    generated_at: args.generatedAt,
    artifact_kind: ARTIFACT_KIND
  });
}
