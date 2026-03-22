import { asc, eq } from "drizzle-orm";

import { SCHEMA_VERSION, hiddenEdgeArtifactSchema, type CommerceReceipt, type HiddenEdgeScanArtifact, type GrowthHistoryEntry } from "@growthbase/core";
import { parseJsonColumn, receiptRecords, type GrowthBaseDatabase } from "@growthbase/db";

export function deriveGrowthEntryFromReceipt(receipt: CommerceReceipt, artifact?: HiddenEdgeScanArtifact): GrowthHistoryEntry {
  const topCandidate = artifact?.candidates[0];

  return {
    agentWallet: receipt.agentWallet,
    receiptId: receipt.receiptId,
    serviceId: receipt.serviceId,
    artifactHash: receipt.artifactHash,
    deliveryStatus: receipt.deliveryStatus,
    timestamp: receipt.timestamp,
    candidatesReturned: artifact?.candidates.length,
    topCandidateAction: topCandidate?.action,
    topCandidateScore: topCandidate?.score,
    schemaVersion: SCHEMA_VERSION
  };
}

export function deriveGrowthHistory(database: GrowthBaseDatabase, agentWallet: string): GrowthHistoryEntry[] {
  const rows = database.db
    .select({
      receiptId: receiptRecords.receiptId,
      agentWallet: receiptRecords.agentWallet,
      serviceId: receiptRecords.serviceId,
      artifactHash: receiptRecords.artifactHash,
      deliveryStatus: receiptRecords.deliveryStatus,
      timestamp: receiptRecords.timestamp,
      artifactJson: receiptRecords.artifactJson
    })
    .from(receiptRecords)
    .where(eq(receiptRecords.agentWallet, agentWallet))
    .orderBy(asc(receiptRecords.timestamp))
    .all();

  return rows.map((row) => {
    const artifact = hiddenEdgeArtifactSchema.parse(parseJsonColumn(row.artifactJson));
    return {
      agentWallet: row.agentWallet,
      receiptId: row.receiptId,
      serviceId: row.serviceId as GrowthHistoryEntry["serviceId"],
      artifactHash: row.artifactHash as `0x${string}`,
      deliveryStatus: row.deliveryStatus as GrowthHistoryEntry["deliveryStatus"],
      timestamp: row.timestamp,
      candidatesReturned: artifact.candidates.length,
      topCandidateAction: artifact.candidates[0]?.action,
      topCandidateScore: artifact.candidates[0]?.score,
      schemaVersion: SCHEMA_VERSION
    };
  });
}
