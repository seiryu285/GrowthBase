import { eq } from "drizzle-orm";

import {
  GrowthBaseError,
  SCHEMA_VERSION,
  hashCanonicalValue,
  paidArtifactFailureRecordSchema,
  purchaseRequestRecordSchema,
  shortHashId,
  stripKeys,
  type AgentIdentityRef,
  type DelegationPolicy,
  type ErrorCode,
  type HiddenEdgeScanInput,
  type PaidArtifactFailureRecord,
  type ServiceOffer
} from "@growthbase/core";
import {
  paidArtifactFailureRecords,
  parseJsonColumn,
  serializeJsonColumn,
  type GrowthBaseDatabase
} from "@growthbase/db";

import { computeRequestHash } from "./writer";

export type AppendPaidArtifactFailureRecordInput = {
  database: GrowthBaseDatabase;
  policy: DelegationPolicy;
  offer: ServiceOffer;
  agentIdentity: AgentIdentityRef;
  input: HiddenEdgeScanInput;
  paymentScheme: string;
  paymentNetwork: string;
  paymentAsset: `0x${string}`;
  paymentResponse: Record<string, unknown>;
  buyerWallet: `0x${string}`;
  failureCode: ErrorCode;
  failureMessage: string;
  failureDetails?: Record<string, unknown>;
  timestamp?: string;
};

export function appendPaidArtifactFailureRecord(args: AppendPaidArtifactFailureRecordInput): PaidArtifactFailureRecord {
  const timestamp = args.timestamp ?? new Date().toISOString();
  const request = purchaseRequestRecordSchema.parse({
    policyId: args.policy.policyId,
    serviceId: args.offer.serviceId,
    agentWallet: args.policy.agentWallet,
    input: args.input,
    schemaVersion: SCHEMA_VERSION
  });
  const requestHash = computeRequestHash(request);
  const transactionHash = extractTransactionHash(args.paymentResponse);
  const recordSeed = hashCanonicalValue({
    policyId: args.policy.policyId,
    requestHash,
    buyerWallet: args.buyerWallet,
    transactionHash,
    failureCode: args.failureCode,
    timestamp
  });
  const failureId = shortHashId("payfail", recordSeed);
  const record = paidArtifactFailureRecordSchema.parse({
    failureId,
    policyId: args.policy.policyId,
    policyHash: hashCanonicalValue(stripKeys(args.policy, ["signature"])),
    requestHash,
    serviceId: args.offer.serviceId,
    humanOwner: args.policy.humanOwner,
    buyerWallet: args.buyerWallet,
    agentWallet: args.policy.agentWallet,
    agentIdentity: args.agentIdentity,
    sellerWallet: args.offer.sellerWallet,
    sellerIdentity: args.offer.sellerIdentity,
    paymentScheme: args.paymentScheme,
    paymentNetwork: args.paymentNetwork,
    paymentAsset: args.paymentAsset,
    paymentResponse: args.paymentResponse,
    price: args.offer.price,
    currency: args.offer.currency,
    transactionHash,
    executionOutcome: "PAYMENT_ACCEPTED_ARTIFACT_FAILED",
    deliveryStatus: "PAID_BUT_ARTIFACT_FAILED",
    failureCode: args.failureCode,
    failureMessage: args.failureMessage,
    failureDetails: args.failureDetails ?? {},
    timestamp,
    schemaVersion: SCHEMA_VERSION,
    policy: args.policy,
    request,
    offer: args.offer
  });

  const existing = args.database.db
    .select()
    .from(paidArtifactFailureRecords)
    .where(eq(paidArtifactFailureRecords.failureId, record.failureId))
    .get();

  if (existing) {
    throw new GrowthBaseError("PAYMENT_ACCEPTED_ARTIFACT_FAILED", "Paid artifact failure identifier collision detected.", 500, {
      failureId: record.failureId
    });
  }

  args.database.db
    .insert(paidArtifactFailureRecords)
    .values({
      failureId: record.failureId,
      policyId: record.policyId,
      policyHash: record.policyHash,
      requestHash: record.requestHash,
      serviceId: record.serviceId,
      humanOwner: record.humanOwner,
      buyerWallet: record.buyerWallet,
      agentWallet: record.agentWallet,
      agentIdentityJson: serializeJsonColumn(record.agentIdentity),
      sellerWallet: record.sellerWallet,
      sellerIdentityJson: serializeJsonColumn(record.sellerIdentity),
      paymentScheme: record.paymentScheme,
      paymentNetwork: record.paymentNetwork,
      paymentAsset: record.paymentAsset,
      paymentResponseJson: serializeJsonColumn(record.paymentResponse),
      price: record.price,
      currency: record.currency,
      transactionHash: record.transactionHash,
      executionOutcome: record.executionOutcome,
      deliveryStatus: record.deliveryStatus,
      failureCode: record.failureCode,
      failureMessage: record.failureMessage,
      failureDetailsJson: serializeJsonColumn(record.failureDetails),
      timestamp: record.timestamp,
      schemaVersion: record.schemaVersion,
      policyJson: serializeJsonColumn(record.policy),
      requestJson: serializeJsonColumn(record.request),
      offerJson: serializeJsonColumn(record.offer)
    })
    .run();

  return record;
}

export function getPaidArtifactFailureRecordById(
  database: GrowthBaseDatabase,
  failureId: string
): PaidArtifactFailureRecord | null {
  const row = database.db
    .select()
    .from(paidArtifactFailureRecords)
    .where(eq(paidArtifactFailureRecords.failureId, failureId))
    .get();

  if (!row) {
    return null;
  }

  return mapPaidArtifactFailureRecord(row);
}

export function listPaidArtifactFailureRecordsByRequestHash(
  database: GrowthBaseDatabase,
  requestHash: `0x${string}`
): PaidArtifactFailureRecord[] {
  return database.db
    .select()
    .from(paidArtifactFailureRecords)
    .where(eq(paidArtifactFailureRecords.requestHash, requestHash))
    .all()
    .map(mapPaidArtifactFailureRecord);
}

function mapPaidArtifactFailureRecord(
  row: typeof paidArtifactFailureRecords.$inferSelect
): PaidArtifactFailureRecord {
  return paidArtifactFailureRecordSchema.parse({
    failureId: row.failureId,
    policyId: row.policyId,
    policyHash: row.policyHash,
    requestHash: row.requestHash,
    serviceId: row.serviceId,
    humanOwner: row.humanOwner,
    buyerWallet: row.buyerWallet,
    agentWallet: row.agentWallet,
    agentIdentity: parseJsonColumn(row.agentIdentityJson),
    sellerWallet: row.sellerWallet,
    sellerIdentity: parseJsonColumn(row.sellerIdentityJson),
    paymentScheme: row.paymentScheme,
    paymentNetwork: row.paymentNetwork,
    paymentAsset: row.paymentAsset,
    paymentResponse: parseJsonColumn(row.paymentResponseJson),
    price: row.price,
    currency: row.currency,
    transactionHash: row.transactionHash,
    executionOutcome: row.executionOutcome,
    deliveryStatus: row.deliveryStatus,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    failureDetails: parseJsonColumn(row.failureDetailsJson),
    timestamp: row.timestamp,
    schemaVersion: row.schemaVersion,
    policy: parseJsonColumn(row.policyJson),
    request: parseJsonColumn(row.requestJson),
    offer: parseJsonColumn(row.offerJson)
  });
}

function extractTransactionHash(paymentResponse: Record<string, unknown>): `0x${string}` {
  const transactionHash = paymentResponse.transaction;

  if (typeof transactionHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
    return transactionHash as `0x${string}`;
  }

  throw new GrowthBaseError("PAYMENT_ACCEPTED_ARTIFACT_FAILED", "Verified settlement evidence did not include a transaction hash.", 500);
}
