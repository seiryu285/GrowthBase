export function renderTransactionSummary(result: {
  policy: { policyId: string; humanOwner: string };
  request: { serviceId: string; input: { universe: string; sidePolicy: string; requestedNotionalUsd: number } };
  snapshot: { snapshotId: string };
  artifact: { scanId: string; candidates: Array<{ action: string; score: number }> };
  proof: { artifact_hash: string; snapshot_hash: string };
  receipt: { receiptId: string; receiptHash: string; paymentResponse: Record<string, unknown> };
  growthEntry: { timestamp: string; deliveryStatus: string };
  verification: { fullyVerified: boolean };
}) {
  const transaction = String(result.receipt.paymentResponse.transaction ?? "n/a");
  const topCandidate = result.artifact.candidates[0];

  return [
    "GrowthBase Hidden Edge Transaction Summary",
    `policyId: ${result.policy.policyId}`,
    `humanOwner: ${result.policy.humanOwner}`,
    `serviceId: ${result.request.serviceId}`,
    `universe: ${result.request.input.universe}`,
    `sidePolicy: ${result.request.input.sidePolicy}`,
    `requestedNotionalUsd: ${result.request.input.requestedNotionalUsd}`,
    `snapshotId: ${result.snapshot.snapshotId}`,
    `scanId: ${result.artifact.scanId}`,
    `topCandidateAction: ${topCandidate?.action ?? "n/a"}`,
    `topCandidateScore: ${topCandidate?.score ?? "n/a"}`,
    `artifactHash: ${result.proof.artifact_hash}`,
    `snapshotHash: ${result.proof.snapshot_hash}`,
    `receiptId: ${result.receipt.receiptId}`,
    `receiptHash: ${result.receipt.receiptHash}`,
    `transaction: ${transaction}`,
    `deliveryStatus: ${result.growthEntry.deliveryStatus}`,
    `timestamp: ${result.growthEntry.timestamp}`,
    `fullyVerified: ${result.verification.fullyVerified}`
  ].join("\n");
}
