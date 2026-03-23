# GrowthBase — submission overview (honest public state)

**Canonical public entry (marketing + navigation):** [https://growthbase-web.vercel.app/](https://growthbase-web.vercel.app/)  
**Repository:** [https://github.com/seiryu285/GrowthBase](https://github.com/seiryu285/GrowthBase) (default branch `main`)

| Hosted role | Name / URL |
|-------------|------------|
| Vercel project | `growthbase-web` → [growthbase-web.vercel.app](https://growthbase-web.vercel.app/) |
| Railway live API | Project `growthbase`, service `growthbase`, production → `https://growthbase-production.up.railway.app` |

## What GrowthBase is

A TypeScript monorepo for **delegated agent commerce** on Base: policy, **x402** purchase flow, receipts, growth history, and **hash-level verification** for the flagship service `polymarket-hidden-edge-scan` (Hidden Edge scan artifact + proof).

In one sentence: GrowthBase lets a human delegate a paid task to an AI agent on Base, cross the x402 purchase boundary, and verify the delivery with receipts, proofs, and growth history.

## What is publicly verifiable now

| Surface | What a reviewer can check |
|--------|---------------------------|
| **Live API** | `GET /offers`, purchase spec, and (with a funded wallet) the live x402 loop on Railway. **Live** may return `503 PRE_PAYMENT_SERVICEABILITY_FAILED` when upstream market state is not serviceable — that is fail-closed behavior, not demo data. |
| **Verify (web)** | On Vercel, `/verify` loads **`GET /receipts/:receiptId/verify-bundle`** from the **live** API host by default, so linkage is verified against the **live** database. |
| **Evidence** | Repo-hosted JSON proof bundles under `data/proofs/*.latest.json` and append-only logs under `docs/agent-logs/`. See `/evidence` on the site for deep links to GitHub. |

## Canonical video proof

- **Canonical payment proof bundle:** `data/proofs/external-purchase-proof-railway-live-funded.latest.json`
- **Canonical transaction hash evidence:** `0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e`
- **Canonical explanation path:** `docs/external-purchase-proof.md`
- This is a **historical funded payment proof** on the public Railway host. Use it in the video to show payment acceptance and transaction-hash evidence.
- Do **not** present it as a successful live receipt-delivery proof: that run accepted payment but failed artifact generation on stale live Polymarket data.

## ReceiptAnchor trust layer

- The repo includes `contracts/ReceiptAnchor.sol`, and the API can optionally emit `ReceiptAnchored(receiptHash, policyHash, artifactHash, timestamp)` when `ANCHOR_PRIVATE_KEY` and `RECEIPT_ANCHOR_ADDRESS` are configured.
- Public reviewer visibility for the deployed contract is intended to live on `/evidence` via `NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS` and `NEXT_PUBLIC_RECEIPT_ANCHOR_EXPLORER_URL`.
- This layer is an **optional on-chain anchor** inside the trust stack. It does not replace the main `verify-bundle` reconstruction flow.

## Why Live, Demo, and Evidence are separated

- **Live** — `MARKET_DATA_MODE=live` on the production Railway service. Real upstream constraints apply; outcomes depend on market state and funding.
- **Demo** — A **guided reviewer path** on the web (`/demo`) over the **same** public live API base. It does not imply a second public Railway host or fixture-mode public API. Outcomes still follow live rules (including `503` when appropriate).
- **Evidence** — Archived CLI outputs and machine-readable bundles so claims stay **inspectable** without conflating tunnel/local runs with the hosted public API.

## Current limitations (do not misrepresent)

1. **Live funded “happy path” proof** — May be blocked by **pre-charge serviceability** (`503`) when the live book is stale; captured bundles document that outcome.
2. **Live variability** — Same endpoints can return different results as Polymarket state and funding change.
3. **Receipt verification scope** — A receipt exists on **one** API database. The default `/verify` UI targets the **live** API; verifying receipts from another base URL requires setting the verify-base env vars documented in the runbook.

## How a reviewer should navigate

1. Open [https://growthbase-web.vercel.app/](https://growthbase-web.vercel.app/) — global nav: **Live**, **Demo**, **Verify**, **Evidence**.
2. **Live** — quick links and notes for the public Railway API (`/offers`, purchase spec).
3. **Demo** — same live API, presented as a **walkthrough** for reviewers (honest about live constraints).
4. **Verify** — paste `receipt_…` for receipts on the live host (Vercel → live `verify-bundle` by default).
5. **Evidence** — proof JSON paths and agent logs on GitHub.

## Recommended short-video flow

1. Start at the home page with the one-sentence product explanation.
2. Show **Policy** and **Identity** as the AI-agent component.
3. Show **Live** for `/offers` and the purchase spec.
4. Show **Verify** for the hash-linked reconstruction surface.
5. End on **Evidence** for the canonical transaction-hash proof and the honest live limitation.

**Hosted configuration (human steps):** see [docs/runbook.md](./runbook.md) (Operator handoff).
