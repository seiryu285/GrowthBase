ALTER TABLE receipt_records ADD COLUMN snapshot_hash TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000000000000000000000000000';
ALTER TABLE receipt_records ADD COLUMN proof_hash TEXT NOT NULL DEFAULT '0x0000000000000000000000000000000000000000000000000000000000000000';

CREATE TABLE IF NOT EXISTS normalized_snapshots (
  snapshot_id TEXT PRIMARY KEY NOT NULL,
  snapshot_hash TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL,
  as_of TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS normalized_snapshots_snapshot_hash_idx ON normalized_snapshots(snapshot_hash);
CREATE INDEX IF NOT EXISTS normalized_snapshots_request_hash_idx ON normalized_snapshots(request_hash);

CREATE TABLE IF NOT EXISTS proof_records (
  proof_hash TEXT PRIMARY KEY NOT NULL,
  snapshot_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  service_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS proof_records_snapshot_hash_idx ON proof_records(snapshot_hash);
CREATE INDEX IF NOT EXISTS proof_records_request_hash_idx ON proof_records(request_hash);

CREATE TABLE IF NOT EXISTS service_runs (
  request_hash TEXT PRIMARY KEY NOT NULL,
  service_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  proof_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  schema_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS service_runs_artifact_hash_idx ON service_runs(artifact_hash);
CREATE INDEX IF NOT EXISTS service_runs_snapshot_hash_idx ON service_runs(snapshot_hash);
CREATE INDEX IF NOT EXISTS service_runs_proof_hash_idx ON service_runs(proof_hash);
