import { createDatabase, runMigrations } from "@growthbase/db";
import { reconstructTransaction } from "@growthbase/receipt";

import {
  agentAccount,
  createPaidFetch,
  discoverOffers,
  fetchGrowthHistory,
  fetchReceipt,
  getApiBaseUrl,
  purchaseHiddenEdgeScan
} from "./client";
import { renderTransactionSummary } from "./summary";

const input = {
  universe: "auto",
  sidePolicy: "BOTH",
  requestedNotionalUsd: 100,
  maxCandidates: 10,
  riskMode: "standard",
  maxBookAgeMs: 5000
};

async function main() {
  const apiBaseUrl = getApiBaseUrl();
  const paidFetch = await createPaidFetch();
  const offerCatalog = await discoverOffers(apiBaseUrl);
  const purchase = await purchaseHiddenEdgeScan(paidFetch, input, apiBaseUrl);
  const receipt = await fetchReceipt(purchase.receiptId, apiBaseUrl);
  const growthHistory = await fetchGrowthHistory(agentAccount.address, apiBaseUrl);

  const database = createDatabase(process.env.DATABASE_URL);
  await runMigrations(database);

  try {
    const reconstruction = await reconstructTransaction(database, purchase.receiptId);

    console.log(JSON.stringify({ discoveredOffers: offerCatalog.offers }, null, 2));
    console.log(JSON.stringify({ artifact: purchase.artifact, proof: purchase.proof, receipt }, null, 2));
    console.log(JSON.stringify({ growthHistory }, null, 2));
    console.log(renderTransactionSummary(reconstruction));
  } finally {
    database.close();
  }
}

await main();
