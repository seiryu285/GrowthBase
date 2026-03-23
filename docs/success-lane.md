# Success lane vs live lane (two-lane model)

GrowthBase separates **deterministic external success** from **production live fail-closed** behavior.

## Lane A — public deterministic success (canonical demo / agents)

**Purpose:** Let an external client complete the full **x402 purchase → receipt → verify-bundle** loop against **fixture-backed** market data, without weakening live safety rules elsewhere.

**How it works:**

- Run the API with **`MARKET_DATA_MODE=fixture`** and **`X402_MODE=local`** (deterministic local settlement; same HTTP contracts as production).
- Use an **isolated** `DATABASE_URL` (dedicated sqlite file) for that host.
- Expose the API on a **public HTTPS URL**. Supported patterns:
  - **Cloudflare Quick Tunnel** (ephemeral URL; fine for proofs and CI-style runs)
  - **Dedicated Railway / other host** with the same env profile (stable URL for long-lived demos)

**Agents should treat the purchase host as the source of truth for:**

- `POST /purchase/polymarket-hidden-edge-scan`
- `GET /receipts/:receiptId`
- `GET /receipts/:receiptId/verify-bundle`

**Browser `/verify` on Vercel** loads verify-bundle from `NEXT_PUBLIC_RECEIPT_VERIFY_API_BASE_URL` (defaults to the **live** Railway API). For a receipt minted on **Lane A**, either:

- Open `/verify` with `NEXT_PUBLIC_RECEIPT_VERIFY_API_BASE_URL` (or legacy `NEXT_PUBLIC_RECEIPT_VERIFY_API_URL`) pointing at **the same Lane A base URL**, or  
- Rely on the **machine-readable proof JSON** from `pnpm proof:success-lane:tunnel`, which inlines the full verify-bundle.

**Do not** weaken live serviceability gates on the production Railway service to force success; use Lane A instead.

## Lane B — public live fail-closed (Railway production)

**Canonical URL:** `https://growthbase-production.up.railway.app`

- **`MARKET_DATA_MODE=live`**
- Pre-payment **serviceability** checks; **503** when books are stale or unserviceable (by design).
- **`X402_MODE=live`** on the hosted profile (real facilitator path); requires a **funded** Base USDC payer for settlement.

Treat **503 `PRE_PAYMENT_SERVICEABILITY_FAILED`** and other live failures as **safety evidence**, not as regressions in Lane A.

## Commands

| Goal | Command / doc |
|------|----------------|
| One-shot **public tunnel** proof (Lane A) | `pnpm proof:success-lane:tunnel` — starts fixture API + Cloudflare quick tunnel + `proof:external-verify` |
| Lane A against a **stable URL** you already deployed | `API_BASE_URL=https://your-fixture-host pnpm proof:external-verify` |
| Lane B checkout probe (not full verify-bundle) | `pnpm proof:external` with `PROOF_TARGET=live` — see [runbook](./runbook.md) |

## Committed example (Lane A success)

A machine-readable **success** bundle (purchase + receipt + verify-bundle, `fullyVerified: true`) produced from a Cloudflare quick tunnel run is archived at:

- [`docs/evidence/lane-a-external-verify-bundle.success.json`](./evidence/lane-a-external-verify-bundle.success.json)

The `apiBaseUrl` in that file was an ephemeral `*.trycloudflare.com` host; reproduce with `pnpm proof:success-lane:tunnel` or point `API_BASE_URL` at your own fixture deployment.

## Environment profile (Lane A API)

Minimal reference (see also [`.env.example`](../.env.example)):

```text
MARKET_DATA_MODE=fixture
X402_MODE=local
X402_NETWORK=eip155:8453
PORT=3111
DATABASE_URL=./data/success-lane.sqlite
API_BASE_URL=<public origin including scheme; must match what clients call>
PUBLIC_WEB_APP_URL=https://growthbase-web.vercel.app
AGENT_URI=<API_BASE_URL>/.well-known/agent-registration.json
```

After a tunnel URL is known, **restart** the API with `API_BASE_URL` set to that URL so x402 resource metadata matches the client.
