import { eq } from "drizzle-orm";

import { anchorReceiptOnChain } from "./anchor";
import {
  CommerceReceipt,
  GrowthBaseError,
  SCHEMA_VERSION,
  commerceReceiptSchema,
  hashCanonicalValue,
  purchaseRequestRecordSchema,
  shortHashId,
  stripKeys,
  type AgentIdentityRef,
  type DelegationPolicy,
  type DeliveryStatus,
  type HiddenEdgeScanArtifact,
  type HiddenEdgeScanInput,
  type PurchaseRequestRecord,
  type ServiceOffer
} from "@growthbase/core";
import {
  artifacts,
  parseJsonColumn,
  receiptRecords,
  serializeJsonColumn,
  type GrowthBaseDatabase
} from "@growthbase/db";

export function computeRequestHash(request: PurchaseRequestRecord): `0x${string}` {
  return hashCanonicalValue(purchaseRequestRecordSchema.parse(request));
}

export function computeCommerceReceiptHash(receipt: CommerceReceipt | Omit<CommerceReceipt, "receiptHash">): `0x${string}` {
  const payload = "receiptHash" in receipt ? stripKeys(receipt, ["receiptHash"]) : receipt;
  return hashCanonicalValue(payload);
}

export type AppendCommerceReceiptInput = {
  database: GrowthBaseDatabase;
  policy: DelegationPolicy;
  offer: ServiceOffer;
  agentIdentity: AgentIdentityRef;
  input: HiddenEdgeScanInput;
  artifact: HiddenEdgeScanArtifact;
  artifactHash: `0x${string}`;
  snapshotHash: `0x${string}`;
  proofHash: `0x${string}`;
  paymentScheme: string;
  paymentNetwork: string;
  paymentResponse: Record<string, unknown>;
  buyerWallet: `0x${string}`;
  timestamp?: string;
  deliveryStatus?: DeliveryStatus;
  anchorPrivateKey?: `0x${string}`;
  anchorContractAddress?: `0x${string}`;
};

export function appendCommerceReceipt(args: AppendCommerceReceiptInput): CommerceReceipt {
  const timestamp = args.timestamp ?? new Date().toISOString();
  const requestRecord = purchaseRequestRecordSchema.parse({
    policyId: args.policy.policyId,
    serviceId: args.offer.serviceId,
    agentWallet: args.policy.agentWallet,
    input: args.input,
    schemaVersion: SCHEMA_VERSION
  });

  const requestHash = computeRequestHash(requestRecord);
  const receiptSeed = hashCanonicalValue({
    policyId: args.policy.policyId,
    requestHash,
    artifactHash: args.artifactHash,
    timestamp
  });
  const receiptId = shortHashId("receipt", receiptSeed);
  const receiptWithoutHash = {
    receiptId,
    policyId: args.policy.policyId,
    policyHash: hashCanonicalValue(stripKeys(args.policy, ["signature"])),
    humanOwner: args.policy.humanOwner,
    buyerWallet: args.buyerWallet,
    agentWallet: args.policy.agentWallet,
    agentIdentity: args.agentIdentity,
    sellerWallet: args.offer.sellerWallet,
    sellerIdentity: args.offer.sellerIdentity,
    serviceId: args.offer.serviceId,
    requestHash,
    paymentScheme: args.paymentScheme,
    paymentNetwork: args.paymentNetwork,
    paymentResponse: args.paymentResponse,
    price: args.offer.price,
    currency: args.offer.currency,
    artifactHash: args.artifactHash,
    snapshotHash: args.snapshotHash,
    proofHash: args.proofHash,
    deliveryStatus: args.deliveryStatus ?? "DELIVERED",
    timestamp,
    schemaVersion: SCHEMA_VERSION as typeof SCHEMA_VERSION
  };

  const receipt = commerceReceiptSchema.parse({
    ...receiptWithoutHash,
    receiptHash: computeCommerceReceiptHash(receiptWithoutHash)
  });

  const existing = args.database.db
    .select()
    .from(receiptRecords)
    .where(eq(receiptRecords.receiptId, receipt.receiptId))
    .get();

  if (existing) {
    throw new GrowthBaseError("PAYMENT_FAILED", "Receipt identifier collision detected.", 500, {
      receiptId: receipt.receiptId
    });
  }

  args.database.db
    .insert(artifacts)
    .values({
      artifactId: args.artifact.scanId,
      artifactHash: args.artifactHash,
      serviceId: args.offer.serviceId,
      artifactType: args.offer.artifactType,
      generatedAt: args.artifact.asOf,
      dataJson: serializeJsonColumn(args.artifact)
    })
    .onConflictDoNothing()
    .run();

  args.database.db
    .insert(receiptRecords)
    .values({
      receiptId: receipt.receiptId,
      policyId: receipt.policyId,
      policyHash: receipt.policyHash,
      humanOwner: receipt.humanOwner,
      buyerWallet: receipt.buyerWallet,
      agentWallet: receipt.agentWallet,
      agentIdentityJson: serializeJsonColumn(receipt.agentIdentity),
      sellerWallet: receipt.sellerWallet,
      sellerIdentityJson: serializeJsonColumn(receipt.sellerIdentity),
      serviceId: receipt.serviceId,
      requestHash: receipt.requestHash,
      paymentScheme: receipt.paymentScheme,
      paymentNetwork: receipt.paymentNetwork,
      paymentResponseJson: serializeJsonColumn(receipt.paymentResponse),
      price: receipt.price,
      currency: receipt.currency,
      artifactHash: receipt.artifactHash,
      snapshotHash: receipt.snapshotHash,
      proofHash: receipt.proofHash,
      deliveryStatus: receipt.deliveryStatus,
      timestamp: receipt.timestamp,
      receiptHash: receipt.receiptHash,
      schemaVersion: receipt.schemaVersion,
      policyJson: serializeJsonColumn(args.policy),
      requestJson: serializeJsonColumn(requestRecord),
      artifactJson: serializeJsonColumn(args.artifact),
      offerJson: serializeJsonColumn(args.offer)
    })
    .run();

  // Fire-and-forget on-chain anchor (non-blocking)
  if (args.anchorPrivateKey && args.anchorContractAddress) {
    anchorReceiptOnChain({
      receiptHash: receipt.receiptHash as `0x${string}`,
      policyHash: receipt.policyHash as `0x${string}`,
      artifactHash: receipt.artifactHash as `0x${string}`,
      privateKey: args.anchorPrivateKey,
      contractAddress: args.anchorContractAddress
    }).catch(() => {}); // intentionally swallowed
  }

  return receipt;
}

export function getReceiptById(database: GrowthBaseDatabase, receiptId: string): CommerceReceipt | null {
  const row = database.db
    .select()
    .from(receiptRecords)
    .where(eq(receiptRecords.receiptId, receiptId))
    .get();

  if (!row) {
    return null;
  }

  return mapReceiptRow(row);
}

export function listReceiptsByAgentWallet(database: GrowthBaseDatabase, agentWallet: string): CommerceReceipt[] {
  return database.db
    .select()
    .from(receiptRecords)
    .where(eq(receiptRecords.agentWallet, agentWallet))
    .all()
    .map(mapReceiptRow);
}

export function listReceiptsByPolicyId(database: GrowthBaseDatabase, policyId: string): CommerceReceipt[] {
  return database.db
    .select()
    .from(receiptRecords)
    .where(eq(receiptRecords.policyId, policyId))
    .all()
    .map((row) => getReceiptById(database, row.receiptId))
    .filter((receipt): receipt is CommerceReceipt => receipt !== null);
}

function mapReceiptRow(row: typeof receiptRecords.$inferSelect): CommerceReceipt {
  return commerceReceiptSchema.parse({
    receiptId: row.receiptId,
    policyId: row.policyId,
    policyHash: row.policyHash,
    humanOwner: row.humanOwner,
    buyerWallet: row.buyerWallet,
    agentWallet: row.agentWallet,
    agentIdentity: parseJsonColumn(row.agentIdentityJson),
    sellerWallet: row.sellerWallet,
    sellerIdentity: parseJsonColumn(row.sellerIdentityJson),
    serviceId: row.serviceId,
    requestHash: row.requestHash,
    paymentScheme: row.paymentScheme,
    paymentNetwork: row.paymentNetwork,
    paymentResponse: parseJsonColumn(row.paymentResponseJson),
    price: row.price,
    currency: row.currency,
    artifactHash: row.artifactHash,
    snapshotHash: row.snapshotHash,
    proofHash: row.proofHash,
    deliveryStatus: row.deliveryStatus,
    timestamp: row.timestamp,
    receiptHash: row.receiptHash,
    schemaVersion: row.schemaVersion
  });
}
