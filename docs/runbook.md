# GrowthBase Runbook

## Service Constants

- `SERVICE_ID=polymarket-hidden-edge-scan`
- `CAPABILITY_ID=hidden_edge_scan_polymarket`
- `ARTIFACT_KIND=hidden_edge_scan_result`
- `SERVICE_PRICE_ATOMIC=50000`
- `SERVICE_NETWORK=eip155:8453`

## Install

```powershell
pnpm.cmd install
pnpm.cmd db:generate
pnpm.cmd db:migrate
```

## Environment

Use the values in [`.env.example`](/C:/Users/blued/Downloads/GrowthBase/.env.example).

Important P0 defaults:

- `X402_MODE=local`
- `X402_NETWORK=eip155:8453`
- `X402_PRICE_ATOMIC=50000`
- Polymarket access is read-only and public

## Start Services

```powershell
pnpm.cmd dev:api
pnpm.cmd dev:web
```

## Run the Agent Demo

```powershell
pnpm.cmd demo
```

The demo exercises the same loop as production P0:

1. discover the offer
2. hit the x402-protected purchase endpoint
3. complete the `402 -> retry -> 200` flow
4. receive artifact, proof, and receipt

## Test Commands

```powershell
pnpm.cmd test
pnpm.cmd test:unit
pnpm.cmd test:integration
```

Integration tests are offline and deterministic. They inject Polymarket discovery and market-data fixtures instead of depending on live upstream network calls.

## Persistence and Replay

The deterministic service pipeline persists:

- normalized snapshots in `normalized_snapshots`
- proof envelopes in `proof_records`
- canonical run linkage in `service_runs`
- receipts in `receipt_records`

If the same canonical request is purchased again, the service returns the stored artifact/proof/snapshot lineage from the persisted snapshot instead of recomputing from live upstream state.

## Operational Checks

When a paid run succeeds, confirm all of the following:

- the offer is visible in `/offers`
- the purchase route returns the full Hidden Edge artifact plus proof
- the stored receipt includes `requestHash`, `artifactHash`, `snapshotHash`, and `proofHash`
- growth history contains the derived flagship-service entry
- verifier reconstruction returns a fully linked transaction

## Observability

P0 keeps in-memory service counters only:

- quote count
- paid run count
- paid success count
- paid failure count
- last artifact latency
- snapshot persist failure count
- proof persist failure count
- idempotent replay count
- upstream degraded count
