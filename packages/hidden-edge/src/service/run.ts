import { eq } from "drizzle-orm";

import {
  ARTIFACT_KIND,
  SCHEMA_VERSION,
  SERVICE_ID,
  GrowthBaseError,
  hashCanonicalValue,
  hiddenEdgeArtifactSchema,
  hiddenEdgeInputSchema,
  hiddenEdgeProofSchema,
  persistedNormalizedSnapshotSchema,
  purchaseRequestRecordSchema,
  serviceRunRecordSchema,
  type HiddenEdgeScanArtifact,
  type HiddenEdgeScanInput,
  type HiddenEdgeScanProof,
  type PersistedNormalizedSnapshot,
  type PurchaseRequestRecord
} from "@growthbase/core";
import {
  artifacts,
  normalizedSnapshots,
  parseJsonColumn,
  proofRecords,
  serializeJsonColumn,
  serviceRuns,
  type GrowthBaseDatabase
} from "@growthbase/db";

import { computeNormalizedSnapshotHash, type SnapshotNormalizer } from "../adapters/snapshotNormalizer";
import type { MarketDataAdapter } from "../adapters/marketData";
import type { MarketDiscoveryAdapter } from "../adapters/marketDiscovery";
import { buildFeatureCandidates } from "../core/features";
import { buildHiddenEdgeArtifact, computeHiddenEdgeArtifactHash } from "../core/artifactBuilder";
import { buildHiddenEdgeProof, computeHiddenEdgeProofHash } from "../core/proofBuilder";
import { rankFeatureCandidates } from "../core/ranking";

export type HiddenEdgeRunResult = {
  requestRecord: PurchaseRequestRecord;
  artifact: HiddenEdgeScanArtifact;
  artifactHash: `0x${string}`;
  proof: HiddenEdgeScanProof;
  proofHash: `0x${string}`;
  snapshot: PersistedNormalizedSnapshot;
  snapshotHash: `0x${string}`;
  deliveryStatus: "DELIVERED";
  replayed: boolean;
};

export type ServiceMetrics = {
  quoteCount: number;
  paidRunCount: number;
  paidSuccessCount: number;
  paidFailureCount: number;
  artifactLatencyMsLast: number;
  snapshotPersistFailureCount: number;
  proofPersistFailureCount: number;
  idempotentReplayCount: number;
  upstreamDegradedCount: number;
};

export type HiddenEdgeRunner = {
  parseInput(payload: unknown): HiddenEdgeScanInput;
  run(args: {
    database: GrowthBaseDatabase;
    policyId: string;
    agentWallet: `0x${string}`;
    input: HiddenEdgeScanInput;
  }): Promise<HiddenEdgeRunResult>;
  metrics: ServiceMetrics;
};

export function createHiddenEdgeRunner(args: {
  marketDiscovery: MarketDiscoveryAdapter;
  marketData: MarketDataAdapter;
  snapshotNormalizer: SnapshotNormalizer;
  metrics: ServiceMetrics;
  now?: () => Date;
}): HiddenEdgeRunner {
  const now = args.now ?? (() => new Date());

  return {
    parseInput(payload: unknown) {
      return hiddenEdgeInputSchema.parse(payload);
    },
    async run({ database, policyId, agentWallet, input }) {
      const startedAt = now();
      args.metrics.paidRunCount += 1;

      try {
        const requestRecord = purchaseRequestRecordSchema.parse({
          policyId,
          serviceId: SERVICE_ID,
          agentWallet,
          input,
          schemaVersion: SCHEMA_VERSION
        });
        const requestHash = computeRequestHash(requestRecord);
        const replay = loadReplayResult(database, requestHash);

        if (replay) {
          args.metrics.idempotentReplayCount += 1;
          args.metrics.paidSuccessCount += 1;
          args.metrics.artifactLatencyMsLast = now().getTime() - startedAt.getTime();
          return {
            requestRecord,
            ...replay,
            deliveryStatus: "DELIVERED",
            replayed: true
          };
        }

        const discovery = await args.marketDiscovery.discover(input);
        const marketData = await args.marketData.fetchMarketData(discovery.descriptors, input);

        if (discovery.degradedCount > 0 || marketData.degradedCount > 0) {
          args.metrics.upstreamDegradedCount += 1;
        }

        const snapshot = args.snapshotNormalizer.normalize({
          requestHash,
          discovery,
          marketData
        });
        const snapshotHash = computeNormalizedSnapshotHash(snapshot);
        persistSnapshot(database, snapshot, snapshotHash, args.metrics);

        const persistedSnapshot = loadSnapshotByRequestHash(database, requestHash);

        if (!persistedSnapshot) {
          throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Persisted normalized snapshot could not be reloaded.", 500, {
            requestHash
          });
        }

        const features = buildFeatureCandidates(persistedSnapshot.snapshot, input, now());
        const ranked = rankFeatureCandidates(features, input);
        const eligibleMarketIds = new Set(ranked.map((candidate) => candidate.marketId));
        const artifact = buildHiddenEdgeArtifact({
          requestHash,
          snapshotId: persistedSnapshot.snapshot.snapshotId,
          snapshotHash: persistedSnapshot.snapshotHash,
          asOf: persistedSnapshot.snapshot.asOf,
          marketsScanned: persistedSnapshot.snapshot.markets.length,
          marketsEligible: eligibleMarketIds.size,
          rankedCandidates: ranked
        });
        const artifactHash = computeHiddenEdgeArtifactHash(artifact);
        const proof = buildHiddenEdgeProof({
          artifactHash,
          snapshotHash: persistedSnapshot.snapshotHash,
          snapshotId: persistedSnapshot.snapshot.snapshotId,
          requestHash,
          generatedAt: persistedSnapshot.snapshot.asOf
        });
        const proofHash = computeHiddenEdgeProofHash(proof);

        persistArtifact(database, artifact, artifactHash);
        persistProof(database, proof, proofHash, persistedSnapshot.snapshotHash, requestHash, args.metrics);
        persistServiceRun(database, requestHash, persistedSnapshot.snapshotHash, artifactHash, proofHash, persistedSnapshot.snapshot.asOf);

        args.metrics.paidSuccessCount += 1;
        args.metrics.artifactLatencyMsLast = now().getTime() - startedAt.getTime();

        return {
          requestRecord,
          artifact,
          artifactHash,
          proof,
          proofHash,
          snapshot: persistedSnapshot.snapshot,
          snapshotHash: persistedSnapshot.snapshotHash,
          deliveryStatus: "DELIVERED",
          replayed: false
        };
      } catch (error) {
        args.metrics.paidFailureCount += 1;

        if (error instanceof GrowthBaseError) {
          throw error;
        }

        throw new GrowthBaseError(
          "ARTIFACT_GENERATION_FAILED",
          error instanceof Error ? error.message : "Hidden Edge execution failed.",
          500
        );
      }
    },
    metrics: args.metrics
  };
}

function persistSnapshot(
  database: GrowthBaseDatabase,
  snapshot: PersistedNormalizedSnapshot,
  snapshotHash: `0x${string}`,
  metrics: ServiceMetrics
) {
  try {
    database.db
      .insert(normalizedSnapshots)
      .values({
        snapshotId: snapshot.snapshotId,
        snapshotHash,
        requestHash: snapshot.requestHash,
        serviceId: SERVICE_ID,
        asOf: snapshot.asOf,
        schemaVersion: snapshot.schemaVersion,
        dataJson: serializeJsonColumn(snapshot)
      })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    metrics.snapshotPersistFailureCount += 1;
    throw error;
  }
}

function persistArtifact(
  database: GrowthBaseDatabase,
  artifact: HiddenEdgeScanArtifact,
  artifactHash: `0x${string}`
) {
  database.db
    .insert(artifacts)
    .values({
      artifactId: artifact.scanId,
      artifactHash,
      serviceId: SERVICE_ID,
      artifactType: ARTIFACT_KIND,
      generatedAt: artifact.asOf,
      dataJson: serializeJsonColumn(artifact)
    })
    .onConflictDoNothing()
    .run();
}

function persistProof(
  database: GrowthBaseDatabase,
  proof: HiddenEdgeScanProof,
  proofHash: `0x${string}`,
  snapshotHash: `0x${string}`,
  requestHash: `0x${string}`,
  metrics: ServiceMetrics
) {
  try {
    database.db
      .insert(proofRecords)
      .values({
        proofHash,
        snapshotHash,
        requestHash,
        serviceId: SERVICE_ID,
        generatedAt: proof.generated_at,
        schemaVersion: SCHEMA_VERSION,
        dataJson: serializeJsonColumn(proof)
      })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    metrics.proofPersistFailureCount += 1;
    throw error;
  }
}

function persistServiceRun(
  database: GrowthBaseDatabase,
  requestHash: `0x${string}`,
  snapshotHash: `0x${string}`,
  artifactHash: `0x${string}`,
  proofHash: `0x${string}`,
  createdAt: string
) {
  database.db
    .insert(serviceRuns)
    .values(
      serviceRunRecordSchema.parse({
        requestHash,
        serviceId: SERVICE_ID,
        snapshotHash,
        artifactHash,
        proofHash,
        createdAt,
        schemaVersion: SCHEMA_VERSION
      })
    )
    .onConflictDoNothing()
    .run();
}

function loadReplayResult(database: GrowthBaseDatabase, requestHash: `0x${string}`) {
  const run = database.db.select().from(serviceRuns).where(eq(serviceRuns.requestHash, requestHash)).get();

  if (!run) {
    return null;
  }

  const artifact = loadArtifactByHash(database, run.artifactHash as `0x${string}`);
  const proof = loadProofByHash(database, run.proofHash as `0x${string}`);
  const snapshot = loadSnapshotByHash(database, run.snapshotHash as `0x${string}`);

  if (!artifact || !proof || !snapshot) {
    throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Canonical run linkage is incomplete.", 500, { requestHash });
  }

  return {
    artifact: artifact.artifact,
    artifactHash: artifact.artifactHash,
    proof: proof.proof,
    proofHash: proof.proofHash,
    snapshot: snapshot.snapshot,
    snapshotHash: snapshot.snapshotHash
  };
}

function loadArtifactByHash(database: GrowthBaseDatabase, artifactHash: `0x${string}`) {
  const row = database.db.select().from(artifacts).where(eq(artifacts.artifactHash, artifactHash)).get();

  if (!row) {
    return null;
  }

  return {
    artifact: hiddenEdgeArtifactSchema.parse(parseJsonColumn(row.dataJson)),
    artifactHash: row.artifactHash as `0x${string}`
  };
}

function loadProofByHash(database: GrowthBaseDatabase, proofHash: `0x${string}`) {
  const row = database.db.select().from(proofRecords).where(eq(proofRecords.proofHash, proofHash)).get();

  if (!row) {
    return null;
  }

  return {
    proof: hiddenEdgeProofSchema.parse(parseJsonColumn(row.dataJson)),
    proofHash: row.proofHash as `0x${string}`
  };
}

function loadSnapshotByHash(database: GrowthBaseDatabase, snapshotHash: `0x${string}`) {
  const row = database.db.select().from(normalizedSnapshots).where(eq(normalizedSnapshots.snapshotHash, snapshotHash)).get();

  if (!row) {
    return null;
  }

  return {
    snapshot: persistedNormalizedSnapshotSchema.parse(parseJsonColumn(row.dataJson)),
    snapshotHash: row.snapshotHash as `0x${string}`
  };
}

function loadSnapshotByRequestHash(database: GrowthBaseDatabase, requestHash: `0x${string}`) {
  const row = database.db.select().from(normalizedSnapshots).where(eq(normalizedSnapshots.requestHash, requestHash)).get();

  if (!row) {
    return null;
  }

  return {
    snapshot: persistedNormalizedSnapshotSchema.parse(parseJsonColumn(row.dataJson)),
    snapshotHash: row.snapshotHash as `0x${string}`
  };
}

function computeRequestHash(requestRecord: PurchaseRequestRecord): `0x${string}` {
  return hashCanonicalValue(purchaseRequestRecordSchema.parse(requestRecord));
}
