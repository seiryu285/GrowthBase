# GrowthBase Decision Log

## Hidden Edge Scan was chosen over abstract readiness packs

The first paid service needs to prove that GrowthBase can sell something concrete, return a rich typed artifact, and append a meaningful receipt. A generic readiness pack validates plumbing but not differentiated utility. `polymarket-hidden-edge-scan` is concrete enough to justify payment and structured enough to prove the receipt and verification model.

## Thin adapter integration was chosen over rewriting GrowthBase

GrowthBase already owns the correct substrate concerns: policy, x402 purchase orchestration, receipt persistence, growth derivation, verification, and identity. Rewriting the product around the service would blur responsibilities and make the first service look like the platform. The service adapter seam keeps the existing product boundary intact.

## The market adapter seam was introduced now

Without an explicit market seam, Hidden Edge core logic would hard-code Polymarket response shapes into discovery, feature building, ranking, and artifact generation. That would make later venue expansion expensive and brittle. Introducing the seam in P0 is cheaper than undoing raw-API coupling later.

## Normalized snapshots are the correct future-proof boundary

The real deterministic boundary is the persisted normalized snapshot, not the upstream venue payload. Normalization removes direct dependency on raw Polymarket structures, gives scoring a canonical input model, and lets replay use stored evidence instead of live upstream state.

## Polymarket remains read-only in P0

P0 only needs to discover markets, read order books and history, and produce ranked intelligence artifacts. Read-only public access keeps the service deterministic, easier to test offline, and lower risk than authenticated trading or order management.

## GrowthBase remains the substrate

Receipts, growth history, verifier surfaces, and ERC-8004-compatible identity are the durable trust layer. Hidden Edge is the first service that runs through that layer. The product is still GrowthBase because the commerce, policy, and verification loop is the primary reusable system.

## Only one market adapter is implemented in P0

The code must make another market possible, but implementing a second venue now would add integration surface without improving the first closed loop. P0 therefore implements the market seam and one concrete Polymarket adapter only.

## Additional P0 choices

- Canonical replay is keyed by `requestHash`.
- Replayed service results still produce a new append-only receipt for each successful paid purchase.
- Policy price limits stay human-readable decimal USDC while offer and receipt price values are atomic Base payment units.
- Lightweight counters are enough for service observability in P0.
