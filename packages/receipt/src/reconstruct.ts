import { eq } from "drizzle-orm";

import {
  GrowthBaseError,
  hashCanonicalValue,
  hiddenEdgeArtifactSchema,
  hiddenEdgeProofSchema,
  persistedNormalizedSnapshotSchema,
  stripKeys,
  type CommerceReceipt,
  type DelegationPolicy,
  type HiddenEdgeScanArtifact,
  type HiddenEdgeScanProof,
  type PersistedNormalizedSnapshot,
  type PurchaseRequestRecord,
  type ServiceOffer
} from "@growthbase/core";
import {
  normalizedSnapshots,
  parseJsonColumn,
  proofRecords,
  receiptRecords,
  type GrowthBaseDatabase
} from "@growthbase/db";
import { deriveGrowthEntryFromReceipt } from "@growthbase/growth";
import { verifyDelegationPolicySignature } from "@growthbase/policy";

import { computeCommerceReceiptHash, computeRequestHash, getReceiptById } from "./writer";

export async function reconstructTransaction(database: GrowthBaseDatabase, receiptId: string) {
  const row = database.db
    .select()
    .from(receiptRecords)
    .where(eq(receiptRecords.receiptId, receiptId))
    .get();

  if (!row) {
    throw new GrowthBaseError("PAYMENT_FAILED", "Receipt not found.", 404, { receiptId });
  }

  const policy = parseJsonColumn<DelegationPolicy>(row.policyJson);
  const request = parseJsonColumn<PurchaseRequestRecord>(row.requestJson);
  const artifact = hiddenEdgeArtifactSchema.parse(parseJsonColumn<HiddenEdgeScanArtifact>(row.artifactJson));
  const offer = parseJsonColumn<ServiceOffer>(row.offerJson);
  const receipt = getReceiptById(database, receiptId) as CommerceReceipt;
  const snapshot = loadSnapshot(database, receipt.snapshotHash as `0x${string}`);
  const proof = loadProof(database, receipt.proofHash as `0x${string}`);
  const growthEntry = deriveGrowthEntryFromReceipt(receipt, artifact);

  const verification = {
    policySignatureValid: await verifyDelegationPolicySignature(policy),
    policyHashValid: receipt.policyHash === hashCanonicalValue(stripPolicySignature(policy)),
    requestHashValid: receipt.requestHash === computeRequestHash(request),
    artifactHashValid: receipt.artifactHash === computeHiddenEdgeArtifactHash(artifact),
    snapshotHashValid: receipt.snapshotHash === computeNormalizedSnapshotHash(snapshot),
    proofHashValid: receipt.proofHash === computeHiddenEdgeProofHash(proof),
    proofLinksValid:
      proof.artifact_hash === receipt.artifactHash &&
      proof.snapshot_hash === receipt.snapshotHash &&
      proof.request_hash === receipt.requestHash &&
      proof.snapshot_id === snapshot.snapshotId,
    receiptHashValid: receipt.receiptHash === computeCommerceReceiptHash(receipt)
  };

  return {
    policy,
    offer,
    request,
    snapshot,
    artifact,
    proof,
    receipt,
    growthEntry,
    verification: {
      ...verification,
      fullyVerified: Object.values(verification).every(Boolean)
    }
  };
}

function stripPolicySignature(policy: DelegationPolicy) {
  return stripKeys(policy, ["signature"]);
}

function loadSnapshot(database: GrowthBaseDatabase, snapshotHash: `0x${string}`): PersistedNormalizedSnapshot {
  const row = database.db
    .select()
    .from(normalizedSnapshots)
    .where(eq(normalizedSnapshots.snapshotHash, snapshotHash))
    .get();

  if (!row) {
    throw new GrowthBaseError("PAYMENT_FAILED", "Normalized snapshot not found.", 404, { snapshotHash });
  }

  return persistedNormalizedSnapshotSchema.parse(parseJsonColumn(row.dataJson));
}

function loadProof(database: GrowthBaseDatabase, proofHash: `0x${string}`): HiddenEdgeScanProof {
  const row = database.db
    .select()
    .from(proofRecords)
    .where(eq(proofRecords.proofHash, proofHash))
    .get();

  if (!row) {
    throw new GrowthBaseError("PAYMENT_FAILED", "Proof not found.", 404, { proofHash });
  }

  return hiddenEdgeProofSchema.parse(parseJsonColumn(row.dataJson));
}

function computeHiddenEdgeArtifactHash(artifact: HiddenEdgeScanArtifact): `0x${string}` {
  return hashCanonicalValue(hiddenEdgeArtifactSchema.parse(artifact));
}

function computeNormalizedSnapshotHash(snapshot: PersistedNormalizedSnapshot): `0x${string}` {
  return hashCanonicalValue({
    ...snapshot,
    snapshotId: undefined,
    markets: snapshot.markets.map((market) => ({
      ...market,
      snapshotId: undefined
    }))
  });
}

function computeHiddenEdgeProofHash(proof: HiddenEdgeScanProof): `0x${string}` {
  return hashCanonicalValue(hiddenEdgeProofSchema.parse(proof));
}
