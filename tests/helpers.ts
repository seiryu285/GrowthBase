import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

import {
  SCHEMA_VERSION,
  SERVICE_ID,
  type AgentIdentityRef,
  type HiddenEdgeScanInput,
  type PersistedNormalizedSnapshot
} from "@growthbase/core";
import { createInMemoryDatabase } from "@growthbase/db";
import {
  PolymarketSnapshotNormalizer,
  createHiddenEdgeServiceAdapter,
  type MarketDataAdapter,
  type MarketDiscoveryAdapter
} from "@growthbase/hidden-edge";
import {
  attachDelegationSignature,
  createUnsignedDelegationPolicy,
  delegationPolicyTypedData,
  getDelegationPolicyDomain,
  getDelegationPolicyMessage
} from "@growthbase/policy";

import { createApp } from "../apps/api/src/app";
import type { ApiEnv } from "../apps/api/src/env";
import { createSellerIdentity } from "../apps/api/src/services/profile";

export const humanAccount = privateKeyToAccount("0x59c6995e998f97a5a0044966f094538c5f8fb9d5392b6f0dff78eaef918a1960");
export const agentAccount = privateKeyToAccount("0x8b3a350cf5c34c9194ca4e293f4b25d1ce058c6b05c9010d6ea3dcb3ce1f4b54");
export const spenderAccount = privateKeyToAccount("0x0dbbe8f4f4b9b7cbdeb18f0bc33bd583a14bc58c41cab36161f245d36b2b1f7f");

export type FixtureTracker = {
  discoveryCalls: number;
  marketDataCalls: number;
};

const FIXTURE_NOW = "2026-03-21T00:00:00.000Z";

export function createTestEnv(): ApiEnv {
  return {
    databaseUrl: ":memory:",
    port: 3001,
    x402Mode: "local",
    marketDataMode: "fixture",
    polymarketGammaBaseUrl: "https://gamma-api.polymarket.com",
    polymarketClobBaseUrl: "https://clob.polymarket.com",
    polymarketEventSlugs: [],
    polymarketMarketSlugs: [],
    polymarketFetchTimeoutMs: 8000,
    polymarketMaxBookAgeMs: 5000,
    x402Network: "eip155:8453",
    x402PriceAtomic: "50000",
    x402PayTo: "0x1111111111111111111111111111111111111111",
    x402FacilitatorUrl: "https://x402.org/facilitator",
    agentRegistry: "eip155:8453:0x2222222222222222222222222222222222222222",
    agentId: "1",
    agentUri: "http://growthbase.test/.well-known/agent-registration.json",
    agentWallet: "0x3333333333333333333333333333333333333333",
    sellerWallet: "0x1111111111111111111111111111111111111111",
    sellerImage: "https://placehold.co/600x600/png",
    apiBaseUrl: "http://growthbase.test"
  };
}

export function createTestAgentIdentity(): AgentIdentityRef {
  return {
    standard: "ERC-8004",
    agentRegistry: "eip155:8453:0x9999999999999999999999999999999999999999",
    agentId: "9001",
    agentURI: "https://demo.growthbase.local/agent.json",
    agentWallet: agentAccount.address,
    schemaVersion: SCHEMA_VERSION
  };
}

export async function createSignedPolicy(overrides?: Partial<ReturnType<typeof createUnsignedDelegationPolicy>>) {
  const policyNow = new Date();
  const unsigned = createUnsignedDelegationPolicy({
    chainId: 8453,
    humanOwner: humanAccount.address,
    agentWallet: agentAccount.address,
    spenderWallet: spenderAccount.address,
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    maxTotalSpend: "1.00",
    maxPricePerCall: "0.05",
    validFrom: new Date(policyNow.getTime() - 60 * 1000).toISOString(),
    validUntil: new Date(policyNow.getTime() + 60 * 60 * 1000).toISOString(),
    allowedServices: [SERVICE_ID],
    nonce: "test-policy-1",
    ...overrides
  });

  const signature = await humanAccount.signTypedData({
    domain: getDelegationPolicyDomain(unsigned.chainId),
    types: delegationPolicyTypedData,
    primaryType: "DelegationPolicy",
    message: getDelegationPolicyMessage(unsigned)
  });

  return attachDelegationSignature(unsigned, signature);
}

export function createHiddenEdgeInput(overrides?: Partial<HiddenEdgeScanInput>): HiddenEdgeScanInput {
  return {
    universe: "auto",
    sidePolicy: "BOTH",
    requestedNotionalUsd: 100,
    maxCandidates: 10,
    riskMode: "standard",
    maxBookAgeMs: 5000,
    ...overrides
  };
}

export async function createTestHarness() {
  const database = createInMemoryDatabase();
  const env = createTestEnv();
  const tracker: FixtureTracker = {
    discoveryCalls: 0,
    marketDataCalls: 0
  };
  const serviceAdapter = createHiddenEdgeServiceAdapter({
    sellerWallet: env.sellerWallet,
    sellerIdentity: createSellerIdentity(env),
    marketDiscovery: createFixtureMarketDiscoveryAdapter(tracker),
    marketData: createFixtureMarketDataAdapter(tracker),
    snapshotNormalizer: new PolymarketSnapshotNormalizer(),
    now: () => new Date(FIXTURE_NOW)
  });
  const { app, deps } = await createApp({ env, database, serviceAdapter });

  const appFetch: typeof fetch = async (input, init) => {
    if (input instanceof Request) {
      return app.request(input, init);
    }

    return app.request(input instanceof URL ? input.toString() : input, init);
  };

  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: spenderAccount,
    networks: [env.x402Network]
  });

  const paidFetch = wrapFetchWithPayment(appFetch, client);

  return {
    app,
    deps,
    tracker,
    database,
    env,
    paidFetch,
    close: () => database.close()
  };
}

function createFixtureMarketDiscoveryAdapter(tracker: FixtureTracker): MarketDiscoveryAdapter {
  return {
    async discover(input) {
      tracker.discoveryCalls += 1;

      return {
        selector:
          input.universe === "auto"
            ? { kind: "auto", raw: "auto" as const }
            : input.universe.startsWith("search:")
              ? { kind: "search", raw: input.universe, query: input.universe.slice("search:".length) }
              : { kind: "tag", raw: input.universe, value: input.universe.slice("tag:".length) },
        discoveredAt: FIXTURE_NOW,
        degradedCount: 0,
        sourceMode: "fixture",
        provenance: {
          source: "fixture",
          selector: input.universe,
          descriptorCount: 2
        },
        descriptors: [
          {
            eventId: "event-election",
            eventTitle: "Will Candidate A win?",
            marketId: "market-election-a",
            marketSlug: "candidate-a-win",
            yesTokenId: "yes-election-a",
            noTokenId: "no-election-a",
            active: true,
            closed: false,
            feeBps: 20,
            tickSize: 0.01,
            rawRefs: {
              source: "fixture",
              eventId: "event-election",
              marketId: "market-election-a"
            }
          },
          {
            eventId: "event-sports",
            eventTitle: "Will Team B make the playoffs?",
            marketId: "market-sports-b",
            marketSlug: "team-b-playoffs",
            yesTokenId: "yes-sports-b",
            noTokenId: "no-sports-b",
            active: true,
            closed: false,
            feeBps: 25,
            tickSize: 0.01,
            rawRefs: {
              source: "fixture",
              eventId: "event-sports",
              marketId: "market-sports-b"
            }
          }
        ]
      };
    }
  };
}

function createFixtureMarketDataAdapter(tracker: FixtureTracker): MarketDataAdapter {
  return {
    async fetchMarketData(descriptors) {
      tracker.marketDataCalls += 1;

      return {
        observedAt: FIXTURE_NOW,
        fetchedAt: FIXTURE_NOW,
        degradedCount: 0,
        sourceMode: "fixture",
        provenance: {
          source: "fixture",
          recordCount: descriptors.length
        },
        records: descriptors.map((descriptor, index) => ({
          marketId: descriptor.marketId,
          eventId: descriptor.eventId,
          yesTokenId: descriptor.yesTokenId,
          noTokenId: descriptor.noTokenId,
          yesBook:
            index === 0
              ? createBook(descriptor.yesTokenId, 0.56, 200, 0.58, 180)
              : createBook(descriptor.yesTokenId, 0.45, 60, 0.49, 50),
          noBook:
            index === 0
              ? createBook(descriptor.noTokenId, 0.41, 190, 0.43, 170)
              : createBook(descriptor.noTokenId, 0.52, 55, 0.56, 45),
          yesHistory: index === 0 ? createHistory(0.62) : createHistory(0.47),
          noHistory: index === 0 ? createHistory(0.38) : createHistory(0.53),
          feeBps: descriptor.feeBps,
          tickSize: descriptor.tickSize,
          observedAt: FIXTURE_NOW,
          rawRefs: {
            source: "fixture",
            marketId: descriptor.marketId
          }
        }))
      };
    }
  };
}

function createBook(tokenId: string, bidPrice: number, bidSize: number, askPrice: number, askSize: number) {
  return {
    tokenId,
    bids: [{ price: bidPrice, size: bidSize }],
    asks: [{ price: askPrice, size: askSize }],
    tickSize: 0.01,
    observedAt: FIXTURE_NOW,
    rawRefs: {
      source: "fixture-book",
      tokenId
    }
  };
}

function createHistory(anchor: number) {
  return [
    { timestamp: "2026-03-20T21:00:00.000Z", price: anchor - 0.01 },
    { timestamp: "2026-03-20T22:00:00.000Z", price: anchor },
    { timestamp: "2026-03-20T23:00:00.000Z", price: anchor + 0.01 }
  ];
}

export function createSampleNormalizedSnapshot(): PersistedNormalizedSnapshot {
  return {
    snapshotId: "11111111-2222-5333-8444-555555555555",
    asOf: FIXTURE_NOW,
    requestHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    universe: "auto",
    markets: [
      {
        snapshotId: "11111111-2222-5333-8444-555555555555",
        marketId: "market-election-a",
        eventId: "event-election",
        marketSlug: "candidate-a-win",
        eventTitle: "Will Candidate A win?",
        yesTokenId: "yes-election-a",
        noTokenId: "no-election-a",
        bestYesBid: 0.56,
        bestYesBidSize: 200,
        bestYesAsk: 0.58,
        bestYesAskSize: 180,
        bestNoBid: 0.41,
        bestNoBidSize: 190,
        bestNoAsk: 0.43,
        bestNoAskSize: 170,
        midProbYes: 0.57,
        midProbNo: 0.42,
        historyMeanYes: 0.62,
        historyMeanNo: 0.38,
        feeBps: 20,
        tickSize: 0.01,
        observedAt: FIXTURE_NOW,
        rawRefs: {
          source: "fixture"
        }
      }
    ],
    schemaVersion: SCHEMA_VERSION
  };
}
