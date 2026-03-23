import type { HiddenEdgeScanInput } from "@growthbase/core";
import type {
  MarketDataAdapter,
  MarketDiscoveryAdapter,
  RawMarketDescriptor,
  RawOrderBook,
  RawPriceHistoryPoint
} from "@growthbase/hidden-edge";

const FIXTURE_DESCRIPTORS: RawMarketDescriptor[] = [
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
];

export function createFixtureMarketDiscoveryAdapter(now: () => Date = () => new Date()): MarketDiscoveryAdapter {

  return {
    async discover(input: HiddenEdgeScanInput) {
      const observedAt = now().toISOString();

      return {
        selector:
          input.universe === "auto"
            ? { kind: "auto", raw: "auto" as const }
            : input.universe.startsWith("search:")
              ? { kind: "search", raw: input.universe, query: input.universe.slice("search:".length) }
              : { kind: "tag", raw: input.universe, value: input.universe.slice("tag:".length) },
        discoveredAt: observedAt,
        degradedCount: 0,
        descriptors: FIXTURE_DESCRIPTORS,
        sourceMode: "fixture",
        provenance: {
          source: "fixture",
          selector: input.universe,
          descriptorCount: FIXTURE_DESCRIPTORS.length
        }
      };
    }
  };
}

export function createFixtureMarketDataAdapter(now: () => Date = () => new Date()): MarketDataAdapter {

  return {
    async fetchMarketData(descriptors) {
      const observedAt = now().toISOString();

      return {
        observedAt,
        fetchedAt: observedAt,
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
              ? createBook(descriptor.yesTokenId, 0.56, 200, 0.58, 180, observedAt)
              : createBook(descriptor.yesTokenId, 0.45, 60, 0.49, 50, observedAt),
          noBook:
            index === 0
              ? createBook(descriptor.noTokenId, 0.41, 190, 0.43, 170, observedAt)
              : createBook(descriptor.noTokenId, 0.52, 55, 0.56, 45, observedAt),
          yesHistory: index === 0 ? createHistory(0.62) : createHistory(0.47),
          noHistory: index === 0 ? createHistory(0.38) : createHistory(0.53),
          feeBps: descriptor.feeBps,
          tickSize: descriptor.tickSize,
          observedAt,
          rawRefs: {
            source: "fixture",
            marketId: descriptor.marketId
          }
        }))
      };
    }
  };
}

function createBook(
  tokenId: string,
  bidPrice: number,
  bidSize: number,
  askPrice: number,
  askSize: number,
  observedAt: string
): RawOrderBook {
  return {
    tokenId,
    bids: [{ price: bidPrice, size: bidSize }],
    asks: [{ price: askPrice, size: askSize }],
    tickSize: 0.01,
    observedAt,
    rawRefs: {
      source: "fixture-book",
      tokenId
    }
  };
}

function createHistory(anchor: number): RawPriceHistoryPoint[] {
  return [
    { timestamp: "2026-03-20T21:00:00.000Z", price: anchor - 0.01 },
    { timestamp: "2026-03-20T22:00:00.000Z", price: anchor },
    { timestamp: "2026-03-20T23:00:00.000Z", price: anchor + 0.01 }
  ];
}
