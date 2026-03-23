import { SCHEMA_VERSION, type AgentIdentityRef, type ServiceOffer } from "@growthbase/core";
import { createAgentProfile, generateAgentRegistration, type AgentProfile } from "@growthbase/identity";

import type { ApiEnv } from "../env";

export function createSellerIdentity(env: ApiEnv): AgentIdentityRef {
  return {
    standard: "ERC-8004",
    agentRegistry: env.agentRegistry,
    agentId: env.agentId,
    agentURI: env.agentUri,
    agentWallet: env.agentWallet,
    schemaVersion: SCHEMA_VERSION
  };
}

export function loadAgentProfile(env: ApiEnv, offer: ServiceOffer): AgentProfile {
  return createAgentProfile({
    name: "GrowthBase Seller Agent",
    description:
      "GrowthBase is the Base-native x402 commerce and trust substrate. Polymarket Hidden Edge Scan is the first paid service running on top of it.",
    image: env.sellerImage,
    active: true,
    x402Support: true,
    identity: createSellerIdentity(env),
    services: [
      { name: "web", endpoint: `${env.apiBaseUrl.replace(":3001", ":3000")}/identity` },
      { name: "offers", endpoint: `${env.apiBaseUrl}/offers/${offer.serviceId}`, version: SCHEMA_VERSION },
      { name: "x402", endpoint: `${env.apiBaseUrl}/purchase/${offer.serviceId}`, version: "2.0.0" },
      { name: "purchase-spec", endpoint: `${env.apiBaseUrl}/purchase/${offer.serviceId}`, version: SCHEMA_VERSION }
    ],
    supportedTrust: ["policy-signature", "append-only-receipts", "hash-linked-artifacts", "snapshot-proof-linkage"]
  });
}

export function loadAgentRegistration(env: ApiEnv, offer: ServiceOffer) {
  return generateAgentRegistration(loadAgentProfile(env, offer));
}
