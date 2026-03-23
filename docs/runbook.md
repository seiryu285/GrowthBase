# GrowthBase Runbook

## Two-lane model (read this first)

- **Lane A — deterministic success:** fixture-backed API + local x402 settlement. Use for **repeatable** external purchase → receipt → verify-bundle proofs. See **[success-lane.md](./success-lane.md)** and `pnpm proof:success-lane:tunnel`.
- **Lane B — live fail-closed:** `https://growthbase-production.up.railway.app` stays **`MARKET_DATA_MODE=live`** with strict pre-payment gates; **503** when unserviceable is expected safety behavior, not a Lane A regression.

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

Use the values in [`.env.example`](../.env.example).

### Railway database path (Linux)

Set `DATABASE_URL` to a **POSIX absolute path** inside the container, e.g. `/app/data/growthbase.sqlite` (the API start command runs `mkdir -p /app/data` before migrate). Avoid pasting a Windows `C:\...` path into Railway variables: on Linux it mis-resolves under `/app/C:/...`. The DB client also maps common Windows-style `DATABASE_URL` values to `/app/data/growthbase.sqlite` on non-Windows runtimes.

### Vercel web (canonical entrypoint)

Public site: [https://growthbase-web.vercel.app/](https://growthbase-web.vercel.app/). Configure `NEXT_PUBLIC_LIVE_API_BASE_URL` and `NEXT_PUBLIC_SITE_URL` per [`.env.example`](../.env.example). Optional: `NEXT_PUBLIC_RECEIPT_VERIFY_API_BASE_URL` (or legacy `NEXT_PUBLIC_RECEIPT_VERIFY_API_URL`) to override the verify-bundle base. If you want `/evidence` to show the on-chain receipt anchor for reviewers, also set `NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS` and optionally `NEXT_PUBLIC_RECEIPT_ANCHOR_EXPLORER_URL`.

Important P0 defaults:

- `X402_MODE=local`
- `X402_NETWORK=eip155:8453`
- `X402_PRICE_ATOMIC=50000`
- `POLYMARKET_MAX_BOOK_AGE_MS=15000`
- Polymarket access is read-only and public

Live serviceability guidance:

- Keep fail-closed behavior and pre-payment gating; do not charge if the live market set is already unserviceable.
- `universe=auto` is broader and more failure-prone in strict live mode because one stale market can block the request before payment.
- Prefer setting `POLYMARKET_EVENT_SLUGS` and/or `POLYMARKET_MARKET_SLUGS` to liquid markets on the hosted live API.
- Keep `GROWTHBASE_DEMO_*` aligned with the same live targeting strategy. The public readiness surface and `pnpm.cmd demo` now share those defaults.

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

Useful live browser endpoints on the hosted API:

- `GET /offers/polymarket-hidden-edge-scan/live-readiness`
- `GET /offers/polymarket-hidden-edge-scan/latest-artifact`

The first endpoint reuses the pre-payment serviceability gate without charging. The second returns the most recent delivered live artifact bundle already stored on that host.

## External verify-bundle proof (canonical, no local DB)

For a **successful delivery** on a public or tunnel API host, run the canonical script that completes purchase and then pulls durable verification from the **same** host (no local `DATABASE_URL` reconstruction):

```powershell
$env:API_BASE_URL='https://growthbase-production.up.railway.app'
$env:GROWTHBASE_SPENDER_PRIVATE_KEY='0xYOUR_FUNDED_BASE_USDC_KEY'
$env:GROWTHBASE_DEMO_MAX_BOOK_AGE_MS='10000'
$env:PROOF_LABEL='railway-external-verify'
pnpm.cmd proof:external-verify
```

Set `GROWTHBASE_DEMO_MAX_BOOK_AGE_MS` (and other `GROWTHBASE_DEMO_*` fields) to values the **target host** accepts. Some deployed APIs cap `maxBookAgeMs` below this repo’s default (`15000` in `.env.example`); if purchase returns `500` with `ARTIFACT_GENERATION_FAILED` / input validation, lower `maxBookAgeMs` or align with the host’s live readiness defaults.

Outputs:

- **Success:** `data/proofs/external-verify-proof-<label>.latest.json` — includes `purchase` (`receiptId`, `transactionId`, `verifyUrl`), full `receipt`, `verifyBundle`, and `verification` flags, plus a timestamped run file.
- **Failure:** `data/proofs/external-verify-proof-<label>.failure.latest.json` and `external-verify-proof-<label>-failure-<timestamp>.json` — machine-readable `proofKind: "external-verify-bundle-failure"`, `failureStage`, `classification` (for example `PRE_PAYMENT_SERVICEABILITY_FAILED`, `PAYMENT_ACCEPTED_ARTIFACT_FAILED`, `insufficient_funds`, `ARTIFACT_GENERATION_FAILED`), and response bodies. Exit code is non-zero.

Live success still requires passable pre-payment serviceability **and** a funded x402 spender on Base USDC.

The purchase response `verifyUrl` uses the query parameter `receiptId` (the `/verify` page also accepts legacy `receipt_id` for old links).

## External Public Purchase Proof

Use the reusable proof script when you need a copy-pasteable external checkout probe. It writes:

- a fresh signed purchase body to `data/proofs/purchase-body-<label>.latest.json`
- the full request/response evidence bundle to `data/proofs/external-purchase-proof-<label>.latest.json`

The proof script now supports two explicit targets:

- `PROOF_TARGET=live`
- `PROOF_TARGET=deterministic-demo`

Post-deploy evidence snapshot (`2026-03-23`): append-only log [`docs/agent-logs/2026-03-23-post-deploy-public-evidence.md`](./agent-logs/2026-03-23-post-deploy-public-evidence.md) (bundles: `data/proofs/external-purchase-proof-railway-live-postdeploy-2026-03-23.latest.json` for Railway live, `data/proofs/external-purchase-proof-public-fixture-postdeploy-2026-03-23.latest.json` for deterministic demo via Cloudflare quick tunnel).

### Live Railway Host

This is the public API host linked to the repo:

- `https://growthbase-production.up.railway.app`

Run the live proof with a Base wallet that can cover `50000` atomic USDC (`0.05 USDC`):

```powershell
$env:PROOF_TARGET='live'
$env:API_BASE_URL='https://growthbase-production.up.railway.app'
$env:GROWTHBASE_SPENDER_PRIVATE_KEY='0xYOUR_FUNDED_BASE_USDC_KEY'
$env:PROOF_LABEL='railway-live'
$env:GROWTHBASE_DEMO_UNIVERSE='auto'
$env:GROWTHBASE_DEMO_MAX_BOOK_AGE_MS='15000'
pnpm.cmd proof:external
```

Notes:

- `spenderWallet` is optional in the request body. Open-payer mode is the default.
- Fund the payer with at least `0.05` Base USDC for one purchase. Keep Base ETH only if you need to bridge or swap into that wallet before the proof run.
- If you need to force fixed-spender mode for a stale deployment, set `POLICY_SPENDER_WALLET=0x...` or `FORCE_FIXED_SPENDER=1` before running the script.
- The exact body used for the run is written to `data/proofs/purchase-body-railway-live.latest.json` unless you override `PROOF_LABEL`.
- The stable-host evidence bundle is written to `data/proofs/external-purchase-proof-railway-live.latest.json` unless you override `PROOF_LABEL`.
- The repo default live freshness threshold is `POLYMARKET_MAX_BOOK_AGE_MS=15000`; if the host is too broad, narrow `POLYMARKET_EVENT_SLUGS` and/or `POLYMARKET_MARKET_SLUGS` before rerunning proof.
- `pnpm.cmd demo` now uses the same `GROWTHBASE_DEMO_*` env vars. Use them to move from a broad `auto` scan to a narrower `search:` or `tag:` request without editing code.
- After this repo state is deployed, known stale live Polymarket books should fail before settlement with `503 PRE_PAYMENT_SERVICEABILITY_FAILED`.
- Historical `2026-03-22` Railway proof bundles still show the earlier paid-then-fail behavior because that public host was on older code when the proof was taken.

Canonical video-proof example to reference consistently:

- bundle: `data/proofs/external-purchase-proof-railway-live-funded.latest.json`
- transaction hash evidence: `0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e`
- explanation: [`docs/external-purchase-proof.md`](./external-purchase-proof.md)
- scope: payment acceptance and tx-hash evidence on the public Railway host, **not** successful live delivery

### Fixture-mode proof (local / tunnel / any explicit fixture host)

Submission uses **one** public live Railway API. For **offline-repeatable** external proof against an API that is explicitly running `MARKET_DATA_MODE=fixture` (local process, Cloudflare quick tunnel, or any fixture base URL you control — **not** implied to be a second public Railway service), use:

Host environment (example local):

```powershell
$env:PORT='3110'
$env:DATABASE_URL='./data/fixture-proof.sqlite'
$env:X402_MODE='local'
$env:MARKET_DATA_MODE='fixture'
$env:API_BASE_URL='https://YOUR-FIXTURE-HOST'
$env:AGENT_URI="$env:API_BASE_URL/.well-known/agent-registration.json"
pnpm.cmd --filter @growthbase/api start
```

External proof run:

```powershell
$env:PROOF_TARGET='deterministic-demo'
$env:API_BASE_URL='https://YOUR-FIXTURE-HOST'
$env:PROOF_LABEL='fixture-proof'
pnpm.cmd proof:external
```

When the run succeeds against fixture mode, the script records `proofTarget="deterministic-demo"` and `expectedRuntimeMode="fixture"` so the output is not misrepresented as live market output.

### Actual Payer Verification

After a successful paid retry that returns `200`, fetch `GET /receipts/:receiptId` and inspect:

- `buyerWallet`
- `paymentResponse.payer`

If a paid run still fails after settlement, inspect the paid response instead:

- `error.code = PAYMENT_ACCEPTED_ARTIFACT_FAILED`
- `error.details.paymentAccepted`
- `error.details.buyerWallet`
- `error.details.paymentResponse.payer`
- `error.details.failureRecordId`
- `error.details.deliveryStatus`
- `payment-response` header

Those fields come from verified settlement output, and the proof script records them under `actualPayerInspection.paidResponseValues`.

If live serviceability is already stale before charge, the purchase route should return:

- `error.code = PRE_PAYMENT_SERVICEABILITY_FAILED`
- HTTP `503`
- no `PAYMENT-REQUIRED` challenge header

### Inspect Paid Failure Records

Use the repo debug script to inspect the append-only internal record of paid-but-failed deliveries:

```powershell
pnpm.cmd inspect:paid-failures -- --limit 5
pnpm.cmd inspect:paid-failures -- --failureId payfail_xxxxxxxxxxxxxxxx
```

Notes:

- The default database path is `data/growthbase.sqlite` unless `DATABASE_URL` is set.
- The durable table name is `paid_artifact_failure_records`.
- Each row preserves the verified payer, settlement transaction hash, failure code/message/details, canonical request hash, and the explicit delivery status `PAID_BUT_ARTIFACT_FAILED`.

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
- paid-after-settlement failure events in `paid_artifact_failure_records`

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

Separately from the in-memory counters, paid-after-settlement delivery failures are written durably to `paid_artifact_failure_records`.

## Operator handoff (hosted configuration)

Use this checklist for the **single public submission surface**: one Vercel site and one public Railway live API.

### Hosted targets (source of truth)

| Platform | Name | Role |
|----------|------|------|
| GitHub | `seiryu285/GrowthBase` | Deployment source (default branch `main`) |
| Railway | Project `growthbase`, Service `growthbase`, Environment `production` | **Live** API (`MARKET_DATA_MODE=live`) — public base `https://growthbase-production.up.railway.app` |
| Vercel | Project `growthbase-web` | **Canonical** public site — `https://growthbase-web.vercel.app/` |

### 1. Vercel production environment

On project **`growthbase-web`**, Production, set at least:

```text
NEXT_PUBLIC_SITE_URL=https://growthbase-web.vercel.app
NEXT_PUBLIC_LIVE_API_BASE_URL=https://growthbase-production.up.railway.app
```

Optional reviewer-facing proof vars:

```text
NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS=0x...
NEXT_PUBLIC_RECEIPT_ANCHOR_EXPLORER_URL=https://basescan.org/address/0x...
```

Redeploy after changes.

### 2. Validate public routes

From a browser (no auth):

- [https://growthbase-web.vercel.app/](https://growthbase-web.vercel.app/)
- [https://growthbase-web.vercel.app/live](https://growthbase-web.vercel.app/live)
- [https://growthbase-web.vercel.app/demo](https://growthbase-web.vercel.app/demo) — guided links to the **live** public API
- [https://growthbase-web.vercel.app/evidence](https://growthbase-web.vercel.app/evidence)
- [https://growthbase-web.vercel.app/verify](https://growthbase-web.vercel.app/verify)

If any of `/live`, `/demo`, or `/evidence` returns `404` while the route files exist in `apps/web/app/`, the fix is a **Vercel production redeploy** with the current repo state rather than a second-host workaround.

Optional: run `PROOF_TARGET=live` with `API_BASE_URL=https://growthbase-production.up.railway.app` and archive `data/proofs/*.latest.json` per [docs/external-purchase-proof.md](./external-purchase-proof.md). Fixture-mode CLI runs (`PROOF_TARGET=deterministic-demo`) are documented above for **non-submission** local/tunnel hosts.

### 3. Final submission checks

- [ ] Live API still responds (`GET /offers` on Railway live host).
- [ ] `/verify` on Vercel defaults to live `verify-bundle` unless overrides are intentional.
- [ ] `docs/SUBMISSION.md` and evidence docs still match honest limitations (no fake “live success” if serviceability blocked).
