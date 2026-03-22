# GrowthBase

GrowthBase is a TypeScript monorepo implementing the delegated agent commerce boundary on Base. In P0 it exposes one flagship paid service, `polymarket-hidden-edge-scan`, while GrowthBase remains the policy, x402 purchase, receipt, growth-history, verification, and ERC-8004 identity substrate.

## Workspace

```text
apps/
  api/
  web/
  agent-demo/
packages/
  core/
  artifacts/
  db/
  growth/
  hidden-edge/
  identity/
  policy/
  receipt/
docs/
tests/
```

## Closed Loop

1. A human signs a `DelegationPolicy`.
2. An agent discovers `polymarket-hidden-edge-scan` from `/offers`.
3. The agent purchases it through the x402-protected `POST /purchase/polymarket-hidden-edge-scan` flow.
4. Hidden Edge persists a canonical normalized snapshot, ranks candidates deterministically, and returns a typed artifact plus proof.
5. GrowthBase appends a canonical `CommerceReceipt`, derives `GrowthHistoryEntry`, and exposes verification surfaces.

## Run

```powershell
pnpm.cmd install
pnpm.cmd db:generate
pnpm.cmd db:migrate
pnpm.cmd dev:api
pnpm.cmd dev:web
pnpm.cmd demo
pnpm.cmd test
pnpm.cmd test:unit
pnpm.cmd test:integration
```
