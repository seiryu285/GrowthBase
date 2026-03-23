# GrowthBase

**GrowthBase** is a machine-readable x402 commerce and trust layer on Base for autonomous agents.

In this hackathon build, GrowthBase proves one complete loop:

1. a human signs a spending policy,
2. an agent discovers a paid service,
3. the agent purchases it through x402,
4. the service returns a typed artifact with proof,
5. GrowthBase writes a receipt and derives verifiable growth history.

The flagship paid service is:

- **`polymarket-hidden-edge-scan`**
  A read-only market intelligence service that scans public Polymarket data, builds a canonical normalized snapshot, ranks candidates deterministically, and returns a typed result with proof.

---

## Why this matters

Most agent systems can call tools, but they still lack a clean commercial boundary for:

- who authorized spending,
- what was purchased,
- what exactly was delivered,
- how to verify it later,
- how to turn successful transactions into durable trust and growth history.

GrowthBase turns one agent purchase into a verifiable machine-readable record.

---

## What this demo proves

This repository demonstrates an end-to-end agent commerce loop on Base:

- **Human authorization** through a signed `DelegationPolicy`
- **Agent discovery** through `/offers`
- **x402 purchase flow** through `POST /purchase/:serviceId`
- **Typed artifact delivery** from a real paid service
- **Canonical receipt generation**
- **Growth history derivation from receipts**
- **Verification surfaces** for reconstruction and inspection

This is not just a payment demo.
It is a **verifiable agent transaction substrate**.

---

## Flagship service: `polymarket-hidden-edge-scan`

### What it does

The service:

- reads public Polymarket market data,
- resolves a market universe selector,
- captures a canonical normalized snapshot,
- builds deterministic features,
- ranks candidate positions,
- returns a typed scan result with proof linkage.

It is:

- **read-only**
- **deterministic from the persisted snapshot**
- **machine-consumable**
- **verifiable after delivery**

It does **not** place trades.
It does **not** require Polymarket authentication.

### Why an agent would buy it

An agent buys this service to convert a bounded, human-authorized policy into a structured market scan containing:

- ranked candidates,
- side recommendations,
- fair-value ranges,
- edge estimates,
- sizing limits,
- expiration timestamps,
- proof-linked delivery metadata.

That makes it suitable as a first paid service because the output is inspectable, priced, and reconstructable.

---

## Public demo surfaces

### Web
- https://growthbase-web.vercel.app

### API
- https://growthbase-production.up.railway.app

### Key endpoints
- `GET /offers`
- `POST /purchase/polymarket-hidden-edge-scan`
- `GET /receipts/:receiptId`
- `GET /agents/:agentWallet/growth-history`
- `GET /.well-known/agent-registration.json`

---

## Demo flow

### 1. Discover the offer

```bash
curl https://growthbase-production.up.railway.app/offers
```

### 2. Purchase the flagship service

The purchase flow is x402-protected.

- first request → payment required
- paid retry → typed artifact + proof + receipt linkage

### 3. Verify the output

After a successful paid run, GrowthBase exposes:

- receipt data,
- proof-linked hashes,
- derived growth history,
- verifier reconstruction surfaces.

---

## Example artifact shape

```json
{
  "scanId": "scan_...",
  "asOf": "2026-03-23T00:00:00.000Z",
  "snapshotId": "snapshot_...",
  "engineVersion": "v1",
  "featureVersion": "v1",
  "scoringVersion": "v1",
  "marketsScanned": 120,
  "marketsEligible": 18,
  "candidates": [
    {
      "rank": 1,
      "marketId": "market_...",
      "recommendedSide": "YES",
      "marketProbability": 0.42,
      "fairValueLow": 0.46,
      "fairValueHigh": 0.49,
      "entryLevel": 0.43,
      "hiddenEdgeBps": 400,
      "safeSize": 25,
      "score": 0.91,
      "reasonCodes": ["MISPRICED", "LIQUID", "WITHIN_POLICY"],
      "action": "BUY",
      "expiresAt": "2026-03-23T00:10:00.000Z"
    }
  ]
}
```

---

## Why this is hackathon-relevant

GrowthBase is aimed at the next layer of onchain agent infrastructure:

- **machine-readable commerce**
- **verifiable service delivery**
- **bounded delegated spending**
- **receipt-backed trust**
- **growth history for agents**

In this submission, the focus is narrow on purpose:

- one real paid service,
- one clean commerce loop,
- one verifiable trust path.

That makes the system inspectable, testable, and extensible.

---

## Repository structure

```text
apps/
  api/
  web/
  agent-demo/
contracts/
docs/
packages/
  core/
  artifacts/
  db/
  growth/
  hidden-edge/
  identity/
  policy/
  receipt/
tests/
```

---

## Documentation

- `docs/hackathon-demo.md` — the exact judge flow
- `docs/verification.md` — verification status and evidence
- `docs/service-polymarket-hidden-edge-scan.md` — flagship service spec
- `docs/architecture.md` — system architecture and seams
- `docs/runbook.md` — local/operator runbook

---

## Local development

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev:api
pnpm dev:web
pnpm demo
pnpm test
pnpm test:unit
pnpm test:integration
```

---

## Verification status

This repo contains deterministic verification material and a full closed-loop architecture:

- signed policy
- offer discovery
- x402 purchase boundary
- typed artifact
- receipt creation
- growth-history derivation
- verifier reconstruction

See:

- `docs/hackathon-demo.md`
- `docs/verification.md`

---

## Vision

GrowthBase is building toward a future where agents do not just use tools — they **buy services, receive proof-linked results, accumulate verifiable history, and grow through durable machine-readable commerce**.
