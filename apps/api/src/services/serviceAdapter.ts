import type { HiddenEdgeRunResult, ServiceMetrics } from "@growthbase/hidden-edge";

import type { HiddenEdgeScanInput, ServiceOffer } from "@growthbase/core";
import type { GrowthBaseDatabase } from "@growthbase/db";

export type ServiceAdapter = {
  serviceId: string;
  offer: ServiceOffer;
  discovery: {
    description: string;
    input: Record<string, unknown>;
    contractVersions: Record<string, string>;
    payment: Record<string, string>;
    output: Record<string, string>;
  };
  parseInput: (payload: unknown) => HiddenEdgeScanInput;
  runPaid: (args: {
    database: GrowthBaseDatabase;
    policyId: string;
    agentWallet: `0x${string}`;
    input: HiddenEdgeScanInput;
  }) => Promise<HiddenEdgeRunResult>;
  metrics: ServiceMetrics;
};
