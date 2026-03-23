import { afterEach, describe, expect, it, vi } from "vitest";
import { x402Client, x402HTTPClient } from "@x402/fetch";

import {
  GrowthBaseError,
  hiddenEdgeArtifactSchema,
  hiddenEdgeProofSchema,
  type CommerceReceipt,
  SERVICE_ID,
  SERVICE_NETWORK,
  SERVICE_PRICE_ATOMIC
} from "@growthbase/core";
import { getPaidArtifactFailureRecordById, reconstructTransaction } from "@growthbase/receipt";

import {
  alternateSpenderAccount,
  createHiddenEdgeInput,
  createSignedPolicy,
  createTestAgentIdentity,
  createTestHarness,
  spenderAccount
} from "../helpers";

describe("purchase flow", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("fails when policy disallows the service", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy({ allowedServices: ["other-service"] }),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: {
        code: "SERVICE_NOT_ALLOWED"
      }
    });
  });

  it("fails when the policy max price is below the service price", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy({ maxPricePerCall: "0.04" }),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: {
        code: "PRICE_EXCEEDS_POLICY"
      }
    });
  });

  it("logs x402 challenge debug from the payment server bootstrap path", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    cleanups.push(() => infoSpy.mockRestore());

    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const debugCall = infoSpy.mock.calls.find(([marker]) => marker === "X402_CHALLENGE_DEBUG");
    expect(debugCall).toBeTruthy();

    const payload = JSON.parse(String(debugCall?.[1])) as {
      serviceId: string;
      rawOfferPrice: string;
      formattedX402Price: string;
      network: string;
      asset: string;
      payTo: string;
    };

    expect(payload).toMatchObject({
      serviceId: SERVICE_ID,
      rawOfferPrice: SERVICE_PRICE_ATOMIC,
      formattedX402Price: "0.05",
      network: SERVICE_NETWORK,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: harness.env.x402PayTo
    });
  });

  it("serves a machine-readable purchase spec for raw clients", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`);
    const json = (await response.json()) as Record<string, any>;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      serviceId: SERVICE_ID,
      endpoint: `http://growthbase.test/purchase/${SERVICE_ID}`,
      method: "POST",
      requiredTopLevelFields: ["policy", "agentIdentity", "input"],
      openPayerDefault: true,
      fixedSpenderOptInField: "policy.spenderWallet",
      payment: {
        network: SERVICE_NETWORK,
        priceAtomic: SERVICE_PRICE_ATOMIC,
        payTo: harness.env.x402PayTo
      },
      inspection: {
        actualPayerFieldPaths: ["buyerWallet", "paymentResponse.payer"]
      }
    });
    expect(json.body?.policy?.optionalFields).toEqual(["spenderWallet"]);
    expect(json.body?.example?.policy?.spenderWallet).toBeUndefined();
  });

  it("returns a 400 body contract error instead of a generic 500 when the purchase body is malformed", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service_id: SERVICE_ID
      })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "POLICY_INVALID",
        details: {
          purchaseSpec: {
            serviceId: SERVICE_ID,
            requiredTopLevelFields: ["policy", "agentIdentity", "input"],
            openPayerDefault: true
          }
        }
      }
    });
  });

  it("keeps the unpaid 402 challenge unchanged in open payer mode", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy(),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(response.status).toBe(402);

    const unpaidBody = await response.json();
    const challenge = new x402HTTPClient(new x402Client()).getPaymentRequiredResponse(
      (name) => response.headers.get(name),
      unpaidBody
    );

    expect(challenge.accepts[0]).toMatchObject({
      scheme: "exact",
      network: SERVICE_NETWORK,
      amount: SERVICE_PRICE_ATOMIC,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: harness.env.x402PayTo
    });
    expect((unpaidBody as any)?.error?.details).toMatchObject({
      purchaseSpecUrl: `http://growthbase.test/purchase/${SERVICE_ID}`,
      requiredBodyFields: ["policy", "agentIdentity", "input"],
      openPayerDefault: true
    });
  });

  it("fails closed before the x402 boundary when serviceability is already stale", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    harness.deps.serviceAdapter.assessServiceability = vi.fn(async () => {
      throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket order book is stale.", 502, {
        sourceMode: "live",
        marketId: "824952"
      });
    });
    const processHttpSpy = vi.spyOn(harness.deps.httpServer, "processHTTPRequest");
    cleanups.push(() => processHttpSpy.mockRestore());
    harness.deps.serviceAdapter.runPaid = vi.fn(async () => {
      throw new Error("runPaid should not execute when pre-payment serviceability fails");
    });

    const response = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy(),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("PAYMENT-REQUIRED")).toBeNull();
    expect(processHttpSpy).not.toHaveBeenCalled();
    expect(harness.deps.serviceAdapter.runPaid).not.toHaveBeenCalled();
    expect(harness.deps.serviceAdapter.metrics.quoteCount).toBe(0);
    expect(await response.json()).toMatchObject({
      error: {
        code: "PRE_PAYMENT_SERVICEABILITY_FAILED",
        message: "Live Polymarket order book is stale.",
        details: {
          serviceId: SERVICE_ID,
          executionOutcome: "PRE_PAYMENT_SERVICEABILITY_FAILED",
          retryable: true,
          sourceMode: "live",
          marketId: "824952"
        }
      }
    });
  });

  it("accepts any verified payer when spenderWallet is omitted and records each actual payer", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const policy = await createSignedPolicy();
    const payerAFetch = harness.createPaidFetch(spenderAccount);
    const payerBFetch = harness.createPaidFetch(alternateSpenderAccount);

    expect(policy.spenderWallet).toBeUndefined();

    const paidA = await payerAFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy,
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput({ requestedNotionalUsd: 100 })
      })
    });

    const paidB = await payerBFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy,
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput({ requestedNotionalUsd: 101 })
      })
    });

    expect(paidA.status).toBe(200);
    expect(paidB.status).toBe(200);

    const { receiptId: receiptIdA } = (await paidA.json()) as { receiptId: string };
    const { receiptId: receiptIdB } = (await paidB.json()) as { receiptId: string };
    const receiptA = (await (
      await harness.app.request(`http://growthbase.test/receipts/${receiptIdA}`)
    ).json()) as CommerceReceipt;
    const receiptB = (await (
      await harness.app.request(`http://growthbase.test/receipts/${receiptIdB}`)
    ).json()) as CommerceReceipt;

    expect(receiptA.buyerWallet).toBe(spenderAccount.address);
    expect(receiptA.paymentResponse).toMatchObject({ payer: spenderAccount.address });
    expect(receiptB.buyerWallet).toBe(alternateSpenderAccount.address);
    expect(receiptB.paymentResponse).toMatchObject({ payer: alternateSpenderAccount.address });
  });

  it("preserves fixed spender mode when spenderWallet is present and payer matches", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const response = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy({ spenderWallet: spenderAccount.address }),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(response.status).toBe(200);
  });

  it("rejects non-matching payers when spenderWallet fixes the delegated spender", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const wrongPayerFetch = harness.createPaidFetch(alternateSpenderAccount);
    const response = await wrongPayerFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy({ spenderWallet: spenderAccount.address }),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput()
      })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: {
        code: "POLICY_INVALID",
        details: {
          expected: spenderAccount.address,
          received: alternateSpenderAccount.address
        }
      }
    });
  });

  it("handles 402 then paid purchase success with full artifact and proof contracts", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const body = {
      policy: await createSignedPolicy(),
      agentIdentity: createTestAgentIdentity(),
      input: createHiddenEdgeInput()
    };

    const unpaid = await harness.app.request(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    expect(unpaid.status).toBe(402);
    expect(unpaid.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    expect(harness.deps.serviceAdapter.metrics.quoteCount).toBe(1);

    const unpaidBody = await unpaid.json();
    const challenge = new x402HTTPClient(new x402Client()).getPaymentRequiredResponse(
      (name) => unpaid.headers.get(name),
      unpaidBody
    );

    expect(challenge.accepts[0]?.scheme).toBe("exact");
    expect(challenge.accepts[0]?.network).toBe(SERVICE_NETWORK);
    expect(challenge.accepts[0]?.amount).toBe(SERVICE_PRICE_ATOMIC);

    const paid = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    expect(paid.status).toBe(200);

    const json = (await paid.json()) as {
      artifact: unknown;
      proof: unknown;
      receiptId: string;
      transactionId: string;
      verifyUrl: string;
      deliveryStatus: string;
    };
    const artifact = hiddenEdgeArtifactSchema.parse(json.artifact);
    const proof = hiddenEdgeProofSchema.parse(json.proof);

    expect(json.deliveryStatus).toBe("DELIVERED");
    expect(json.receiptId).toMatch(/^receipt_/);
    expect(json.transactionId).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(json.verifyUrl).toBe(`http://growthbase.test/verify?receiptId=${encodeURIComponent(json.receiptId)}`);
    expect(artifact.snapshotId).toBe(proof.snapshot_id);
    expect(proof.artifact_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(proof.snapshot_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(proof.request_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(artifact.candidates[0]).toMatchObject({
      rank: 1
    });
  });

  it("exposes the verified payer in receipt and reconstruction output", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const paid = await harness.createPaidFetch(alternateSpenderAccount)(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy(),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput({ requestedNotionalUsd: 102 })
      })
    });

    expect(paid.status).toBe(200);

    const { receiptId } = (await paid.json()) as { receiptId: string };
    const receipt = (await (
      await harness.app.request(`http://growthbase.test/receipts/${receiptId}`)
    ).json()) as CommerceReceipt;
    const reconstructed = await reconstructTransaction(harness.database, receiptId);

    expect(receipt.buyerWallet).toBe(alternateSpenderAccount.address);
    expect(receipt.paymentResponse).toMatchObject({ payer: alternateSpenderAccount.address });
    expect(reconstructed.receipt.buyerWallet).toBe(alternateSpenderAccount.address);
    expect(reconstructed.receipt.paymentResponse).toMatchObject({ payer: alternateSpenderAccount.address });
    expect(reconstructed.verification.fullyVerified).toBe(true);
  });

  it("preserves verified payer evidence when artifact generation fails after settlement", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    harness.deps.serviceAdapter.runPaid = vi.fn(async () => {
      throw new GrowthBaseError("ARTIFACT_GENERATION_FAILED", "Live Polymarket order book is stale.", 502, {
        sourceMode: "live",
        marketId: "824952"
      });
    });

    const response = await harness.createPaidFetch(alternateSpenderAccount)(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy: await createSignedPolicy(),
        agentIdentity: createTestAgentIdentity(),
        input: createHiddenEdgeInput({ requestedNotionalUsd: 103 })
      })
    });

    expect(response.status).toBe(502);
    const json = await response.json();

    expect(json).toMatchObject({
      error: {
        code: "PAYMENT_ACCEPTED_ARTIFACT_FAILED",
        message: "Live Polymarket order book is stale.",
        details: {
          executionOutcome: "PAYMENT_ACCEPTED_ARTIFACT_FAILED",
          deliveryStatus: "PAID_BUT_ARTIFACT_FAILED",
          sourceMode: "live",
          marketId: "824952",
          artifactFailureCode: "ARTIFACT_GENERATION_FAILED",
          paymentAccepted: true,
          buyerWallet: alternateSpenderAccount.address,
          durableRecordPersisted: true,
          actualPayerFieldPaths: ["buyerWallet", "paymentResponse.payer"],
          paymentResponse: {
            success: true,
            payer: alternateSpenderAccount.address,
            network: SERVICE_NETWORK
          }
        }
      }
    });

    const failureRecord = getPaidArtifactFailureRecordById(
      harness.database,
      (json as { error: { details: { failureRecordId: string } } }).error.details.failureRecordId
    );

    expect(failureRecord).toMatchObject({
      serviceId: SERVICE_ID,
      buyerWallet: alternateSpenderAccount.address,
      paymentNetwork: SERVICE_NETWORK,
      executionOutcome: "PAYMENT_ACCEPTED_ARTIFACT_FAILED",
      deliveryStatus: "PAID_BUT_ARTIFACT_FAILED",
      failureCode: "ARTIFACT_GENERATION_FAILED",
      failureMessage: "Live Polymarket order book is stale."
    });
    expect(failureRecord?.paymentResponse).toMatchObject({
      payer: alternateSpenderAccount.address
    });
    expect(failureRecord?.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
