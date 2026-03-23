# Agent Session Log - 2026-03-23 - Prepayment Serviceability / Paid Failure Durability / Demo Path

## Date/time

- Started: `2026-03-23T00:53:21.8044460+09:00`

## Objective

- Move the purchase flow from "payment accepted, artifact may fail later" toward:
  - pre-charge serviceability checks for stale live Polymarket data
  - durable append-only recording of paid-but-failed outcomes
  - one deterministic public success path that honestly closes purchase -> artifact -> receipt

## What was already proven before this task

- Stable public paid purchase on Railway succeeded at the x402 payment boundary with a real funded Base payer.
- Base URL: `https://growthbase-production.up.railway.app`
- `serviceId`: `polymarket-hidden-edge-scan`
- Funded payer used for proof: `0x78Bc7A2A7efA48A6Dff5c34bb5eC52e0a8e408ac`
- `GET /purchase/:serviceId` returned `200`.
- Unpaid `POST` returned `402` with a parsed x402 challenge.
- Paid retry returned `502` after settlement, not `402`.
- `paidResponsePayment.paymentAccepted=true`
- Actual payer proof was present in:
  - `error.details.buyerWallet`
  - `error.details.paymentResponse.payer`
  - `error.details.paymentResponse.transaction`
  - `payment-response` header
- Exact transaction hash observed: `0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e`
- Live artifact/result on Railway did not succeed because:
  - `code = ARTIFACT_GENERATION_FAILED`
  - `message = Live Polymarket order book is stale`
  - `marketId = 824952`
  - `receipt = null`
- Supplemental wallet check showed approximately `0.107282 USDC` remained on Base after the proof.
- Existing minimal repo changes already made before this task:
  - [`apps/api/src/services/purchaseService.ts`](../../apps/api/src/services/purchaseService.ts): preserve verified payer + settlement evidence on the post-payment failure branch
  - [`scripts/external-purchase-proof.ts`](../../scripts/external-purchase-proof.ts): record paid-response payer fields even when live run fails after settlement
  - [`tests/integration/purchase.test.ts`](../../tests/integration/purchase.test.ts): settled-payment / failed-artifact integration coverage
  - [`apps/agent-demo/src/client.ts`](../../apps/agent-demo/src/client.ts) and [`package.json`](../../package.json): stable-host proof tooling
  - runbook/docs updates
- Core interpretation already established:
  - payment acceptance is publicly proven
  - full artifact delivery + durable receipt are not yet publicly proven

## Current blockers

- Live Polymarket data can be stale before or during execution.
- Receipt persistence currently happens only after artifact success.
- There is not yet one deterministic public success path that always closes artifact + receipt end to end.

## Design decisions made

- Keep live mode honest and fail closed. Do not silently downgrade live requests to fixture mode.
- Add the pre-payment freshness/serviceability gate at the purchase boundary, before x402 settlement.
- Preserve verified payer semantics and x402 verification as-is.
- Add an append-only durable record for paid-but-failed outcomes instead of faking a success receipt.
- Reuse existing fixture mode as the likely deterministic success path unless repo constraints require a smaller explicit proof-target control in tooling.

## Exact implementation scope for this task

- Add a durable agent-work log location at `docs/agent-logs/`.
- Implement pre-payment serviceability checks for `polymarket-hidden-edge-scan`.
- Persist an append-only paid-after-settlement failure record with verified payer + settlement evidence.
- Update proof tooling and runbook/docs to distinguish honest live mode from deterministic demo/fixture proof mode.
- Add focused tests for:
  - stale live rejection before charge where knowable
  - settled payment + failed artifact => durable persisted failure record
  - unchanged verified payer semantics on successful paid runs

## Validation commands

- Pending at log creation:
  - `pnpm.cmd test:unit`
  - `pnpm.cmd test:integration`
  - focused `vitest` invocations as needed during implementation

## Validation results

- Pending at log creation.

## Remaining risks

- There may still be a time-of-check / time-of-use gap between pre-payment serviceability inspection and final paid execution on live upstream data.
- Public Railway evidence currently reflects the old deployed behavior until the new code is deployed.

## Next recommended step

- Implement the purchase-boundary serviceability check first so stale live data stops before settlement, then attach the durable paid-failure record to the existing post-settlement failure branch.

## Completion update

- Completed: `2026-03-23T01:06:21.7067775+09:00`

### Validation commands actually run

- `pnpm.cmd test:unit -- tests/unit/market-data-mode.test.ts`
- `pnpm.cmd test:integration`

### Validation results

- `test:unit` passed all unit suites (`6` files / `16` tests).
- `test:integration` passed all integration suites (`5` files / `18` tests).
- Added coverage now proves:
  - stale live serviceability is rejected before the x402 boundary
  - a settled payment followed by artifact failure writes a durable append-only failure record
  - verified payer semantics remain intact on successful paid runs
- During validation, a deterministic-fixture timestamp gap was found in the API fixture adapters and fixed by threading the runtime `now()` override into fixture discovery and market-data adapters.

### Remaining risks after implementation

- The pre-payment gate reduces paid-then-fail stale-data outcomes, but there is still a residual time-of-check / time-of-use gap if live data becomes stale after preflight and before the paid execution finishes.
- The public Railway host will keep showing the old historical behavior until this repo state is deployed there.
- The first fresh live purchase still performs extra preflight discovery/data fetches before the paid execution path; replayed requests avoid additional upstream fetches, but the first live request remains more expensive than the prior design.

### Next recommended step after this task

- Deploy this repo state to the public host, then rerun one funded live proof and one deterministic demo proof so `data/proofs/` contains post-change evidence for both `PRE_PAYMENT_SERVICEABILITY_FAILED` and the stable end-to-end demo success path.
