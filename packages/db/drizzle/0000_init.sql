CREATE TABLE IF NOT EXISTS receipt_records (
  receipt_id TEXT PRIMARY KEY NOT NULL,
  policy_id TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  human_owner TEXT NOT NULL,
  buyer_wallet TEXT NOT NULL,
  agent_wallet TEXT NOT NULL,
  agent_identity_json TEXT NOT NULL,
  seller_wallet TEXT NOT NULL,
  seller_identity_json TEXT NOT NULL,
  service_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  payment_scheme TEXT NOT NULL,
  payment_network TEXT NOT NULL,
  payment_response_json TEXT NOT NULL,
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  receipt_hash TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  request_json TEXT NOT NULL,
  artifact_json TEXT NOT NULL,
  offer_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS receipt_records_agent_wallet_idx ON receipt_records(agent_wallet);
CREATE INDEX IF NOT EXISTS receipt_records_policy_id_idx ON receipt_records(policy_id);
CREATE INDEX IF NOT EXISTS receipt_records_receipt_hash_idx ON receipt_records(receipt_hash);
CREATE INDEX IF NOT EXISTS receipt_records_artifact_hash_idx ON receipt_records(artifact_hash);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY NOT NULL,
  artifact_hash TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS artifacts_artifact_hash_idx ON artifacts(artifact_hash);

CREATE TABLE IF NOT EXISTS policy_revocations (
  policy_id TEXT PRIMARY KEY NOT NULL,
  policy_hash TEXT NOT NULL UNIQUE,
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'MANUAL_REVOCATION',
  schema_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS policy_revocations_policy_hash_idx ON policy_revocations(policy_hash);
