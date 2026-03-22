# Flagship Service

`polymarket-hidden-edge-scan` is the first real paid service running on GrowthBase.

## What It Does

The service reads public Polymarket market data, resolves a universe selector, captures a canonical normalized snapshot, builds deterministic features, ranks candidate positions, and returns a typed scan result with proof linkage.

It does not place orders. It does not require Polymarket authentication. It is read-only market intelligence.

## Why An Agent Would Buy It

An agent buys the service to convert a human-signed spending policy into a bounded, machine-consumable market scan with deterministic evidence. The output is richer than a generic readiness response because it contains ranked candidates, side recommendations, fair-value ranges, edge estimates, sizing limits, and expiration timestamps.

## Why It Is The Right First Flagship Service

It validates the full GrowthBase loop with something that is both paid and inspectable:

- the input contract is structured
- the upstream data source is public
- the artifact is rich enough to justify payment
- the proof and receipt chain can be reconstructed later

That makes it a better flagship than an abstract readiness pack.

## What Artifact It Returns

The delivered payload preserves the full Hidden Edge contract:

- `scanId`
- `asOf`
- `snapshotId`
- `engineVersion`
- `featureVersion`
- `scoringVersion`
- `marketsScanned`
- `marketsEligible`
- `candidates[]`

Each candidate includes rank, market metadata, recommended side, market probability, fair-value bounds, entry level, hidden-edge basis points, safe size, score, reason codes, action, and expiry.

## How Receipt And Growth Turn This Into Trust

GrowthBase appends a canonical `CommerceReceipt` for each successful paid purchase. That receipt links:

- the human-signed policy
- the agent and seller identities
- the payment scheme and network
- the canonical request hash
- the artifact hash
- the snapshot hash
- the proof hash

`GrowthHistoryEntry` is then derived from receipts only. That turns service consumption into durable evidence of agent activity without adding a mutable trust engine.

## Why The Normalized Snapshot Seam Matters

Hidden Edge feature building and ranking operate on normalized snapshots, not raw Polymarket API objects. That is the future expansion seam. Another prediction market can be added later by implementing discovery, data, and normalization adapters without rewriting GrowthBase or the Hidden Edge core ranking logic.
