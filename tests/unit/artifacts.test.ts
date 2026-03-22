import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildFeatureCandidates,
  buildHiddenEdgeArtifact,
  buildHiddenEdgeProof,
  computeHiddenEdgeArtifactHash,
  computeHiddenEdgeProofHash,
  computeNormalizedSnapshotHash,
  rankFeatureCandidates
} from "@growthbase/hidden-edge";

import { createHiddenEdgeInput, createSampleNormalizedSnapshot } from "../helpers";

describe("hidden edge contracts", () => {
  it("produces deterministic snapshot, artifact, and proof hashes", () => {
    const input = createHiddenEdgeInput();
    const snapshot = createSampleNormalizedSnapshot();
    const snapshotHash = computeNormalizedSnapshotHash(snapshot);
    const ranked = rankFeatureCandidates(buildFeatureCandidates(snapshot, input, new Date(snapshot.asOf)), input);

    const firstArtifact = buildHiddenEdgeArtifact({
      requestHash: snapshot.requestHash,
      snapshotId: snapshot.snapshotId,
      snapshotHash,
      asOf: snapshot.asOf,
      marketsScanned: snapshot.markets.length,
      marketsEligible: new Set(ranked.map((candidate) => candidate.marketId)).size,
      rankedCandidates: ranked
    });
    const secondArtifact = buildHiddenEdgeArtifact({
      requestHash: snapshot.requestHash,
      snapshotId: snapshot.snapshotId,
      snapshotHash,
      asOf: snapshot.asOf,
      marketsScanned: snapshot.markets.length,
      marketsEligible: new Set(ranked.map((candidate) => candidate.marketId)).size,
      rankedCandidates: ranked
    });

    expect(computeHiddenEdgeArtifactHash(firstArtifact)).toBe(computeHiddenEdgeArtifactHash(secondArtifact));

    const proof = buildHiddenEdgeProof({
      artifactHash: computeHiddenEdgeArtifactHash(firstArtifact),
      snapshotHash,
      snapshotId: snapshot.snapshotId,
      requestHash: snapshot.requestHash,
      generatedAt: snapshot.asOf
    });

    expect(proof.snapshot_id).toBe(snapshot.snapshotId);
    expect(proof.snapshot_hash).toBe(snapshotHash);
    expect(proof.artifact_hash).toBe(computeHiddenEdgeArtifactHash(firstArtifact));
    expect(computeHiddenEdgeProofHash(proof)).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("keeps features and ranking independent of raw polymarket response types", () => {
    const featuresPath = path.resolve("packages/hidden-edge/src/core/features.ts");
    const rankingPath = path.resolve("packages/hidden-edge/src/core/ranking.ts");
    const featuresSource = fs.readFileSync(featuresPath, "utf8");
    const rankingSource = fs.readFileSync(rankingPath, "utf8");

    expect(featuresSource).not.toMatch(/polymarket/i);
    expect(rankingSource).not.toMatch(/polymarket/i);
    expect(featuresSource).not.toMatch(/RawMarket/i);
    expect(rankingSource).not.toMatch(/RawMarket/i);
  });
});
