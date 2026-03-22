import { GrowthBaseError, type HiddenEdgeScanInput } from "@growthbase/core";

import {
  resolveUniverseSelector,
  type MarketDiscoveryAdapter,
  type MarketDiscoveryResult,
  type RawMarketDescriptor
} from "../marketDiscovery";

type FetchLike = typeof fetch;

type PolymarketDiscoveryOptions = {
  fetchImpl?: FetchLike;
  gammaBaseUrl?: string;
  pageSize?: number;
  maxPages?: number;
  fetchTimeoutMs?: number;
  eventSlugs?: string[];
  marketSlugs?: string[];
  failClosed?: boolean;
  now?: () => Date;
};

type GammaEvent = {
  id?: string | number;
  slug?: string;
  title?: string;
  active?: boolean;
  closed?: boolean;
  markets?: GammaMarket[];
};

type GammaMarket = {
  id?: string | number;
  slug?: string;
  question?: string;
  title?: string;
  active?: boolean;
  closed?: boolean;
  feeBps?: number | string | null;
  tickSize?: number | string | null;
  yesTokenId?: string;
  noTokenId?: string;
  clobTokenIds?: string[] | string;
  tokenIds?: string[] | string;
  tokens?: Array<Record<string, unknown>>;
  outcomes?: string[] | string;
  event?: GammaEvent | null;
  events?: GammaEvent[] | null;
};

type SearchResponse = {
  events?: GammaEvent[];
  markets?: GammaMarket[];
  data?: Array<Record<string, unknown>>;
};

const DEFAULT_GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

export function createPolymarketDiscoveryAdapter(options: PolymarketDiscoveryOptions = {}): MarketDiscoveryAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const gammaBaseUrl = options.gammaBaseUrl ?? DEFAULT_GAMMA_BASE_URL;
  const pageSize = options.pageSize ?? 50;
  const maxPages = options.maxPages ?? 5;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const eventSlugs = dedupeStrings(options.eventSlugs ?? []);
  const marketSlugs = dedupeStrings(options.marketSlugs ?? []);
  const failClosed = options.failClosed ?? false;
  const now = options.now ?? (() => new Date());

  return {
    async discover(input: HiddenEdgeScanInput): Promise<MarketDiscoveryResult> {
      const selector = resolveUniverseSelector(input.universe);
      const discoveredAt = now().toISOString();

      try {
        if (selector.kind === "search") {
          const search = await fetchJson<SearchResponse>(
            fetchImpl,
            `${gammaBaseUrl}/public-search?query=${encodeURIComponent(selector.query)}`,
            fetchTimeoutMs,
            "search"
          );
          return finalizeResult({
            selector,
            discoveredAt,
            descriptors: collectDescriptorsFromSearch(search),
            degradedCount: 0,
            provenance: {
              source: "polymarket-gamma",
              gammaBaseUrl,
              selector: selector.raw,
              fetchTimeoutMs,
              configuredEventSlugs: eventSlugs,
              configuredMarketSlugs: marketSlugs,
              strategy: "search"
            },
            failClosed
          });
        }

        if (selector.kind === "auto" && (eventSlugs.length > 0 || marketSlugs.length > 0)) {
          const configured = await discoverConfiguredSlugs({
            fetchImpl,
            gammaBaseUrl,
            fetchTimeoutMs,
            eventSlugs,
            marketSlugs,
            failClosed
          });

          return finalizeResult({
            selector,
            discoveredAt,
            descriptors: configured.descriptors,
            degradedCount: configured.degradedCount,
            provenance: {
              source: "polymarket-gamma",
              gammaBaseUrl,
              selector: selector.raw,
              fetchTimeoutMs,
              configuredEventSlugs: eventSlugs,
              configuredMarketSlugs: marketSlugs,
              strategy: "configured-slugs"
            },
            failClosed
          });
        }

        const activeEvents = await listActiveEvents(fetchImpl, gammaBaseUrl, pageSize, maxPages, fetchTimeoutMs);

        if (selector.kind === "auto") {
          return finalizeResult({
            selector,
            discoveredAt,
            descriptors: flattenActiveEvents(activeEvents),
            degradedCount: 0,
            provenance: {
              source: "polymarket-gamma",
              gammaBaseUrl,
              selector: selector.raw,
              fetchTimeoutMs,
              pageSize,
              maxPages,
              strategy: "active-events"
            },
            failClosed
          });
        }

        const tagResults = await Promise.allSettled(
          activeEvents.map(async (event) => ({
            event,
            tags: await fetchJson<Array<{ id?: string | number; slug?: string | null }>>(
              fetchImpl,
              `${gammaBaseUrl}/events/${String(event.id)}/tags`,
              fetchTimeoutMs,
              "event-tags"
            )
          }))
        );

        let degradedCount = 0;
        const matchedEvents: GammaEvent[] = [];

        for (const result of tagResults) {
          if (result.status !== "fulfilled") {
            degradedCount += 1;
            continue;
          }

          const isMatch = result.value.tags.some((tag) => {
            const tagId = tag.id == null ? "" : String(tag.id);
            const tagSlug = tag.slug ?? "";
            return tagId === selector.value || tagSlug === selector.value;
          });

          if (isMatch) {
            matchedEvents.push(result.value.event);
          }
        }

        if (failClosed && degradedCount > 0) {
          throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket tag discovery returned partial results.", 502, {
            sourceMode: "live",
            selector: selector.raw,
            degradedCount
          });
        }

        return finalizeResult({
          selector,
          discoveredAt,
          descriptors: flattenActiveEvents(matchedEvents),
          degradedCount,
          provenance: {
            source: "polymarket-gamma",
            gammaBaseUrl,
            selector: selector.raw,
            fetchTimeoutMs,
            pageSize,
            maxPages,
            strategy: "tag-filter"
          },
          failClosed
        });
      } catch (error) {
        if (error instanceof GrowthBaseError) {
          throw error;
        }

        if (!failClosed) {
          throw error;
        }

        throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket discovery failed.", 502, {
          sourceMode: "live",
          selector: selector.raw,
          cause: error instanceof Error ? error.message : "Unknown discovery failure."
        });
      }
    }
  };
}

async function discoverConfiguredSlugs(args: {
  fetchImpl: FetchLike;
  gammaBaseUrl: string;
  fetchTimeoutMs: number;
  eventSlugs: string[];
  marketSlugs: string[];
  failClosed: boolean;
}) {
  const eventDescriptors: RawMarketDescriptor[] = [];
  const marketDescriptors: RawMarketDescriptor[] = [];
  let degradedCount = 0;

  for (const slug of args.eventSlugs) {
    try {
      const events = await fetchJson<GammaEvent[]>(
        args.fetchImpl,
        `${args.gammaBaseUrl}/events?slug=${encodeURIComponent(slug)}`,
        args.fetchTimeoutMs,
        "event-slug"
      );
      eventDescriptors.push(...flattenActiveEvents(events));
    } catch (error) {
      if (args.failClosed) {
        throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Configured Polymarket event slug lookup failed.", 502, {
          sourceMode: "live",
          eventSlug: slug,
          cause: error instanceof Error ? error.message : "Unknown event lookup failure."
        });
      }

      degradedCount += 1;
    }
  }

  for (const slug of args.marketSlugs) {
    try {
      const markets = await fetchJson<GammaMarket[]>(
        args.fetchImpl,
        `${args.gammaBaseUrl}/markets?slug=${encodeURIComponent(slug)}`,
        args.fetchTimeoutMs,
        "market-slug"
      );
      marketDescriptors.push(...collectDescriptorsFromMarkets(markets));
    } catch (error) {
      if (args.failClosed) {
        throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Configured Polymarket market slug lookup failed.", 502, {
          sourceMode: "live",
          marketSlug: slug,
          cause: error instanceof Error ? error.message : "Unknown market lookup failure."
        });
      }

      degradedCount += 1;
    }
  }

  return {
    descriptors: dedupeDescriptors([...eventDescriptors, ...marketDescriptors]),
    degradedCount
  };
}

async function listActiveEvents(
  fetchImpl: FetchLike,
  gammaBaseUrl: string,
  pageSize: number,
  maxPages: number,
  fetchTimeoutMs: number
) {
  const events: GammaEvent[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const response = await fetchJson<GammaEvent[]>(
      fetchImpl,
      `${gammaBaseUrl}/events?active=true&closed=false&limit=${pageSize}&offset=${offset}`,
      fetchTimeoutMs,
      "active-events"
    );
    events.push(...response);

    if (response.length < pageSize) {
      break;
    }
  }

  return events;
}

function finalizeResult(args: {
  selector: MarketDiscoveryResult["selector"];
  discoveredAt: string;
  descriptors: RawMarketDescriptor[];
  degradedCount: number;
  provenance: Record<string, unknown>;
  failClosed: boolean;
}): MarketDiscoveryResult {
  if (args.failClosed && args.degradedCount > 0) {
    throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket discovery returned degraded results.", 502, {
      sourceMode: "live",
      selector: args.selector.raw,
      degradedCount: args.degradedCount
    });
  }

  if (args.failClosed && args.descriptors.length === 0) {
    throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket discovery returned no eligible markets.", 502, {
      sourceMode: "live",
      selector: args.selector.raw,
      provenance: args.provenance
    });
  }

  return {
    selector: args.selector,
    discoveredAt: args.discoveredAt,
    descriptors: args.descriptors,
    degradedCount: args.degradedCount,
    sourceMode: "live",
    provenance: args.provenance
  };
}

function collectDescriptorsFromSearch(search: SearchResponse): RawMarketDescriptor[] {
  const fromEvents = flattenActiveEvents(search.events ?? []);
  const fromMarkets = collectDescriptorsFromMarkets(search.markets ?? []);
  const fromData = (search.data ?? [])
    .flatMap((entry) => {
      const event = (entry.event ?? entry) as GammaEvent;
      const market = (entry.market ?? entry) as GammaMarket;
      return [toRawDescriptor(resolveEventForMarket(market, event), market)].filter(
        (value): value is RawMarketDescriptor => value !== null
      );
    });

  return dedupeDescriptors([...fromEvents, ...fromMarkets, ...fromData]);
}

function collectDescriptorsFromMarkets(markets: GammaMarket[]): RawMarketDescriptor[] {
  return dedupeDescriptors(
    markets
      .map((market) => toRawDescriptor(resolveEventForMarket(market), market))
      .filter((descriptor): descriptor is RawMarketDescriptor => descriptor !== null)
  );
}

function flattenActiveEvents(events: GammaEvent[]): RawMarketDescriptor[] {
  return dedupeDescriptors(
    events.flatMap((event) =>
      (event.markets ?? [])
        .map((market) => toRawDescriptor(resolveEventForMarket(market, event), market))
        .filter((descriptor): descriptor is RawMarketDescriptor => descriptor !== null)
    )
  );
}

function dedupeDescriptors(descriptors: RawMarketDescriptor[]): RawMarketDescriptor[] {
  const seen = new Set<string>();
  return descriptors.filter((descriptor) => {
    if (seen.has(descriptor.marketId)) {
      return false;
    }

    seen.add(descriptor.marketId);
    return true;
  });
}

function resolveEventForMarket(market: GammaMarket, fallback?: GammaEvent): GammaEvent {
  const attachedEvent = market.event ?? market.events?.[0] ?? fallback;

  if (attachedEvent) {
    return attachedEvent;
  }

  return {
    id: market.id == null ? market.slug ?? "unknown-market" : `market:${String(market.id)}`,
    slug: market.slug,
    title: market.title ?? market.question ?? "Polymarket market",
    active: market.active,
    closed: market.closed
  };
}

function toRawDescriptor(event: GammaEvent, market: GammaMarket): RawMarketDescriptor | null {
  if (!market || !event) {
    return null;
  }

  const active = Boolean(market.active ?? event.active ?? false);
  const closed = Boolean(market.closed ?? event.closed ?? false);
  const eventId = event.id == null ? "" : String(event.id);
  const marketId = market.id == null ? "" : String(market.id);
  const marketSlug = market.slug ?? "";
  const eventTitle = event.title ?? market.title ?? market.question ?? "";
  const { yesTokenId, noTokenId } = extractTokenIds(market);

  if (!active || closed || !eventId || !marketId || !marketSlug || !eventTitle || !yesTokenId || !noTokenId) {
    return null;
  }

  if (!isBinaryOutcomes(market)) {
    return null;
  }

  return {
    eventId,
    eventTitle,
    marketId,
    marketSlug,
    yesTokenId,
    noTokenId,
    active,
    closed,
    feeBps: toNumber(market.feeBps),
    tickSize: toNumber(market.tickSize),
    rawRefs: {
      source: "polymarket-gamma",
      eventId,
      marketId,
      yesTokenId,
      noTokenId,
      eventSlug: event.slug ?? null,
      marketSlug
    }
  };
}

function extractTokenIds(market: GammaMarket): { yesTokenId: string; noTokenId: string } {
  if (market.yesTokenId && market.noTokenId) {
    return {
      yesTokenId: market.yesTokenId,
      noTokenId: market.noTokenId
    };
  }

  const directList = parseStringArray(market.clobTokenIds) ?? parseStringArray(market.tokenIds);

  if (directList && directList.length >= 2) {
    return {
      yesTokenId: directList[0] ?? "",
      noTokenId: directList[1] ?? ""
    };
  }

  const yesToken = (market.tokens ?? []).find((token) => isOutcomeToken(token, "YES"));
  const noToken = (market.tokens ?? []).find((token) => isOutcomeToken(token, "NO"));

  return {
    yesTokenId: yesToken ? String(tokenIdValue(yesToken)) : "",
    noTokenId: noToken ? String(tokenIdValue(noToken)) : ""
  };
}

function isBinaryOutcomes(market: GammaMarket): boolean {
  const outcomes = parseStringArray(market.outcomes) ?? [];
  if (outcomes.length === 2) {
    const upper = outcomes.map((value) => value.toUpperCase());
    return upper.includes("YES") && upper.includes("NO");
  }

  if (Array.isArray(market.tokens) && market.tokens.length === 2) {
    return market.tokens.some((token) => isOutcomeToken(token, "YES")) && market.tokens.some((token) => isOutcomeToken(token, "NO"));
  }

  return false;
}

function isOutcomeToken(token: Record<string, unknown>, side: "YES" | "NO"): boolean {
  const value = String(token.outcome ?? token.side ?? token.label ?? token.name ?? "").toUpperCase();
  return value === side;
}

function tokenIdValue(token: Record<string, unknown>) {
  return token.tokenId ?? token.token_id ?? token.asset_id ?? token.id ?? "";
}

function parseStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry));
      }
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return null;
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
      throw new Error(`Polymarket discovery ${operation} request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Polymarket discovery ${operation} timed out after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
