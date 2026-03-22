import type { HiddenEdgeScanInput, MarketSourceMode } from "@growthbase/core";

export type UniverseSelector =
  | { kind: "auto"; raw: "auto" }
  | { kind: "search"; raw: string; query: string }
  | { kind: "tag"; raw: string; value: string };

export type RawMarketDescriptor = {
  eventId: string;
  eventTitle: string;
  marketId: string;
  marketSlug: string;
  yesTokenId: string;
  noTokenId: string;
  active: boolean;
  closed: boolean;
  feeBps: number | null;
  tickSize: number | null;
  rawRefs: Record<string, unknown>;
};

export type MarketDiscoveryResult = {
  selector: UniverseSelector;
  discoveredAt: string;
  descriptors: RawMarketDescriptor[];
  degradedCount: number;
  sourceMode: MarketSourceMode;
  provenance: Record<string, unknown>;
};

export interface MarketDiscoveryAdapter {
  discover(input: HiddenEdgeScanInput): Promise<MarketDiscoveryResult>;
}

export function resolveUniverseSelector(universe: HiddenEdgeScanInput["universe"]): UniverseSelector {
  if (universe === "auto") {
    return { kind: "auto", raw: "auto" };
  }

  if (universe.startsWith("search:")) {
    return {
      kind: "search",
      raw: universe,
      query: universe.slice("search:".length)
    };
  }

  return {
    kind: "tag",
    raw: universe,
    value: universe.slice("tag:".length)
  };
}
