# GrowthBase Architecture

GrowthBase remains the product and trust substrate. `polymarket-hidden-edge-scan` is the first paid service running inside that substrate, not a separate marketplace.

## Closed Loop

1. A human signs a `DelegationPolicy`.
2. An agent discovers the flagship `ServiceOffer` from `/offers`.
3. The agent purchases `POST /purchase/polymarket-hidden-edge-scan` through x402 on Base.
4. Hidden Edge resolves Polymarket inputs, persists a canonical normalized snapshot, ranks deterministic candidates, and returns a typed artifact plus proof.
5. GrowthBase appends a canonical `CommerceReceipt`.
6. `GrowthHistoryEntry` is derived strictly from receipts.
7. The verifier reconstructs policy, request, snapshot, artifact, proof, receipt, and growth linkage end-to-end.

## Product Boundary

GrowthBase owns:

- `DelegationPolicy` validation and signature checking
- x402 purchase orchestration
- canonical `CommerceReceipt`
- `GrowthHistoryEntry` derivation
- verifier and receipt inspection routes
- agent profile and ERC-8004-compatible registration surfaces

Hidden Edge owns:

- service definition and offer metadata
- exact input validation for the scan
- market discovery and read-only market data access
- normalized snapshot creation
- deterministic feature building and ranking
- artifact and proof construction
- lightweight service observability

## Adapter Seams

Two seams are explicit in code.

### 1. Service Adapter Seam

This seam isolates GrowthBase from service-specific execution.

- Boundary: [`apps/api/src/services/serviceAdapter.ts`](/C:/Users/blued/Downloads/GrowthBase/apps/api/src/services/serviceAdapter.ts)
- Hidden Edge implementation: [`packages/hidden-edge/src/service/index.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/service/index.ts)
- Offer definition: [`packages/hidden-edge/src/service/offer.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/service/offer.ts)
- Paid execution: [`packages/hidden-edge/src/service/run.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/service/run.ts)

`apps/api` only needs a `ServiceAdapter` with:

- normalized `offer`
- `parseInput`
- `runPaid`
- lightweight `metrics`

This keeps GrowthBase in control of policy enforcement, x402, receipts, growth history, verification, and identity without flattening the delivered service payload.

### 2. Market Adapter Seam

This seam isolates the Hidden Edge core logic from Polymarket-specific API shapes.

- discovery interface: [`packages/hidden-edge/src/adapters/marketDiscovery.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/adapters/marketDiscovery.ts)
- data interface: [`packages/hidden-edge/src/adapters/marketData.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/adapters/marketData.ts)
- normalizer interface: [`packages/hidden-edge/src/adapters/snapshotNormalizer.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/adapters/snapshotNormalizer.ts)

P0 implements only Polymarket:

- [`packages/hidden-edge/src/adapters/polymarket/discovery.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/adapters/polymarket/discovery.ts)
- [`packages/hidden-edge/src/adapters/polymarket/data.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/adapters/polymarket/data.ts)
- [`packages/hidden-edge/src/adapters/polymarket/normalize.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/adapters/polymarket/normalize.ts)

Feature building and ranking depend only on normalized snapshot types:

- [`packages/hidden-edge/src/core/features.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/core/features.ts)
- [`packages/hidden-edge/src/core/ranking.ts`](/C:/Users/blued/Downloads/GrowthBase/packages/hidden-edge/src/core/ranking.ts)

That is the future-proof boundary for additional markets.

## Deterministic Snapshot-First Execution

The service executes in this order:

1. Parse and validate the exact Hidden Edge input schema.
2. Build the canonical request record `{ policyId, serviceId, agentWallet, input }`.
3. Compute `requestHash`.
4. Check `service_runs` for idempotent replay.
5. Discover Polymarket markets and fetch read-only data.
6. Normalize and persist the canonical snapshot before scoring.
7. Reload the persisted snapshot and run features/ranking only from normalized data.
8. Build the exact typed artifact.
9. Build the exact proof envelope and hash-link it to request, snapshot, and artifact.
10. Persist proof, artifact, and run linkage.

This makes replay canonical and keeps live upstream drift out of repeated runs for the same request hash.

## Persistence Model

SQLite is the only datastore in P0.

- `receipt_records`: append-only commerce receipts plus stored policy, request, offer, and artifact JSON
- `normalized_snapshots`: canonical persisted normalized snapshots keyed by `request_hash` and `snapshot_id`
- `proof_records`: exact proof envelopes keyed by `proof_hash`
- `service_runs`: replay index keyed by `request_hash`
- `artifacts`: immutable artifact store
- `policy_revocations`: explicit revocation ledger

## Public API Surface

- `GET /offers`
- `GET /offers/:serviceId`
- `POST /purchase/:serviceId`
- `GET /receipts/:receiptId`
- `GET /agents/:agentWallet/receipts`
- `GET /agents/:agentWallet/growth-history`
- `GET /agent-profile`
- `GET /.well-known/agent-registration.json`

## Read-Only Market Scope

P0 is read-only against Polymarket public APIs. The service can discover active markets, search entities, filter tags, read order books and price history, and normalize that data. It does not authenticate to Polymarket and does not place or manage live orders.
