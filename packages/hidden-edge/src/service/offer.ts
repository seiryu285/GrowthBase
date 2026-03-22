import {
  ARTIFACT_KIND,
  CAPABILITY_ID,
  CONTRACT_VERSION_BUNDLE,
  PAYMENT_METHOD,
  SCHEMA_VERSION,
  SERVICE_CATEGORY,
  SERVICE_NETWORK,
  SERVICE_PRICE_ATOMIC,
  SERVICE_TAGS,
  SERVICE_VERSION,
  hiddenEdgeArtifactJsonSchema,
  hiddenEdgeInputJsonSchema,
  hiddenEdgeProofJsonSchema,
  serviceOfferSchema,
  type AgentIdentityRef,
  type ServiceOffer
} from "@growthbase/core";

export function createHiddenEdgeOffer(args: {
  sellerWallet: `0x${string}`;
  sellerIdentity: AgentIdentityRef;
}): ServiceOffer {
  return serviceOfferSchema.parse({
    capabilityId: CAPABILITY_ID,
    version: SERVICE_VERSION,
    network: SERVICE_NETWORK,
    sellerWallet: args.sellerWallet,
    sellerIdentity: args.sellerIdentity,
    price: SERVICE_PRICE_ATOMIC,
    currency: "USDC",
    paymentMethod: PAYMENT_METHOD,
    category: SERVICE_CATEGORY,
    tags: [...SERVICE_TAGS],
    bodyType: "application/json",
    inputSchema: hiddenEdgeInputJsonSchema,
    outputSchema: {
      type: "object",
      required: ["artifact", "proof", "receiptId", "deliveryStatus"],
      properties: {
        artifact: hiddenEdgeArtifactJsonSchema,
        proof: hiddenEdgeProofJsonSchema,
        receiptId: { type: "string" },
        deliveryStatus: { type: "string", enum: ["DELIVERED"] }
      }
    },
    artifactType: ARTIFACT_KIND,
    contractVersions: CONTRACT_VERSION_BUNDLE,
    schemaVersion: SCHEMA_VERSION
  });
}

export function createHiddenEdgeDiscoveryMetadata() {
  return {
    description: "Run a deterministic hidden-edge scan over Polymarket public market data and return a typed artifact.",
    input: {
      universe: "auto",
      sidePolicy: "BOTH",
      requestedNotionalUsd: 100,
      maxCandidates: 10,
      riskMode: "standard",
      maxBookAgeMs: 5000
    },
    contractVersions: CONTRACT_VERSION_BUNDLE,
    payment: {
      method: PAYMENT_METHOD,
      network: SERVICE_NETWORK,
      price: SERVICE_PRICE_ATOMIC
    },
    output: {
      artifactType: ARTIFACT_KIND,
      deliveryStatus: "DELIVERED"
    }
  };
}
