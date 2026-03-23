import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "@growthbase/core";
import { createHiddenEdgeServiceAdapter } from "@growthbase/hidden-edge";
import { computeCommerceReceiptHash, computeRequestHash } from "@growthbase/receipt";

import { createHiddenEdgeInput, createSignedPolicy, createTestEnv, createTestAgentIdentity, spenderAccount } from "../helpers";
import { createSellerIdentity } from "../../apps/api/src/services/profile";

describe("receipt", () => {
  it("produces deterministic request and receipt hashes", async () => {
    const policy = await createSignedPolicy();
    const env = createTestEnv();
    const offer = createHiddenEdgeServiceAdapter({
      sellerWallet: env.sellerWallet,
      sellerIdentity: createSellerIdentity(env)
    }).offer;
    const agentIdentity = createTestAgentIdentity();
    const input = createHiddenEdgeInput();

    const requestHash = computeRequestHash({
      policyId: policy.policyId,
      serviceId: offer.serviceId,
      agentWallet: policy.agentWallet,
      input,
      schemaVersion: SCHEMA_VERSION
    });

    const first = computeCommerceReceiptHash({
      receiptId: "receipt_test",
      policyId: policy.policyId,
      policyHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      humanOwner: policy.humanOwner,
      buyerWallet: spenderAccount.address,
      agentWallet: policy.agentWallet,
      agentIdentity,
      sellerWallet: offer.sellerWallet,
      sellerIdentity: offer.sellerIdentity,
      serviceId: offer.serviceId,
      requestHash,
      paymentScheme: "exact",
      paymentNetwork: "eip155:8453",
      paymentResponse: { payer: spenderAccount.address, transaction: "0x1" },
      price: offer.price,
      currency: offer.currency,
      artifactHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      snapshotHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      proofHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      deliveryStatus: "DELIVERED",
      timestamp: "2026-03-21T00:00:00.000Z",
      schemaVersion: SCHEMA_VERSION
    });

    const second = computeCommerceReceiptHash({
      receiptId: "receipt_test",
      policyId: policy.policyId,
      policyHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      humanOwner: policy.humanOwner,
      buyerWallet: spenderAccount.address,
      agentWallet: policy.agentWallet,
      agentIdentity,
      sellerWallet: offer.sellerWallet,
      sellerIdentity: offer.sellerIdentity,
      serviceId: offer.serviceId,
      requestHash,
      paymentScheme: "exact",
      paymentNetwork: "eip155:8453",
      paymentResponse: { payer: spenderAccount.address, transaction: "0x1" },
      price: offer.price,
      currency: offer.currency,
      artifactHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      snapshotHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      proofHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      deliveryStatus: "DELIVERED",
      timestamp: "2026-03-21T00:00:00.000Z",
      schemaVersion: SCHEMA_VERSION
    });

    expect(first).toBe(second);
  });
});
