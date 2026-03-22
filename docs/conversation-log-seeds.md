# Conversation Log Seeds

## Human policy setup

- Create a `DelegationPolicy` for one delegated agent wallet.
- Limit the policy to `polymarket-hidden-edge-scan`.
- Set `maxPricePerCall` to at least `0.05` USDC and sign on Base.

## Agent discovery and purchase loop

- Discover the `polymarket-hidden-edge-scan` offer from `/offers`.
- Inspect the exact Hidden Edge input contract.
- Submit `POST /purchase/polymarket-hidden-edge-scan`.
- Receive `402 Payment Required`.
- Sign the x402 payment and retry the paid POST.
- Receive the full Hidden Edge artifact, proof, and `receiptId`.

## Verification loop

- Fetch `GET /receipts/:receiptId`.
- Reconstruct policy, request, normalized snapshot, artifact, proof, and receipt linkage.
- Verify request, snapshot, artifact, proof, and receipt hashes.
- Confirm growth history is derived from the stored receipt.

## Growth review loop

- Fetch `GET /agents/:agentWallet/growth-history`.
- Review the appended flagship-service purchase history.
- Inspect cheap summary fields such as candidate count and top action.
