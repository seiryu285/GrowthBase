# Service Spec: polymarket-hidden-edge-scan

## Summary

`polymarket-hidden-edge-scan` is the first real paid service running on GrowthBase.

It reads public Polymarket data, resolves a market universe selector, captures a canonical normalized snapshot, builds deterministic features, ranks candidate positions, and returns a typed scan result with proof linkage.

It is read-only market intelligence.

## Why an agent would buy it

An agent buys this service to convert a human-signed spending policy into a bounded, machine-consumable market scan with deterministic evidence.

The output includes:

- ranked candidates,
- side recommendations,
- fair-value ranges,
- edge estimates,
- sizing limits,
- expiration timestamps,
- proof-linked delivery metadata.

## Why this is the right first paid service

This service is a good flagship because:

- the input contract is structured,
- the upstream data source is public,
- the artifact is rich enough to justify payment,
- the proof and receipt chain can be reconstructed later.

## Artifact shape

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

Each candidate includes:

- rank
- market metadata
- recommended side
- market probability
- fair-value bounds
- entry level
- hidden-edge basis points
- safe size
- score
- reason codes
- action
- expiry

## Trust and growth linkage

GrowthBase appends a canonical `CommerceReceipt` for each successful paid purchase.

That receipt links:

- the human-signed policy
- the agent and seller identities
- the payment scheme and network
- the canonical request hash
- the artifact hash
- the snapshot hash
- the proof hash

`GrowthHistoryEntry` is derived from receipts only.

## Expansion seam

Hidden Edge feature building and ranking operate on normalized snapshots, not raw Polymarket API objects.

That means additional prediction markets can be supported later through adapter expansion without rewriting the GrowthBase trust and commerce substrate.
