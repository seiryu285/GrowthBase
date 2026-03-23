# External Purchase Proof

## Summary

As of `2026-03-23`, the repo has two distinct proof modes:

- `live`
  - honest live Polymarket mode
  - should now fail before settlement with `PRE_PAYMENT_SERVICEABILITY_FAILED` when stale data is already knowable
- `deterministic-demo`
  - CLI label for an API that is **explicitly** running `MARKET_DATA_MODE=fixture` (local, tunnel, or any fixture base URL)
  - preserves the real purchase boundary and durable receipt path; **not** tied to a second public Railway service

## Canonical example for the demo video

Use this one historical proof consistently when you need a reviewer-facing transaction-hash example:

- proof bundle: `data/proofs/external-purchase-proof-railway-live-funded.latest.json`
- transaction hash evidence: `0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e`
- what it proves: accepted payment on the public Railway host, plus verified payer and transaction-hash evidence
- what it does **not** prove: successful live artifact delivery on current market conditions

The repo still retains the earlier `2026-03-22` historical bundles under `data/proofs/`:

1. `external-purchase-proof-railway-live.latest.json`
   - public Railway host updated to current checkout
   - `GET /purchase/:serviceId` returns `200`
   - unpaid `POST /purchase/:serviceId` returns x402 `402`
   - paid retry reaches the live x402 boundary and fails with `insufficient_funds`
2. `external-purchase-proof-railway-live-funded.latest.json`
   - stable public Railway host with a funded Base payer
   - `GET /purchase/:serviceId` returns `200`
   - unpaid `POST /purchase/:serviceId` returns x402 `402`
   - paid retry is accepted by the live x402 boundary on Railway
   - downstream service execution fails closed on stale live Polymarket books
3. `external-purchase-proof-public-live-tunnel.latest.json`
   - public Cloudflare tunnel with `X402_MODE=local` and `MARKET_DATA_MODE=live`
   - paid retry reaches the service runner and fails closed on stale live Polymarket books
4. `external-purchase-proof-public-fixture-tunnel.latest.json`
   - public Cloudflare tunnel with `X402_MODE=local` and `MARKET_DATA_MODE=fixture`
   - full external `GET spec -> unpaid 402 -> paid 200 -> receipt 200` success

The tunnel hosts are intentionally ephemeral. The JSON proof bundles are the durable record.

## Public Host Results

### Railway Live (historical pre-gate evidence)

- Base URL: `https://growthbase-production.up.railway.app`
- Service: `polymarket-hidden-edge-scan`
- Purchase spec: `200`, open-payer default, `policy.spenderWallet` optional
- Unpaid POST: `402`, machine-readable x402 challenge with `requiredBodyFields=["policy","agentIdentity","input"]`
- First paid retry: `402`
  - x402 error: `insufficient_funds`
  - exact evidence: `data/proofs/external-purchase-proof-railway-live.latest.json`
- Funded paid retry: `502`
  - verified payer wallet used: `0x78Bc7A2A7efA48A6Dff5c34bb5eC52e0a8e408ac`
  - `error.details.paymentAccepted = true`
  - `error.details.buyerWallet = 0x78bc7a2a7efa48a6dff5c34bb5ec52e0a8e408ac`
  - `error.details.paymentResponse.payer = 0x78bc7a2a7efa48a6dff5c34bb5ec52e0a8e408ac`
  - `error.details.paymentResponse.transaction = 0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e`
- `payment-response` header is also present on the Railway response
- `receipt = null` because receipt persistence still happens after artifact generation succeeds
- exact evidence: `data/proofs/external-purchase-proof-railway-live-funded.latest.json`
- exact body: `data/proofs/purchase-body-railway-live-funded.latest.json`
- exact post-payment failure: `ARTIFACT_GENERATION_FAILED` / `Live Polymarket order book is stale.`

### Live Behavior After This Repo State Is Deployed

- known stale live data should fail before settlement
- expected code: `PRE_PAYMENT_SERVICEABILITY_FAILED`
- expected HTTP status: `503`
- expected behavior: no x402 charge, no post-settlement artifact failure path when staleness is already knowable before charge
- if a paid run still fails after settlement for a later-stage reason, the response should expose:
  - `error.code = PAYMENT_ACCEPTED_ARTIFACT_FAILED`
  - `error.details.failureRecordId`
  - `error.details.deliveryStatus = PAID_BUT_ARTIFACT_FAILED`
  - verified payer and transaction data in `error.details.paymentResponse`

### Fixture proof via tunnel (historical capture)

This section documents an **ephemeral** Cloudflare tunnel to a **fixture** API — not a permanent second public Railway host.

- Base URL used during proof: `https://instructor-casio-township-tickets.trycloudflare.com`
- Service: `polymarket-hidden-edge-scan`
- Purchase spec: `200`
- Unpaid POST: `402`
- Paid retry: `200`
- Receipt fetch: `200`
- Evidence bundle: `data/proofs/external-purchase-proof-public-fixture-tunnel.latest.json`
- Request body used: `data/proofs/purchase-body-public-fixture-tunnel.latest.json`
- honest runtime mode: `fixture`
- proof target label to use going forward: `deterministic-demo`

## Verified Success Details

The successful public fixture proof shows:

- `receiptId`: `receipt_6b4416f014b4d4e8`
- `deliveryStatus`: `DELIVERED`
- actual payer in both receipt fields:
  - `buyerWallet = 0x425A8960A99C127fEB4d541b12E09352845797F8`
  - `paymentResponse.payer = 0x425A8960A99C127fEB4d541b12E09352845797F8`
- artifact returned inline with proof:
  - `scanId = 56b8dc83-59cf-560d-88e7-8ed8f6a4878d`
  - `snapshotId = e5096887-9f41-5555-82a4-cf665485b2c3`
  - top candidate action: `ENTER_NOW`
  - `artifact_hash = 0x528191e9f98c6d885bb8d4ab1aa95baa29adabdbdeec33c7b656751d387c7ae5`

## Operator Inspection

Paid-after-settlement failures are now durably recorded in `paid_artifact_failure_records`.

Use:

```powershell
pnpm.cmd inspect:paid-failures -- --limit 5
pnpm.cmd inspect:paid-failures -- --failureId payfail_xxxxxxxxxxxxxxxx
```

Each record preserves:

- `service_id`
- `request_hash`
- verified `buyer_wallet`
- settlement `transaction_hash`
- payment scheme/network/asset/amount context
- `executionOutcome = PAYMENT_ACCEPTED_ARTIFACT_FAILED`
- `deliveryStatus = PAID_BUT_ARTIFACT_FAILED`
- failure code, message, and details

## Live Blockers

Historical public Railway evidence shows one live blocker after payment acceptance:

1. Live market data can still fail closed on stale Polymarket books after payment settles.
   - stable host evidence: `data/proofs/external-purchase-proof-railway-live-funded.latest.json`
   - public live tunnel evidence: `data/proofs/external-purchase-proof-public-live-tunnel.latest.json`
   - observed error: `ARTIFACT_GENERATION_FAILED`
   - observed reason: `Live Polymarket order book is stale.`

After the `2026-03-23` repo changes are deployed, the expected first-line behavior is to reject that same stale condition before settlement with `PRE_PAYMENT_SERVICEABILITY_FAILED`.

The earlier `insufficient_funds` boundary has already been crossed and preserved in `data/proofs/external-purchase-proof-railway-live.latest.json`.

## Exact Final Live Command

Once you have a funded Base wallet private key available to the operator shell, rerun:

```powershell
$env:PROOF_TARGET='live'
$env:API_BASE_URL='https://growthbase-production.up.railway.app'
$env:GROWTHBASE_SPENDER_PRIVATE_KEY='0xYOUR_FUNDED_BASE_USDC_KEY'
$env:PROOF_LABEL='railway-live-funded'
pnpm.cmd proof:external
```

That command reuses the same proof path and will write a fresh signed request body and fresh stable-host evidence bundle into `data/proofs/`.

## Deterministic-demo command (fixture host)

```powershell
$env:PROOF_TARGET='deterministic-demo'
$env:API_BASE_URL='https://YOUR-FIXTURE-HOST'
$env:PROOF_LABEL='fixture-proof'
pnpm.cmd proof:external
```

Use that target only against a host that is explicitly configured with `MARKET_DATA_MODE=fixture` (local, tunnel, or any fixture base URL you control).
