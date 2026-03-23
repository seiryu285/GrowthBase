import {
  agentAccount,
  createPaidFetch,
  discoverOffers,
  fetchGrowthHistory,
  fetchReceipt,
  fetchVerifyBundle,
  getDemoInput,
  getApiBaseUrl,
  purchaseHiddenEdgeScan
} from "./client";
import { renderTransactionSummary } from "./summary";

async function main() {
  const apiBaseUrl = getApiBaseUrl();
  const input = getDemoInput();
  const paidFetch = await createPaidFetch();
  const offerCatalog = await discoverOffers(apiBaseUrl);
  const purchase = await purchaseHiddenEdgeScan(paidFetch, input, apiBaseUrl);
  const receipt = await fetchReceipt(purchase.receiptId, apiBaseUrl);
  const growthHistory = await fetchGrowthHistory(agentAccount.address, apiBaseUrl);
  const reconstruction = await fetchVerifyBundle(purchase.receiptId, apiBaseUrl);

  console.log(JSON.stringify({ apiBaseUrl, demoInput: input }, null, 2));
  console.log(JSON.stringify({ discoveredOffers: offerCatalog.offers }, null, 2));
  console.log(JSON.stringify({ artifact: purchase.artifact, proof: purchase.proof, receipt }, null, 2));
  console.log(JSON.stringify({ growthHistory }, null, 2));
  console.log(renderTransactionSummary(reconstruction));
}

await main();
