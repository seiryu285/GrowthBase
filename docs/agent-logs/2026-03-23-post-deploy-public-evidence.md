# Agent Session Log - 2026-03-23 - Post-Deploy Public Evidence (Railway + Deterministic Demo)

## Date/time

- Log written: `2026-03-23T17:02:00+09:00` (local)
- Evidence JSON timestamps in bundles are UTC (`2026-03-22T16:43Z`–`16:55Z` range for the runs below).

## Objective

- Deploy the current repo state to the public Railway API host, verify health, capture **post-deploy** external proof bundles for:
  - live mode (`PROOF_TARGET=live`) on Railway
  - deterministic demo (`PROOF_TARGET=deterministic-demo`) on a public `MARKET_DATA_MODE=fixture` host behind a Cloudflare quick tunnel
- Run paid-failure inspection against the production database path used by the Railway container.
- Record commands, outputs, file paths, transaction hashes, receipt status, and remaining risks (append-only; does not replace prior agent logs).

## Deployed targets

| Target | URL / note |
|--------|------------|
| Production API (Railway) | `https://growthbase-production.up.railway.app` |
| Railway project | `growthbase` (CLI linked); deployment `6e4a04ea-1ac7-459f-aabe-111247d8e69d` reached **SUCCESS** after `railway up --detach` from workspace `c:\Users\blued\Downloads\GrowthBase` |
| Deterministic demo (ephemeral) | Cloudflare quick tunnel `https://degrees-hispanic-enabled-sequence.trycloudflare.com` → origin `http://127.0.0.1:3110` (local API, `MARKET_DATA_MODE=fixture`, `X402_MODE=local`, sqlite `data/postdeploy-fixture-m23.sqlite`) |

## Commands run (exact)

### 1) Deploy

```powershell
Set-Location "c:\Users\blued\Downloads\GrowthBase"
railway up --detach
```

Build/deploy logs (Railway UI): `https://railway.com/project/e80e2be8-0050-41f5-a752-8f17a6ecdd3e/service/b24e0cc7-bd07-4486-890d-050cd89c874b?id=6e4a04ea-1ac7-459f-aabe-111247d8e69d&` (from CLI output at deploy time).

### 2) Health / basic route

```powershell
(Invoke-WebRequest -Uri "https://growthbase-production.up.railway.app/offers" -UseBasicParsing -TimeoutSec 30).StatusCode
# 200
```

### 3) Live external proof (Railway, `PROOF_TARGET=live`)

```powershell
Set-Location "c:\Users\blued\Downloads\GrowthBase"
$env:PROOF_TARGET='live'
$env:API_BASE_URL='https://growthbase-production.up.railway.app'
$env:PROOF_LABEL='railway-live-postdeploy-2026-03-23'
pnpm.cmd proof:external
```

Console summary (stdout JSON):

```json
{
  "apiBaseUrl": "https://growthbase-production.up.railway.app",
  "proofTarget": "live",
  "serviceId": "polymarket-hidden-edge-scan",
  "policyMode": "open-payer",
  "specStatus": 200,
  "unpaidStatus": 503,
  "paidStatus": 503,
  "paymentAccepted": false,
  "paidResponsePayer": null,
  "failureRecordId": null,
  "receiptId": null,
  "evidencePath": "data/proofs/external-purchase-proof-railway-live-postdeploy-2026-03-23.latest.json",
  "bodyPath": "data/proofs/purchase-body-railway-live-postdeploy-2026-03-23.latest.json"
}
```

**Note:** `GROWTHBASE_SPENDER_PRIVATE_KEY` was **not** set in this shell. No on-chain settlement occurred because both unpaid and paid POSTs failed at the **pre-payment serviceability** gate (`503`). This is consistent with fail-closed live behavior before charge.

### 4) Deterministic demo external proof (`PROOF_TARGET=deterministic-demo`)

Local fixture API was started via `cmd.exe` so environment variables apply to the child process; Cloudflare quick tunnel was pointed at `http://127.0.0.1:3110`; API was restarted with `API_BASE_URL` / `AGENT_URI` set to the tunnel URL (see stderr/stdout logs under `data/proofs/api-phaseA.*`, `api-phaseB.*`, `cf-phaseA.err.log` if preserved).

```powershell
Set-Location "c:\Users\blued\Downloads\GrowthBase"
$env:PROOF_TARGET='deterministic-demo'
$env:API_BASE_URL='https://degrees-hispanic-enabled-sequence.trycloudflare.com'
$env:PROOF_LABEL='public-fixture-postdeploy-2026-03-23'
pnpm.cmd proof:external
```

Console summary (stdout JSON):

```json
{
  "apiBaseUrl": "https://degrees-hispanic-enabled-sequence.trycloudflare.com",
  "proofTarget": "deterministic-demo",
  "serviceId": "polymarket-hidden-edge-scan",
  "policyMode": "open-payer",
  "specStatus": 200,
  "unpaidStatus": 402,
  "paidStatus": 200,
  "paymentAccepted": false,
  "failureRecordId": null,
  "receiptId": "receipt_ce5db40652639c86",
  "evidencePath": "data/proofs/external-purchase-proof-public-fixture-postdeploy-2026-03-23.latest.json",
  "bodyPath": "data/proofs/purchase-body-public-fixture-postdeploy-2026-03-23.latest.json"
}
```

(`paymentAccepted: false` in this summary line is expected on the success path; the script only populates payment-acceptance fields from **error** payloads. Full payer + tx are in the bundle under `paid.body` and `receipt`.)

### 5) Paid-failure inspection (production container)

```powershell
Set-Location "c:\Users\blued\Downloads\GrowthBase"
railway ssh "cd /app && pnpm exec tsx scripts/inspect-paid-failures.ts -- --limit 10"
```

Output:

```json
{
  "database": "/app/C:/Program Files/Git/data/growthbase.sqlite",
  "limit": 10,
  "count": 0,
  "failures": []
}
```

## Proof bundle paths (durable artifacts in repo)

| Proof | Latest bundle path | Body path |
|-------|-------------------|-----------|
| Live post-deploy | `data/proofs/external-purchase-proof-railway-live-postdeploy-2026-03-23.latest.json` | `data/proofs/purchase-body-railway-live-postdeploy-2026-03-23.latest.json` |
| Deterministic post-deploy | `data/proofs/external-purchase-proof-public-fixture-postdeploy-2026-03-23.latest.json` | `data/proofs/purchase-body-public-fixture-postdeploy-2026-03-23.latest.json` |

Timestamped run copies were also written alongside `*.latest.json` by the proof script (same directory).

## Live proof result (behavior vs design)

- `GET /purchase/:serviceId` (spec): **200**
- Unpaid `POST`: **503**, `error.code = PRE_PAYMENT_SERVICEABILITY_FAILED`, `executionOutcome = PRE_PAYMENT_SERVICEABILITY_FAILED` (no `PAYMENT-REQUIRED` path for this request)
- Paid `POST` (with x402 client): **503**, same pre-payment failure (no settlement, no `receiptId`)
- **Transaction hash:** none (no charge)

Matches intended **fail-closed** behavior: reject stale / unserviceable live market state **before** settlement.

## Deterministic demo proof result

- Spec: **200**
- Unpaid: **402** (x402 challenge)
- Paid retry: **200**, artifact + proof returned; **receipt persisted**
- **Receipt id:** `receipt_ce5db40652639c86`
- **Buyer / payer (from receipt in bundle):** `0x425A8960A99C127fEB4d541b12E09352845797F8` (default demo spender when `GROWTHBASE_SPENDER_PRIVATE_KEY` unset)
- **Settlement transaction hash (from `paymentResponse` in bundle):** `0x7622797c4514dc6edb0e4aa2af4d02529445e811bc89c433cff0dda3e2e2d005`

## Paid-failure inspection result

- **0** rows returned from `paid_artifact_failure_records` on the production sqlite file path mounted in the container.
- No `failureRecordId` in the live proof run (failed before payment).

## Remaining risks

1. **Railway `DATABASE_URL` value** is stored as a Windows-style path (`C:/Program Files/Git/data/growthbase.sqlite`). The runtime creates `/app/C:/Program Files/Git/data/growthbase.sqlite` inside the container. This is fragile and should be corrected to a normal Linux path or Railway volume path for long-term ops.
2. **Live proof did not exercise a funded settlement** in this session: serviceability failed first (`503`), so on-chain payer proof on live mode was not observed here.
3. **Cloudflare quick tunnels** are ephemeral and not SLA-backed; deterministic demo URL is not a permanent public host.
4. **`railway run` for `inspect:paid-failures` on Windows** can resolve the wrong sqlite path when `DATABASE_URL` is relative; use `railway ssh "cd /app && ..."` for production inspection (as above).

## Next recommended step

- Correct **Railway `DATABASE_URL`** to a stable container-local sqlite path (or managed DB) and re-run `inspect:paid-failures` after any live **paid-then-artifact-failed** scenario to validate durable rows in production.
- When Polymarket live data is serviceable, re-run **`PROOF_TARGET=live`** with `GROWTHBASE_SPENDER_PRIVATE_KEY` set to a funded Base USDC wallet to capture a post-deploy **funded** live proof (optional, only if the pre-payment gate passes).
