# Agent Session Log - 2026-03-23 - Submission Evidence Closure (DB, Vercel entrypoint, proofs, failure verification)

> **Submission strategy (updated after this log):** Public submission is **single-host** — one Vercel site and one public Railway live API. The current honest reviewer overview is [`docs/SUBMISSION.md`](../SUBMISSION.md). The text below is an append-only historical session record. Later sections may reference `docs/railway-deterministic-demo.md` (since removed) or a second Railway service; treat those items as superseded by `docs/SUBMISSION.md` and the current runbook.

## Date/time

- Written: `2026-03-23` (local, JST)

## Objective

- Correct Railway/container `DATABASE_URL` behavior and persistence path.
- Provide a **canonical public web entrypoint** at [https://growthbase-web.vercel.app/](https://growthbase-web.vercel.app/) with explicit **Live** vs **Deterministic Demo** vs **Verify** navigation (no silent routing of live traffic to fixture).
- Capture post-deploy **live** proof (funded or documented pre-charge rejection).
- Document **persistent** deterministic-demo hosting (Railway second service).
- Verify **controlled** paid-after-settlement artifact failure → durable DB row (integration test).
- Append-only evidence: commands, paths, hashes, risks.

## Code / config changes (summary)

| Area | Change |
|------|--------|
| `packages/db/src/client.ts` | On non-Windows, map misconfigured Windows-style `DATABASE_URL` (e.g. `C:/Program Files/...`) to `/app/data/growthbase.sqlite`. |
| `railway.json` | `startCommand` prefixes `mkdir -p /app/data &&` before migrate + API start. |
| `apps/api/src/routes/receipts.ts` | `GET /receipts/:receiptId/verify-bundle` returns full `reconstructTransaction` JSON (for Vercel verify without local sqlite). |
| `apps/web` | New routes: `/demo`, `/live`, `/evidence`; layout nav; `lib/site.ts` for public URLs; `/verify` uses Live API on Vercel (`VERCEL` env) via verify-bundle. |
| `docs/railway-deterministic-demo.md` | How to add a **second** Railway service for `MARKET_DATA_MODE=fixture`. |
| `tests/unit/database-path.test.ts` | Regression tests for POSIX `DATABASE_URL` normalization. |
| `.env.example` | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_LIVE_API_BASE_URL`, optional demo + repo blob base. |
| `README.md`, `docs/runbook.md` | Canonical Vercel URL, Railway DB notes, link to deterministic demo doc. |

## Railway production (`growthbase` service)

### Variable set

```powershell
Set-Location "c:\Users\blued\Downloads\GrowthBase"
railway variable set DATABASE_URL=/app/data/growthbase.sqlite
```

### Paid-failure inspection (container)

```powershell
railway ssh "cd /app && pnpm exec tsx scripts/inspect-paid-failures.ts -- --limit 5"
```

Output (post-fix):

```json
{
  "database": "/app/data/growthbase.sqlite",
  "limit": 5,
  "count": 0,
  "failures": []
}
```

The DB path is now **`/app/data/growthbase.sqlite`** (no `/app/C:/Program Files/...`).

## Persistent deterministic-demo host

- **Not auto-created** in this session: `railway add --repo seiryu285/GrowthBase` failed with `repo not found` (likely private-repo token scope).
- **Documented** in [docs/railway-deterministic-demo.md](../railway-deterministic-demo.md): create a second Railway service, set `MARKET_DATA_MODE=fixture`, dedicated `DATABASE_URL`, then set Vercel `NEXT_PUBLIC_DETERMINISTIC_DEMO_API_BASE_URL`.
- Until that URL is set, `/demo` on Vercel shows configuration instructions (honest UX).

## Funded live proof (post-deploy)

```powershell
$env:PROOF_TARGET='live'
$env:API_BASE_URL='https://growthbase-production.up.railway.app'
$env:PROOF_LABEL='railway-live-submission-2026-03-23'
pnpm.cmd proof:external
```

Stdout summary:

```json
{
  "specStatus": 200,
  "unpaidStatus": 503,
  "paidStatus": 503,
  "receiptId": null
}
```

**Documented reason (precise):** both unpaid and paid POSTs return **`503 PRE_PAYMENT_SERVICEABILITY_FAILED`** — fail-closed **before** settlement. No transaction hash; no funded on-chain step in this run. **Not** a silent switch to fixture.

Evidence bundle: `data/proofs/external-purchase-proof-railway-live-submission-2026-03-23.latest.json`

## Deterministic public proof on persistent host

- **Pending** until `NEXT_PUBLIC_DETERMINISTIC_DEMO_API_BASE_URL` points at a deployed fixture service.
- Historical post-deploy bundle (ephemeral tunnel from earlier work) remains: `data/proofs/external-purchase-proof-public-fixture-postdeploy-2026-03-23.latest.json`

## Controlled paid-after-settlement failure (deploy-like harness)

Integration test (local Vitest harness, not Railway):

```powershell
pnpm.cmd vitest run tests/integration/purchase.test.ts -t "preserves verified payer evidence when artifact generation fails after settlement"
```

Result: **1 passed** — asserts `PAYMENT_ACCEPTED_ARTIFACT_FAILED`, durable `paid_artifact_failure_records` row, payer + `transactionHash` shape.

## Tests run

```powershell
pnpm.cmd vitest run tests/unit/database-path.test.ts
pnpm.cmd vitest run tests/integration/purchase.test.ts -t "preserves verified payer evidence when artifact generation fails after settlement"
```

```powershell
cd apps/web
pnpm.cmd exec next build
```

## Vercel (canonical project URL)

- **Canonical:** [https://growthbase-web.vercel.app/](https://growthbase-web.vercel.app/)
- **Live API** (for purchase / verify-bundle): `NEXT_PUBLIC_LIVE_API_BASE_URL` default `https://growthbase-production.up.railway.app`
- **Demo API:** set `NEXT_PUBLIC_DETERMINISTIC_DEMO_API_BASE_URL` after deploying fixture Railway service.
- **Verify:** `/verify` on Vercel loads `GET {LIVE_API}/receipts/:id/verify-bundle` (explicitly labeled as Live API in UI).

## Remaining risks

1. **Second Railway service** for deterministic demo must be created in the dashboard (or CLI with repo access); CLI repo attach failed here.
2. **Live funded proof** still blocked by **pre-charge serviceability** until market state is acceptable — document, do not fake receipts.
3. **Production** `inspect-paid-failures` count **0** — no paid-then-failed live events in DB at inspection time (expected if only pre-503 runs occurred).

## Next step

- Create Railway **growthbase-deterministic** (or similar) per [docs/railway-deterministic-demo.md](../railway-deterministic-demo.md), set Vercel env, re-run `PROOF_TARGET=deterministic-demo` against the persistent URL.
