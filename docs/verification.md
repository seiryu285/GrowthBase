# Verification

## Judge-facing summary

GrowthBase verifies the following closed loop:

1. human-signed delegation policy
2. offer discovery
3. x402 purchase boundary
4. typed artifact delivery
5. receipt creation
6. growth-history derivation
7. verification-ready reconstruction

## Verification status

- Closed loop status: **PASS**
- Flagship service: `polymarket-hidden-edge-scan`
- Verification mode: deterministic fixture verification for reproducibility
- Public-host proof status: Public live API host available at https://growthbase-production.up.railway.app . Deterministic verification is included in-repo. Concrete receipt and growth-history evidence are documented in this repository. A reviewer-facing live paid-proof reference will be linked here once finalized.
- Commit: 121a5656d5c74e8c5cd2ac733de20bb5750545bc

## Important note

For hackathon judging, deterministic verification is included to make the loop reproducible.
Public-host evidence should also be linked here once finalized.

---

## Detailed verification record

## 2. Verification scope

This verification confirms that the P0 closed loop works end-to-end:

1. Human creates/signs `DelegationPolicy`
2. Agent discovers `polymarket-hidden-edge-scan`
3. Agent purchases via x402
4. Hidden Edge Scan returns typed artifact
5. `CommerceReceipt` is written
6. `GrowthHistoryEntry` is derived
7. Verifier reconstructs the full transaction

This verification also confirms core failure paths:

- invalid policy signature
- expired policy
- disallowed service
- over-price request

---

## 3. Environment

### Machine / OS
- OS: Microsoft Windows 10.0.26200
- CPU: Intel64 Family 6 Model 183 Stepping 1, GenuineIntel
- Node version: `v24.12.0`
- pnpm version: `10.30.0`

### Runtime config
- API base URL: `http://localhost:3102`
- Web base URL: `http://localhost:3000`
- DB path: `./data/growthbase.sqlite`
- x402 mode: `local`
- Market data mode: `fixture`
- Env file used: `.env.example` values with runtime overrides for `MARKET_DATA_MODE=fixture`, `PORT=3102`, `API_BASE_URL=http://localhost:3102`, `AGENT_URI=http://localhost:3102/.well-known/agent-registration.json`

---

## 4. Setup commands executed

```bash
pnpm.cmd install --no-frozen-lockfile
pnpm.cmd db:migrate
pnpm.cmd test
pnpm.cmd test:unit
pnpm.cmd test:integration
```

Result
- All commands succeeded

Notes:
- `pnpm.cmd install --no-frozen-lockfile` required a rerun with `CI=true` because the first run aborted in no-TTY mode.
- `pnpm.cmd db:migrate` and test commands required unrestricted execution because `tsx`/`esbuild` child-process spawning was blocked inside the sandbox.

## 5. Long-running processes started

```bash
pnpm.cmd dev:api
pnpm.cmd dev:web
pnpm.cmd demo
pnpm --filter @growthbase/api exec tsx src/index.ts   # verification API on :3102 with MARKET_DATA_MODE=fixture
```

Result
- API started on `http://localhost:3001`
- Web started on `http://localhost:3000`
- Demo command started and executed
- Verification API started on `http://localhost:3102`

Notes:
- The default demo reused a deterministic policy nonce and replayed prior request state. Final runtime evidence below uses a fresh-nonce one-shot purchase against the fixture API on `3102`.
- While starting the web dev server, Next.js auto-added `noEmit: true` to `tsconfig.json`.

## 6. Canonical test identities

Human
- wallet: `0x0F41fa320D27F2B97B7a57424A9009Bfd9a8559F`
- identity ref: EOA signer only
- notes: typed-data signer for `DelegationPolicy`

Agent
- wallet: `0xa7Bcd671a7169A10bA761CD7e583CCe7BCD844b6`
- identity ref: `ERC-8004 / eip155:8453:0x9999999999999999999999999999999999999999 / 9001`
- notes: purchasing agent used in the successful fixture-mode purchase

Seller
- wallet: `0x1111111111111111111111111111111111111111`
- identity ref: `ERC-8004 / eip155:8453:0x2222222222222222222222222222222222222222 / 1`
- notes: seller wallet is the payment recipient; seller identity agent wallet exposed by the offer is `0x3333333333333333333333333333333333333333`

## 7. DelegationPolicy verification

Action

Describe how the policy was created and signed.

- Created with `createUnsignedDelegationPolicy(...)`
- Signed with the human EOA using EIP-712 typed data via `signTypedData`
- Attached with `attachDelegationSignature(...)`

Expected
- policy is created
- signature verifies
- policy status is ACTIVE

Observed
- policyId: `policy_b563b82261443e7c`
- policyHash: `0x52ed429dab7b9cde8395275dbe42f5295cfe47166082b73d05a1e00d738f0fca`
- signature: valid EIP-712 signature, verification result `true`
- status: `ACTIVE`
- screenshot / evidence: runtime reconstruction payload and `tests/unit/policy.test.ts`

Verdict
- PASS

Notes:
- Successful runtime purchase used nonce `verification-fixture-fresh-1774135538574`.

## 8. Offer discovery verification

Action

Describe how the agent discovered the offer.

- Queried `GET /offers` on `http://localhost:3102`

Expected

- `polymarket-hidden-edge-scan` appears in `/offers` and has correct metadata.

Observed
- serviceId: `polymarket-hidden-edge-scan`
- capabilityId: `hidden_edge_scan_polymarket`
- price: `50000`
- network: `eip155:8453`
- artifactType: `hidden_edge_scan_result`
- sellerWallet: `0x1111111111111111111111111111111111111111`
- screenshot / evidence: successful `GET http://localhost:3102/offers`

Verdict
- PASS

Notes:
- Seller identity URI resolved to `http://localhost:3102/.well-known/agent-registration.json`, confirming the verification API config was active.

## 9. Happy path end-to-end purchase verification

Input used
```json
{
  "policyId": "policy_b563b82261443e7c",
  "agentWallet": "0xa7Bcd671a7169A10bA761CD7e583CCe7BCD844b6",
  "input": {
    "universe": "auto",
    "sidePolicy": "BOTH",
    "requestedNotionalUsd": 100,
    "maxCandidates": 5,
    "riskMode": "standard",
    "maxBookAgeMs": 5000
  }
}
```

Expected
- x402 challenge is returned
- signed retry succeeds
- typed Hidden Edge artifact is returned
- receipt is written
- growth history is updated

Observed
- payment challenge received: yes
- payment retry succeeded: yes
- receiptId: `receipt_0985b563babf3a5a`
- receiptHash: `0xcd448fc115c1c4f35fb9ab40ed896c45030c4d7f90ed2d89d69c998eef8f8a53`
- requestHash: `0xec67ac65650c3f70e753d07681f1cab839b77db762077cb23289e899e21ecc03`
- artifactHash: `0x70e7a55cfd5b5da6bb66224956932ce2bdefbddc8f28db3ac793bb4b063b890e`
- snapshotHash: `0x07865eede80861d2d6f75c4e7f9fa56f1789bb4bec0d4234847cc32cf378c5b1`
- proofHash / proofRef: `0xfedfd59750d444fbca4140015b9a7322d0cc43f5756ad0b12b1c81446c57260a`
- deliveryStatus: `DELIVERED`
- screenshot / evidence: unpaid one-shot request returned `402` with `payment-required` header; paid one-shot request returned `200` and wrote the receipt above

Verdict
- PASS

Notes:
- The unpaid probe against `3102` returned `402` and a populated `payment-required` challenge header exactly as expected.

## 10. DeliveryArtifact verification

Expected

- Returned artifact preserves Hidden Edge structure.

Observed
- scanId: `9f65a0a4-da2d-5468-8b19-8f7baaf955cc`
- asOf: `2026-03-21T23:25:38.672Z`
- snapshotId: `07865eed-e808-51d2-86f7-5c4e7f9fa56f`
- engineVersion: `hidden-edge-engine/1`
- featureVersion: `hidden-edge-features/1`
- scoringVersion: `hidden-edge-score/1`
- marketsScanned: `2`
- marketsEligible: `1`
- candidatesReturned: `1`
- topCandidateAction: `ENTER_NOW`
- topCandidateScore: `168.88`
- topCandidateReasonCodes: `["EDGE_POSITIVE","BOOK_FRESH","SIZE_AVAILABLE","HISTORY_ANCHORED"]`
- raw artifact location: purchase response body and verifier reconstruction output

Checklist
- [x] scanId exists
- [x] snapshotId exists
- [x] candidates[] exists
- [x] artifact is typed JSON
- [x] artifact is service-specific, not flattened generic output

Verdict
- PASS

Notes:
- Top candidate was `market-election-a / YES`, giving the agent a concrete next action.

## 11. Proof verification

Expected

- Proof envelope contains required linkage fields.

Observed
- artifact_hash: `0x70e7a55cfd5b5da6bb66224956932ce2bdefbddc8f28db3ac793bb4b063b890e`
- snapshot_hash: `0x07865eede80861d2d6f75c4e7f9fa56f1789bb4bec0d4234847cc32cf378c5b1`
- snapshot_id: `07865eed-e808-51d2-86f7-5c4e7f9fa56f`
- request_hash: `0xec67ac65650c3f70e753d07681f1cab839b77db762077cb23289e899e21ecc03`
- engine_version: `hidden-edge-engine/1`
- feature_version: `hidden-edge-features/1`
- scoring_version: `hidden-edge-score/1`
- generated_at: `2026-03-21T23:25:38.672Z`
- artifact_kind: `hidden_edge_scan_result`

Checklist
- [x] all required proof fields exist
- [x] proof fields are internally consistent
- [x] hashes match receipt and artifact

Verdict
- PASS

Notes:
- Reconstruction verification reported `proofLinksValid: true`.

## 12. CommerceReceipt verification

Expected

- Receipt canonically links policy, payment, identities, and delivered artifact.

Observed
- receiptId: `receipt_0985b563babf3a5a`
- policyId: `policy_b563b82261443e7c`
- policyHash: `0x52ed429dab7b9cde8395275dbe42f5295cfe47166082b73d05a1e00d738f0fca`
- humanOwner: `0x0F41fa320D27F2B97B7a57424A9009Bfd9a8559F`
- buyerWallet: `0x425A8960A99C127fEB4d541b12E09352845797F8`
- agentWallet: `0xa7Bcd671a7169A10bA761CD7e583CCe7BCD844b6`
- sellerWallet: `0x1111111111111111111111111111111111111111`
- serviceId: `polymarket-hidden-edge-scan`
- paymentScheme: `exact`
- paymentNetwork: `eip155:8453`
- paymentResponse: `success=true`, `transaction=0x2297e6a23ac9b44ecdf087886fd92c5bba4b5f9250d20cd68c712d2c1af3f246`, `replayed=false`
- price: `50000`
- currency: `USDC`
- artifactHash: `0x70e7a55cfd5b5da6bb66224956932ce2bdefbddc8f28db3ac793bb4b063b890e`
- snapshotHash: `0x07865eede80861d2d6f75c4e7f9fa56f1789bb4bec0d4234847cc32cf378c5b1`
- proofHash / proofRef: `0xfedfd59750d444fbca4140015b9a7322d0cc43f5756ad0b12b1c81446c57260a`
- deliveryStatus: `DELIVERED`
- timestamp: `2026-03-21T23:25:38.677Z`
- receiptHash: `0xcd448fc115c1c4f35fb9ab40ed896c45030c4d7f90ed2d89d69c998eef8f8a53`

Checklist
- [x] append-only receipt written
- [x] all identity links present
- [x] payment and delivery are linked
- [x] artifact and snapshot hashes are linked
- [x] serviceId is correct

Verdict
- PASS

Notes:
- `GET /receipts/receipt_0985b563babf3a5a` returned the canonical receipt with all expected linkage fields.

## 13. GrowthHistory verification

Expected

- Growth history is derived from receipts and visible to the agent.

Observed
- agentWallet: `0xa7Bcd671a7169A10bA761CD7e583CCe7BCD844b6`
- history entry count: `5`
- latest receiptId: `receipt_0985b563babf3a5a`
- latest serviceId: `polymarket-hidden-edge-scan`
- latest artifactHash: `0x70e7a55cfd5b5da6bb66224956932ce2bdefbddc8f28db3ac793bb4b063b890e`
- latest deliveryStatus: `DELIVERED`
- latest timestamp: `2026-03-21T23:25:38.677Z`
- screenshot / evidence: `GET /agents/0xa7Bcd671a7169A10bA761CD7e583CCe7BCD844b6/growth-history`

Checklist
- [x] history entry exists for successful purchase
- [x] derived from receipt
- [x] visible through API or UI
- [x] readable by the agent

Verdict
- PASS

Notes:
- Latest growth entry shows `candidatesReturned: 1`, `topCandidateAction: ENTER_NOW`, `topCandidateScore: 168.88`.

## 14. Verifier reconstruction verification

Expected

- Verifier reconstructs the full commerce transaction end-to-end.

Observed
- policy visible: yes
- purchase summary visible: yes
- artifact summary visible: yes
- proof/hash linkage visible: yes
- growth history linkage visible: yes
- screenshot / evidence: `http://localhost:3000/verify?receiptId=receipt_0985b563babf3a5a` rendered `Fully verified`; runtime `reconstructTransaction(...)` also returned `fullyVerified: true`

Verdict
- PASS

Notes:
- This required fixing Next-compatible path resolution in `packages/db/src/client.ts` and `packages/db/src/migrate.ts`.

## 15. Negative path verification

### 15.1 Invalid signature
- Expected: tampered signature is rejected with `POLICY_INVALID`
- Observed: `tests/unit/policy.test.ts` mutated `maxPricePerCall`, `verifyDelegationPolicySignature(...)` returned `false`, and `assertDelegationPolicyValid(...)` rejected with `POLICY_INVALID`
- Verdict: [x] PASS [ ] FAIL

### 15.2 Expired policy
- Expected: expired policy is rejected with `POLICY_EXPIRED`
- Observed: `tests/unit/policy.test.ts` created an expired policy and `assertDelegationPolicyActive(...)` threw `GrowthBaseError`
- Verdict: [x] PASS [ ] FAIL

### 15.3 Disallowed service
- Expected: purchase fails with `SERVICE_NOT_ALLOWED`
- Observed: `tests/integration/purchase.test.ts` returned HTTP `403` with `error.code = "SERVICE_NOT_ALLOWED"`
- Verdict: [x] PASS [ ] FAIL

### 15.4 Over-price request
- Expected: purchase fails with `PRICE_EXCEEDS_POLICY`
- Observed: `tests/integration/purchase.test.ts` returned HTTP `403` with `error.code = "PRICE_EXCEEDS_POLICY"`
- Verdict: [x] PASS [ ] FAIL

## 16. Agent-value verification

Question

- Does the purchased service create meaningful value for the agent?

Evaluate
- [x] output is actionable
- [x] output is machine-readable
- [x] candidates contain interpretable reasons
- [x] artifact can influence next agent action
- [x] service is worth paying for in the GrowthBase loop

Notes

- The successful fixture-mode artifact returned one ranked candidate with `action = ENTER_NOW`, `hiddenEdgeBps = 150`, and explicit reason codes.
- The result is typed JSON, not free text, so an agent can branch on `action`, `reasonCodes`, `score`, and `maxSafeSizeUsd` directly.

## 17. Trust / growth verification

Question

- Does the transaction produce history that can become trust and growth?

Evaluate
- [x] payment becomes receipt
- [x] receipt becomes readable history
- [x] history is attributable to the agent
- [x] future trust/growth can be derived from this history

Notes

- The purchase wrote a canonical `CommerceReceipt`, then derived a `GrowthHistoryEntry` that preserved service attribution, delivery status, artifact linkage, and top-candidate summary.
- Because the verifier can reconstruct the same receipt/policy/request/artifact/proof chain, this is a reusable trust substrate rather than an opaque log line.

## 18. Final MVP exit decision

MVP exit criteria
- [x] Human can sign DelegationPolicy
- [x] Agent can discover flagship service
- [x] Agent can purchase flagship service via x402
- [x] Typed artifact is returned
- [x] CommerceReceipt is written
- [x] GrowthHistoryEntry is derived
- [x] Verifier reconstructs the transaction
- [x] Negative paths fail correctly
- [x] Service creates meaningful value for the agent
- [x] Receipt/history create a trust substrate

Final decision
- MVP COMPLETE

Remaining blockers
- blocker 1: none for local deterministic MVP verification
- blocker 2: live upstream Polymarket mode was not used for the final proof run
- blocker 3: the stock `demo` script reuses a fixed policy nonce, so fresh end-to-end verification is clearer with a one-shot custom purchase

Freeze decision
- Freeze MVP and move to GitHub/demo/submission
