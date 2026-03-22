import { z } from "zod";

import { deliveryStatusSchema } from "./enums";
import {
  ARTIFACT_KIND,
  ARTIFACT_SCHEMA_VERSION,
  CAPABILITY_ID,
  CONTRACT_VERSION_BUNDLE,
  DEFAULT_CURRENCY,
  INPUT_SCHEMA_VERSION,
  PAYMENT_METHOD,
  PROOF_SCHEMA_VERSION,
  SCHEMA_VERSION,
  SERVICE_CATEGORY,
  SERVICE_ID,
  SERVICE_NETWORK,
  SERVICE_PRICE_ATOMIC,
  SERVICE_TAGS,
  SERVICE_VERSION
} from "./versions";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Expected an EVM address");
const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Expected a 32-byte hex hash");
const atomicStringSchema = z.string().regex(/^\d+$/, "Expected an atomic-unit integer string");
const isoTimestampSchema = z.string().datetime({ offset: true });
const uuidSchema = z.string().uuid();
const probabilitySchema = z.number().min(0).max(1);
const marketSourceModeSchema = z.enum(["fixture", "live"]);

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

export const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
export const schemaVersionSchema = z.literal(SCHEMA_VERSION);

export const hiddenEdgeInputJsonSchema = {
  $id: "hypergrowth://polymarket-hidden-edge-scan/schemas/input/1",
  type: "object",
  required: ["universe", "sidePolicy", "requestedNotionalUsd", "maxCandidates", "riskMode", "maxBookAgeMs"],
  properties: {
    universe: {
      type: "string",
      description: "auto | tag:{id|slug} | search:{query}",
      default: "auto"
    },
    sidePolicy: {
      type: "string",
      enum: ["YES_ONLY", "NO_ONLY", "BOTH"],
      default: "BOTH"
    },
    requestedNotionalUsd: {
      type: "number",
      minimum: 1,
      maximum: 10000,
      default: 100
    },
    maxCandidates: {
      type: "integer",
      minimum: 1,
      maximum: 20,
      default: 10
    },
    riskMode: {
      type: "string",
      enum: ["conservative", "standard", "aggressive"],
      default: "standard"
    },
    maxBookAgeMs: {
      type: "integer",
      minimum: 1000,
      maximum: 10000,
      default: 5000
    }
  }
} as const;

export const hiddenEdgeArtifactJsonSchema = {
  $id: "hypergrowth://polymarket-hidden-edge-scan/schemas/artifact/1",
  type: "object",
  required: [
    "scanId",
    "asOf",
    "snapshotId",
    "engineVersion",
    "featureVersion",
    "scoringVersion",
    "marketsScanned",
    "marketsEligible",
    "candidates"
  ],
  properties: {
    scanId: { type: "string", format: "uuid" },
    asOf: { type: "string", format: "date-time" },
    snapshotId: { type: "string", format: "uuid" },
    engineVersion: { type: "string" },
    featureVersion: { type: "string" },
    scoringVersion: { type: "string" },
    marketsScanned: { type: "integer", minimum: 0 },
    marketsEligible: { type: "integer", minimum: 0 },
    candidates: {
      type: "array",
      items: {
        type: "object",
        required: [
          "rank",
          "marketId",
          "eventId",
          "marketSlug",
          "eventTitle",
          "recommendedSide",
          "marketProb",
          "fairLow",
          "fairMid",
          "fairHigh",
          "allInEntry",
          "hiddenEdgeBps",
          "maxSafeSizeUsd",
          "score",
          "reasonCodes",
          "action",
          "expiresAt"
        ],
        properties: {
          rank: { type: "integer", minimum: 1 },
          marketId: { type: "string" },
          eventId: { type: "string" },
          marketSlug: { type: "string" },
          eventTitle: { type: "string" },
          recommendedSide: { type: "string", enum: ["YES", "NO"] },
          marketProb: { type: "number" },
          fairLow: { type: "number" },
          fairMid: { type: "number" },
          fairHigh: { type: "number" },
          allInEntry: { type: "number" },
          hiddenEdgeBps: { type: "integer" },
          maxSafeSizeUsd: { type: "number" },
          score: { type: "number" },
          reasonCodes: { type: "array", items: { type: "string" } },
          action: { type: "string", enum: ["ENTER_NOW", "WATCH_CLOSE", "SKIP"] },
          expiresAt: { type: "string", format: "date-time" }
        }
      }
    }
  }
} as const;

export const hiddenEdgeProofJsonSchema = {
  $id: "hypergrowth://polymarket-hidden-edge-scan/schemas/proof/1",
  type: "object",
  required: [
    "artifact_hash",
    "snapshot_hash",
    "snapshot_id",
    "request_hash",
    "engine_version",
    "feature_version",
    "scoring_version",
    "generated_at",
    "artifact_kind"
  ],
  properties: {
    artifact_hash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
    snapshot_hash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
    snapshot_id: { type: "string", format: "uuid" },
    request_hash: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
    engine_version: { type: "string" },
    feature_version: { type: "string" },
    scoring_version: { type: "string" },
    generated_at: { type: "string", format: "date-time" },
    artifact_kind: { type: "string", const: ARTIFACT_KIND }
  }
} as const;

export const delegationPolicySchema = z
  .object({
    policyId: z.string().min(1),
    chainId: z.number().int().positive(),
    humanOwner: addressSchema,
    agentWallet: addressSchema,
    spenderWallet: addressSchema,
    token: addressSchema,
    maxTotalSpend: z.string().min(1),
    maxPricePerCall: z.string().min(1),
    validFrom: isoTimestampSchema,
    validUntil: isoTimestampSchema,
    allowedServices: z.array(z.string().min(1)).min(1),
    nonce: z.string().min(1),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Expected a hex signature"),
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const unsignedDelegationPolicySchema = delegationPolicySchema.omit({ signature: true });

export const agentIdentityRefSchema = z
  .object({
    standard: z.string().min(1),
    agentRegistry: z.string().min(1),
    agentId: z.string().min(1),
    agentURI: z.string().url(),
    agentWallet: addressSchema,
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const contractVersionBundleSchema = z
  .object({
    discovery: z.literal(CONTRACT_VERSION_BUNDLE.discovery),
    request_input: z.literal(CONTRACT_VERSION_BUNDLE.request_input),
    artifact: z.literal(CONTRACT_VERSION_BUNDLE.artifact),
    proof: z.literal(CONTRACT_VERSION_BUNDLE.proof),
    quote: z.literal(CONTRACT_VERSION_BUNDLE.quote),
    payment_required: z.literal(CONTRACT_VERSION_BUNDLE.payment_required),
    paid_run: z.literal(CONTRACT_VERSION_BUNDLE.paid_run)
  })
  .strict();

export const hiddenEdgeInputSchema = z
  .object({
    universe: z.string().regex(/^(auto|tag:.+|search:.+)$/, "Expected auto, tag:{id|slug}, or search:{query}"),
    sidePolicy: z.enum(["YES_ONLY", "NO_ONLY", "BOTH"]),
    requestedNotionalUsd: z.number().min(1).max(10000),
    maxCandidates: z.number().int().min(1).max(20),
    riskMode: z.enum(["conservative", "standard", "aggressive"]),
    maxBookAgeMs: z.number().int().min(1000).max(10000)
  })
  .strict();

export const hiddenEdgeArtifactCandidateSchema = z
  .object({
    rank: z.number().int().min(1),
    marketId: z.string().min(1),
    eventId: z.string().min(1),
    marketSlug: z.string().min(1),
    eventTitle: z.string().min(1),
    recommendedSide: z.enum(["YES", "NO"]),
    marketProb: probabilitySchema,
    fairLow: probabilitySchema,
    fairMid: probabilitySchema,
    fairHigh: probabilitySchema,
    allInEntry: probabilitySchema,
    hiddenEdgeBps: z.number().int(),
    maxSafeSizeUsd: z.number().min(0),
    score: z.number(),
    reasonCodes: z.array(z.string().min(1)),
    action: z.enum(["ENTER_NOW", "WATCH_CLOSE", "SKIP"]),
    expiresAt: isoTimestampSchema
  })
  .strict();

export const hiddenEdgeArtifactSchema = z
  .object({
    scanId: uuidSchema,
    asOf: isoTimestampSchema,
    snapshotId: uuidSchema,
    engineVersion: z.string().min(1),
    featureVersion: z.string().min(1),
    scoringVersion: z.string().min(1),
    marketsScanned: z.number().int().min(0),
    marketsEligible: z.number().int().min(0),
    candidates: z.array(hiddenEdgeArtifactCandidateSchema)
  })
  .strict();

export const hiddenEdgeProofSchema = z
  .object({
    artifact_hash: hashSchema,
    snapshot_hash: hashSchema,
    snapshot_id: uuidSchema,
    request_hash: hashSchema,
    engine_version: z.string().min(1),
    feature_version: z.string().min(1),
    scoring_version: z.string().min(1),
    generated_at: isoTimestampSchema,
    artifact_kind: z.literal(ARTIFACT_KIND)
  })
  .strict();

export const normalizedMarketSnapshotSchema = z
  .object({
    snapshotId: uuidSchema,
    marketId: z.string().min(1),
    eventId: z.string().min(1),
    marketSlug: z.string().min(1),
    eventTitle: z.string().min(1),
    yesTokenId: z.string().min(1),
    noTokenId: z.string().min(1),
    bestYesBid: probabilitySchema,
    bestYesBidSize: z.number().min(0),
    bestYesAsk: probabilitySchema,
    bestYesAskSize: z.number().min(0),
    bestNoBid: probabilitySchema,
    bestNoBidSize: z.number().min(0),
    bestNoAsk: probabilitySchema,
    bestNoAskSize: z.number().min(0),
    midProbYes: probabilitySchema,
    midProbNo: probabilitySchema,
    historyMeanYes: probabilitySchema.nullable(),
    historyMeanNo: probabilitySchema.nullable(),
    feeBps: z.number().int().min(0),
    tickSize: z.number().positive(),
    observedAt: isoTimestampSchema,
    rawRefs: jsonObjectSchema
  })
  .strict();

export const persistedNormalizedSnapshotSchema = z
  .object({
    snapshotId: uuidSchema,
    asOf: isoTimestampSchema,
    requestHash: hashSchema,
    universe: z.string().min(1),
    sourceMode: marketSourceModeSchema.optional(),
    fetchedAt: isoTimestampSchema.optional(),
    provenance: jsonObjectSchema.optional(),
    markets: z.array(normalizedMarketSnapshotSchema),
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const serviceRunRecordSchema = z
  .object({
    requestHash: hashSchema,
    serviceId: z.literal(SERVICE_ID),
    snapshotHash: hashSchema,
    artifactHash: hashSchema,
    proofHash: hashSchema,
    createdAt: isoTimestampSchema,
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const serviceOfferSchema = z
  .object({
    serviceId: z.literal(SERVICE_ID).default(SERVICE_ID),
    capabilityId: z.literal(CAPABILITY_ID).default(CAPABILITY_ID),
    version: z.literal(SERVICE_VERSION).default(SERVICE_VERSION),
    network: z.literal(SERVICE_NETWORK).default(SERVICE_NETWORK),
    sellerWallet: addressSchema,
    sellerIdentity: agentIdentityRefSchema,
    price: atomicStringSchema.default(SERVICE_PRICE_ATOMIC),
    currency: z.literal(DEFAULT_CURRENCY).default(DEFAULT_CURRENCY),
    paymentMethod: z.literal(PAYMENT_METHOD).default(PAYMENT_METHOD),
    category: z.literal(SERVICE_CATEGORY).default(SERVICE_CATEGORY),
    tags: z.array(z.string().min(1)).default([...SERVICE_TAGS]),
    bodyType: z.literal("application/json").default("application/json"),
    inputSchema: jsonObjectSchema,
    outputSchema: jsonObjectSchema,
    artifactType: z.literal(ARTIFACT_KIND).default(ARTIFACT_KIND),
    contractVersions: contractVersionBundleSchema.default(CONTRACT_VERSION_BUNDLE),
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const commerceReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    policyId: z.string().min(1),
    policyHash: hashSchema,
    humanOwner: addressSchema,
    buyerWallet: addressSchema,
    agentWallet: addressSchema,
    agentIdentity: agentIdentityRefSchema,
    sellerWallet: addressSchema,
    sellerIdentity: agentIdentityRefSchema,
    serviceId: z.literal(SERVICE_ID),
    requestHash: hashSchema,
    paymentScheme: z.string().min(1),
    paymentNetwork: z.string().min(1),
    paymentResponse: jsonObjectSchema,
    price: atomicStringSchema,
    currency: z.string().min(1),
    artifactHash: hashSchema,
    snapshotHash: hashSchema,
    proofHash: hashSchema,
    deliveryStatus: deliveryStatusSchema,
    timestamp: isoTimestampSchema,
    receiptHash: hashSchema,
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const growthHistoryEntrySchema = z
  .object({
    agentWallet: addressSchema,
    receiptId: z.string().min(1),
    serviceId: z.literal(SERVICE_ID),
    artifactHash: hashSchema,
    deliveryStatus: deliveryStatusSchema,
    timestamp: isoTimestampSchema,
    candidatesReturned: z.number().int().min(0).optional(),
    topCandidateAction: z.enum(["ENTER_NOW", "WATCH_CLOSE", "SKIP"]).optional(),
    topCandidateScore: z.number().optional(),
    schemaVersion: schemaVersionSchema
  })
  .strict();

export const purchaseRequestRecordSchema = z
  .object({
    policyId: z.string().min(1),
    serviceId: z.literal(SERVICE_ID),
    agentWallet: addressSchema,
    input: hiddenEdgeInputSchema,
    schemaVersion: schemaVersionSchema
  })
  .strict();

export type DelegationPolicy = z.infer<typeof delegationPolicySchema>;
export type UnsignedDelegationPolicy = z.infer<typeof unsignedDelegationPolicySchema>;
export type AgentIdentityRef = z.infer<typeof agentIdentityRefSchema>;
export type ServiceOffer = z.infer<typeof serviceOfferSchema>;
export type HiddenEdgeScanInput = z.infer<typeof hiddenEdgeInputSchema>;
export type HiddenEdgeArtifactCandidate = z.infer<typeof hiddenEdgeArtifactCandidateSchema>;
export type HiddenEdgeScanArtifact = z.infer<typeof hiddenEdgeArtifactSchema>;
export type HiddenEdgeScanProof = z.infer<typeof hiddenEdgeProofSchema>;
export type MarketSourceMode = z.infer<typeof marketSourceModeSchema>;
export type NormalizedMarketSnapshot = z.infer<typeof normalizedMarketSnapshotSchema>;
export type PersistedNormalizedSnapshot = z.infer<typeof persistedNormalizedSnapshotSchema>;
export type ServiceRunRecord = z.infer<typeof serviceRunRecordSchema>;
export type CommerceReceipt = z.infer<typeof commerceReceiptSchema>;
export type GrowthHistoryEntry = z.infer<typeof growthHistoryEntrySchema>;
export type PurchaseRequestRecord = z.infer<typeof purchaseRequestRecordSchema>;
