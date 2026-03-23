import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const receiptRecords = sqliteTable(
  "receipt_records",
  {
    receiptId: text("receipt_id").primaryKey(),
    policyId: text("policy_id").notNull(),
    policyHash: text("policy_hash").notNull(),
    humanOwner: text("human_owner").notNull(),
    buyerWallet: text("buyer_wallet").notNull(),
    agentWallet: text("agent_wallet").notNull(),
    agentIdentityJson: text("agent_identity_json").notNull(),
    sellerWallet: text("seller_wallet").notNull(),
    sellerIdentityJson: text("seller_identity_json").notNull(),
    serviceId: text("service_id").notNull(),
    requestHash: text("request_hash").notNull(),
    paymentScheme: text("payment_scheme").notNull(),
    paymentNetwork: text("payment_network").notNull(),
    paymentResponseJson: text("payment_response_json").notNull(),
    price: text("price").notNull(),
    currency: text("currency").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    proofHash: text("proof_hash").notNull(),
    deliveryStatus: text("delivery_status").notNull(),
    timestamp: text("timestamp").notNull(),
    receiptHash: text("receipt_hash").notNull(),
    schemaVersion: text("schema_version").notNull(),
    policyJson: text("policy_json").notNull(),
    requestJson: text("request_json").notNull(),
    artifactJson: text("artifact_json").notNull(),
    offerJson: text("offer_json").notNull()
  },
  (table) => ({
    byAgentWallet: index("receipt_records_agent_wallet_idx").on(table.agentWallet),
    byPolicyId: index("receipt_records_policy_id_idx").on(table.policyId),
    byReceiptHash: index("receipt_records_receipt_hash_idx").on(table.receiptHash),
    byArtifactHash: index("receipt_records_artifact_hash_idx").on(table.artifactHash)
  })
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    artifactId: text("artifact_id").primaryKey(),
    artifactHash: text("artifact_hash").notNull().unique(),
    serviceId: text("service_id").notNull(),
    artifactType: text("artifact_type").notNull(),
    generatedAt: text("generated_at").notNull(),
    dataJson: text("data_json").notNull()
  },
  (table) => ({
    byArtifactHash: index("artifacts_artifact_hash_idx").on(table.artifactHash)
  })
);

export const normalizedSnapshots = sqliteTable(
  "normalized_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    snapshotHash: text("snapshot_hash").notNull().unique(),
    requestHash: text("request_hash").notNull().unique(),
    serviceId: text("service_id").notNull(),
    asOf: text("as_of").notNull(),
    schemaVersion: text("schema_version").notNull(),
    dataJson: text("data_json").notNull()
  },
  (table) => ({
    bySnapshotHash: index("normalized_snapshots_snapshot_hash_idx").on(table.snapshotHash),
    byRequestHash: index("normalized_snapshots_request_hash_idx").on(table.requestHash)
  })
);

export const proofRecords = sqliteTable(
  "proof_records",
  {
    proofHash: text("proof_hash").primaryKey(),
    snapshotHash: text("snapshot_hash").notNull(),
    requestHash: text("request_hash").notNull(),
    serviceId: text("service_id").notNull(),
    generatedAt: text("generated_at").notNull(),
    schemaVersion: text("schema_version").notNull(),
    dataJson: text("data_json").notNull()
  },
  (table) => ({
    bySnapshotHash: index("proof_records_snapshot_hash_idx").on(table.snapshotHash),
    byRequestHash: index("proof_records_request_hash_idx").on(table.requestHash)
  })
);

export const serviceRuns = sqliteTable(
  "service_runs",
  {
    requestHash: text("request_hash").primaryKey(),
    serviceId: text("service_id").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    proofHash: text("proof_hash").notNull(),
    createdAt: text("created_at").notNull(),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => ({
    byArtifactHash: index("service_runs_artifact_hash_idx").on(table.artifactHash),
    bySnapshotHash: index("service_runs_snapshot_hash_idx").on(table.snapshotHash),
    byProofHash: index("service_runs_proof_hash_idx").on(table.proofHash)
  })
);

export const paidArtifactFailureRecords = sqliteTable(
  "paid_artifact_failure_records",
  {
    failureId: text("failure_id").primaryKey(),
    policyId: text("policy_id").notNull(),
    policyHash: text("policy_hash").notNull(),
    requestHash: text("request_hash").notNull(),
    serviceId: text("service_id").notNull(),
    humanOwner: text("human_owner").notNull(),
    buyerWallet: text("buyer_wallet").notNull(),
    agentWallet: text("agent_wallet").notNull(),
    agentIdentityJson: text("agent_identity_json").notNull(),
    sellerWallet: text("seller_wallet").notNull(),
    sellerIdentityJson: text("seller_identity_json").notNull(),
    paymentScheme: text("payment_scheme").notNull(),
    paymentNetwork: text("payment_network").notNull(),
    paymentAsset: text("payment_asset").notNull(),
    paymentResponseJson: text("payment_response_json").notNull(),
    price: text("price").notNull(),
    currency: text("currency").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    executionOutcome: text("execution_outcome").notNull(),
    deliveryStatus: text("delivery_status").notNull(),
    failureCode: text("failure_code").notNull(),
    failureMessage: text("failure_message").notNull(),
    failureDetailsJson: text("failure_details_json").notNull(),
    timestamp: text("timestamp").notNull(),
    schemaVersion: text("schema_version").notNull(),
    policyJson: text("policy_json").notNull(),
    requestJson: text("request_json").notNull(),
    offerJson: text("offer_json").notNull()
  },
  (table) => ({
    byRequestHash: index("paid_artifact_failure_records_request_hash_idx").on(table.requestHash),
    byPolicyId: index("paid_artifact_failure_records_policy_id_idx").on(table.policyId),
    byBuyerWallet: index("paid_artifact_failure_records_buyer_wallet_idx").on(table.buyerWallet),
    byTransactionHash: index("paid_artifact_failure_records_transaction_hash_idx").on(table.transactionHash)
  })
);

export const policyRevocations = sqliteTable(
  "policy_revocations",
  {
    policyId: text("policy_id").primaryKey(),
    policyHash: text("policy_hash").notNull().unique(),
    revokedAt: text("revoked_at").notNull(),
    reason: text("reason").notNull().default("MANUAL_REVOCATION"),
    schemaVersion: text("schema_version").notNull()
  },
  (table) => ({
    byPolicyHash: index("policy_revocations_policy_hash_idx").on(table.policyHash)
  })
);

export const appliedMigrations = sqliteTable("applied_migrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  appliedAt: text("applied_at").notNull()
});
