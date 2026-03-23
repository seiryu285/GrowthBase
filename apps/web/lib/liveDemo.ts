import { reconstructTransaction } from "@growthbase/receipt";

import type { HiddenEdgeScanInput } from "@growthbase/core";

import { LIVE_API_BASE_URL } from "./site";

export type VerifyBundle = Awaited<ReturnType<typeof reconstructTransaction>>;

export type LiveReadinessResponse = {
  serviceId: string;
  runtimeMode: "live" | "fixture";
  recommendedInput: HiddenEdgeScanInput;
  checkedInput: HiddenEdgeScanInput;
  configuredEventSlugs: string[];
  configuredMarketSlugs: string[];
  readiness: {
    ok: boolean;
    checkedAt: string;
    sourceMode?: "fixture" | "live" | "replay";
    replayed?: boolean;
    code?: string;
    status?: number;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type LatestArtifactResponse = {
  serviceId: string;
  receiptId: string;
  timestamp: string;
  verifyBundleUrl: string;
  bundle: VerifyBundle;
};

export async function loadLiveReadiness(): Promise<{ data: LiveReadinessResponse | null; error: string | null }> {
  return loadLiveApiJson<LiveReadinessResponse>(`/offers/polymarket-hidden-edge-scan/live-readiness`);
}

export async function loadLatestArtifact(): Promise<{ data: LatestArtifactResponse | null; error: string | null }> {
  return loadLiveApiJson<LatestArtifactResponse>(`/offers/polymarket-hidden-edge-scan/latest-artifact`);
}

async function loadLiveApiJson<T>(pathname: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(`${LIVE_API_BASE_URL}${pathname}`, {
      cache: "no-store"
    });

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as T | { error?: { message?: string } }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === "object" && "error" in parsed ? parsed.error?.message : `API request failed (${response.status})`;
      return { data: null, error: message ?? `API request failed (${response.status})` };
    }

    return { data: parsed as T, error: null };
  } catch (cause) {
    return {
      data: null,
      error: cause instanceof Error ? cause.message : "API request failed."
    };
  }
}
