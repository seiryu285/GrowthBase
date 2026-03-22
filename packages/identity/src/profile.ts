import { SCHEMA_VERSION, agentIdentityRefSchema } from "@growthbase/core";
import { z } from "zod";

export const agentServiceEndpointSchema = z.object({
  name: z.string().min(1),
  endpoint: z.string().min(1),
  version: z.string().optional()
});

export const agentProfileSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  image: z.string().url(),
  active: z.boolean(),
  x402Support: z.boolean(),
  identity: agentIdentityRefSchema,
  services: z.array(agentServiceEndpointSchema),
  supportedTrust: z.array(z.string()),
  schemaVersion: z.literal(SCHEMA_VERSION)
});

export type AgentServiceEndpoint = z.infer<typeof agentServiceEndpointSchema>;
export type AgentProfile = z.infer<typeof agentProfileSchema>;

export type AgentProfileInput = Omit<AgentProfile, "schemaVersion">;

export function createAgentProfile(input: AgentProfileInput): AgentProfile {
  return agentProfileSchema.parse({
    ...input,
    schemaVersion: SCHEMA_VERSION
  });
}
