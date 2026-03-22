import { GrowthBaseError, type HiddenEdgeScanInput } from "@growthbase/core";

import {
  type MarketDataAdapter,
  type MarketDataResult,
  type RawBookLevel,
  type RawMarketDataPayload,
  type RawOrderBook,
  type RawPriceHistoryPoint
} from "../marketData";
import type { RawMarketDescriptor } from "../marketDiscovery";

type FetchLike = typeof fetch;

type PolymarketDataOptions = {
  fetchImpl?: FetchLike;
  clobBaseUrl?: string;
  fetchTimeoutMs?: number;
  maxBookAgeMs?: number;
  failClosed?: boolean;
  now?: () => Date;
};

type BookResponse = {
  market?: string;
  asset_id?: string;
  token_id?: string;
  timestamp?: string | number;
  tick_size?: string | number;
  bids?: Array<{ price: string | number; size: string | number }>;
  asks?: Array<{ price: string | number; size: string | number }>;
};

type PriceHistoryPoint = {
  t?: number | string;
  p?: number | string;
  price?: number | string;
  timestamp?: number | string;
};

type PriceHistoryResponse = PriceHistoryPoint[] | { history?: PriceHistoryPoint[] };

const DEFAULT_CLOB_BASE_URL = "https://clob.polymarket.com";
const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

export function createPolymarketDataAdapter(options: PolymarketDataOptions = {}): MarketDataAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const clobBaseUrl = options.clobBaseUrl ?? DEFAULT_CLOB_BASE_URL;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const failClosed = options.failClosed ?? false;
  const now = options.now ?? (() => new Date());

  return {
    async fetchMarketData(descriptors: RawMarketDescriptor[], input: HiddenEdgeScanInput): Promise<MarketDataResult> {
      const fetchedAt = now().toISOString();
      const allowedBookAgeMs = Math.min(options.maxBookAgeMs ?? input.maxBookAgeMs, input.maxBookAgeMs);
      const records: RawMarketDataPayload[] = [];
      let degradedCount = 0;

      if (descriptors.length === 0 && failClosed) {
        throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket market-data fetch received no markets.", 502, {
          sourceMode: "live"
        });
      }

      for (const descriptor of descriptors) {
        try {
          const [yesBook, noBook, yesHistory, noHistory] = await Promise.all([
            fetchBook(fetchImpl, clobBaseUrl, descriptor.yesTokenId, fetchedAt, fetchTimeoutMs),
            fetchBook(fetchImpl, clobBaseUrl, descriptor.noTokenId, fetchedAt, fetchTimeoutMs),
            fetchPriceHistory(fetchImpl, clobBaseUrl, descriptor.yesTokenId, fetchTimeoutMs),
            fetchPriceHistory(fetchImpl, clobBaseUrl, descriptor.noTokenId, fetchTimeoutMs)
          ]);

          assertBookComplete(descriptor, yesBook, "YES");
          assertBookComplete(descriptor, noBook, "NO");
          assertBookFresh(descriptor, yesBook, now(), allowedBookAgeMs, "YES");
          assertBookFresh(descriptor, noBook, now(), allowedBookAgeMs, "NO");

          records.push({
            marketId: descriptor.marketId,
            eventId: descriptor.eventId,
            yesTokenId: descriptor.yesTokenId,
            noTokenId: descriptor.noTokenId,
            yesBook,
            noBook,
            yesHistory,
            noHistory,
            feeBps: descriptor.feeBps,
            tickSize: descriptor.tickSize ?? yesBook.tickSize ?? noBook.tickSize,
            observedAt: latestTimestamp([yesBook.observedAt, noBook.observedAt, fetchedAt]),
            rawRefs: {
              ...descriptor.rawRefs,
              yesBookAsset: descriptor.yesTokenId,
              noBookAsset: descriptor.noTokenId
            }
          });
        } catch (error) {
          if (failClosed) {
            if (error instanceof GrowthBaseError) {
              throw error;
            }

            throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket market-data fetch failed.", 502, {
              sourceMode: "live",
              marketId: descriptor.marketId,
              marketSlug: descriptor.marketSlug,
              cause: error instanceof Error ? error.message : "Unknown market-data failure."
            });
          }

          degradedCount += 1;
        }
      }

      const observedAt = latestTimestamp(records.map((record) => record.observedAt).concat(fetchedAt));

      if (failClosed && records.length !== descriptors.length) {
        throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket market-data fetch returned incomplete coverage.", 502, {
          sourceMode: "live",
          expectedRecordCount: descriptors.length,
          actualRecordCount: records.length
        });
      }

      return {
        observedAt,
        fetchedAt,
        records,
        degradedCount,
        sourceMode: "live",
        provenance: {
          source: "polymarket-clob",
          clobBaseUrl,
          fetchTimeoutMs,
          allowedBookAgeMs,
          recordCount: records.length
        }
      };
    }
  };
}

async function fetchBook(
  fetchImpl: FetchLike,
  clobBaseUrl: string,
  tokenId: string,
  fallbackObservedAt: string,
  timeoutMs: number
): Promise<RawOrderBook> {
  const response = await fetchJson<BookResponse>(
    fetchImpl,
    `${clobBaseUrl}/book?token_id=${encodeURIComponent(tokenId)}`,
    timeoutMs,
    "order-book"
  );

  return {
    tokenId,
    bids: normalizeBookLevels(response.bids),
    asks: normalizeBookLevels(response.asks),
    tickSize: toNumber(response.tick_size),
    observedAt: normalizeTimestamp(response.timestamp) ?? fallbackObservedAt,
    rawRefs: {
      source: "polymarket-clob-book",
      tokenId,
      market: response.market ?? null
    }
  };
}

async function fetchPriceHistory(
  fetchImpl: FetchLike,
  clobBaseUrl: string,
  tokenId: string,
  timeoutMs: number
): Promise<RawPriceHistoryPoint[]> {
  const payload = await fetchJson<PriceHistoryResponse>(
    fetchImpl,
    `${clobBaseUrl}/prices-history?market=${encodeURIComponent(tokenId)}&interval=1d&fidelity=60`,
    timeoutMs,
    "price-history"
  );
  const history = Array.isArray(payload) ? payload : payload.history ?? [];

  return history
    .map((point) => ({
      timestamp: normalizeTimestamp(point.timestamp ?? point.t) ?? new Date(0).toISOString(),
      price: toNumber(point.price ?? point.p) ?? 0
    }))
    .filter((point) => point.price >= 0 && point.price <= 1);
}

function assertBookComplete(descriptor: RawMarketDescriptor, book: RawOrderBook, side: "YES" | "NO") {
  if (book.bids.length > 0 && book.asks.length > 0) {
    return;
  }

  throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket order book is missing best quotes.", 502, {
    sourceMode: "live",
    marketId: descriptor.marketId,
    marketSlug: descriptor.marketSlug,
    side,
    tokenId: book.tokenId
  });
}

function assertBookFresh(
  descriptor: RawMarketDescriptor,
  book: RawOrderBook,
  now: Date,
  allowedBookAgeMs: number,
  side: "YES" | "NO"
) {
  const observedAt = new Date(book.observedAt);
  const ageMs = Math.max(0, now.getTime() - observedAt.getTime());

  if (ageMs <= allowedBookAgeMs) {
    return;
  }

  throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket order book is stale.", 502, {
    sourceMode: "live",
    marketId: descriptor.marketId,
    marketSlug: descriptor.marketSlug,
    side,
    tokenId: book.tokenId,
    observedAt: book.observedAt,
    ageMs,
    allowedBookAgeMs
  });
}

function normalizeBookLevels(levels: Array<{ price: string | number; size: string | number }> | undefined): RawBookLevel[] {
  return (levels ?? [])
    .map((level) => ({
      price: toNumber(level.price) ?? 0,
      size: toNumber(level.size) ?? 0
    }))
    .filter((level) => level.price >= 0 && level.price <= 1 && level.size >= 0);
}

function latestTimestamp(values: string[]): string {
  return values
    .map((value) => new Date(value))
    .sort((left, right) => right.getTime() - left.getTime())[0]
    .toISOString();
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.includes("T")) {
    return value;
  }

  const numeric = toNumber(value);

  if (numeric == null) {
    return null;
  }

  const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  return new Date(millis).toISOString();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function fetchJson<T>(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Polymarket ${operation} request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Polymarket ${operation} timed out after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
