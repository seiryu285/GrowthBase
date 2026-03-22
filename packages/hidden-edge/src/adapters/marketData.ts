import type { HiddenEdgeScanInput, MarketSourceMode } from "@growthbase/core";

import type { RawMarketDescriptor } from "./marketDiscovery";

export type RawBookLevel = {
  price: number;
  size: number;
};

export type RawPriceHistoryPoint = {
  timestamp: string;
  price: number;
};

export type RawOrderBook = {
  tokenId: string;
  bids: RawBookLevel[];
  asks: RawBookLevel[];
  tickSize: number | null;
  observedAt: string;
  rawRefs: Record<string, unknown>;
};

export type RawMarketDataPayload = {
  marketId: string;
  eventId: string;
  yesTokenId: string;
  noTokenId: string;
  yesBook: RawOrderBook;
  noBook: RawOrderBook;
  yesHistory: RawPriceHistoryPoint[];
  noHistory: RawPriceHistoryPoint[];
  feeBps: number | null;
  tickSize: number | null;
  observedAt: string;
  rawRefs: Record<string, unknown>;
};

export type MarketDataResult = {
  observedAt: string;
  fetchedAt: string;
  records: RawMarketDataPayload[];
  degradedCount: number;
  sourceMode: MarketSourceMode;
  provenance: Record<string, unknown>;
};

export interface MarketDataAdapter {
  fetchMarketData(descriptors: RawMarketDescriptor[], input: HiddenEdgeScanInput): Promise<MarketDataResult>;
}
