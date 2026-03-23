CREATE TABLE IF NOT EXISTS paid_artifact_failure_records (
  failure_id TEXT PRIMARY KEY NOT NULL,
  policy_id TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  service_id TEXT NOT NULL,
  human_owner TEXT NOT NULL,
  buyer_wallet TEXT NOT NULL,
  agent_wallet TEXT NOT NULL,
  agent_identity_json TEXT NOT NULL,
  seller_wallet TEXT NOT NULL,
  seller_identity_json TEXT NOT NULL,
  payment_scheme TEXT NOT NULL,
  payment_network TEXT NOT NULL,
  payment_asset TEXT NOT NULL,
  payment_response_json TEXT NOT NULL,
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  execution_outcome TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  failure_code TEXT NOT NULL,
  failure_message TEXT NOT NULL,
  failure_details_json TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  request_json TEXT NOT NULL,
  offer_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS paid_artifact_failure_records_request_hash_idx
  ON paid_artifact_failure_records(request_hash);
CREATE INDEX IF NOT EXISTS paid_artifact_failure_records_policy_id_idx
  ON paid_artifact_failure_records(policy_id);
CREATE INDEX IF NOT EXISTS paid_artifact_failure_records_buyer_wallet_idx
  ON paid_artifact_failure_records(buyer_wallet);
CREATE INDEX IF NOT EXISTS paid_artifact_failure_records_transaction_hash_idx
  ON paid_artifact_failure_records(transaction_hash);
