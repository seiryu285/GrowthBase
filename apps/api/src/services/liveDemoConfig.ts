import { hiddenEdgeInputSchema, type HiddenEdgeScanInput } from "@growthbase/core";

import type { ApiEnv } from "../env";

export function getRecommendedLiveDemoInput(env: ApiEnv): HiddenEdgeScanInput {
  return hiddenEdgeInputSchema.parse({
    universe: env.demoUniverse,
    sidePolicy: env.demoSidePolicy,
    requestedNotionalUsd: env.demoRequestedNotionalUsd,
    maxCandidates: env.demoMaxCandidates,
    riskMode: env.demoRiskMode,
    maxBookAgeMs: env.demoMaxBookAgeMs
  });
}

export function parseLiveDemoInputOverrides(
  query: Record<string, string | undefined>,
  env: ApiEnv
): HiddenEdgeScanInput {
  const fallback = getRecommendedLiveDemoInput(env);

  return hiddenEdgeInputSchema.parse({
    universe: query.universe ?? fallback.universe,
    sidePolicy: query.sidePolicy ?? fallback.sidePolicy,
    requestedNotionalUsd: parseOptionalNumber(query.requestedNotionalUsd) ?? fallback.requestedNotionalUsd,
    maxCandidates: parseOptionalNumber(query.maxCandidates) ?? fallback.maxCandidates,
    riskMode: query.riskMode ?? fallback.riskMode,
    maxBookAgeMs: parseOptionalNumber(query.maxBookAgeMs) ?? fallback.maxBookAgeMs
  });
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
