# Hackathon Demo

This document is the shortest path for a judge to understand and verify GrowthBase.

## What to look at first

GrowthBase demonstrates one complete machine-readable commerce loop for agents:

1. a human signs a policy,
2. an agent discovers a paid service,
3. the agent purchases it through x402,
4. the service returns a typed artifact with proof,
5. GrowthBase writes a receipt,
6. GrowthBase derives growth history,
7. the transaction can be reconstructed later.

## Flagship service

- `polymarket-hidden-edge-scan`

This service reads public Polymarket data, builds a canonical normalized snapshot, ranks candidates deterministically, and returns a typed artifact with proof linkage.

## Public entrypoints

- Web: https://growthbase-web.vercel.app
- API: https://growthbase-production.up.railway.app

## Core endpoints

- `GET /offers`
- `POST /purchase/polymarket-hidden-edge-scan`
- `GET /receipts/:receiptId`
- `GET /agents/:agentWallet/growth-history`
- `GET /.well-known/agent-registration.json`

## What makes this different

GrowthBase is not only a service endpoint.

It also provides:

- delegated spending boundary,
- x402 purchase boundary,
- typed delivery contract,
- canonical receipt,
- growth-history derivation,
- verification surface.

## Fast evaluation checklist

A judge should be able to confirm:

- the offer exists,
- the purchase route is protected,
- the paid retry returns typed output,
- receipt linkage is present,
- growth history is derived,
- the transaction is reconstructable.

## Recommended review order

1. `README.md`
2. `docs/service-polymarket-hidden-edge-scan.md`
3. `docs/verification.md`
4. `docs/architecture.md`

## Evidence

See `docs/evidence/` for example payloads and proof-oriented material.
