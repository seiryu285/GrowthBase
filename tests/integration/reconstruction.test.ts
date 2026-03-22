import { afterEach, describe, expect, it } from "vitest";

import { SERVICE_ID } from "@growthbase/core";
import { reconstructTransaction } from "@growthbase/receipt";

import { createHiddenEdgeInput, createSignedPolicy, createTestAgentIdentity, createTestHarness } from "../helpers";

describe("reconstruction", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("reconstructs a full verified hidden-edge transaction", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const body = {
      policy: await createSignedPolicy(),
      agentIdentity: createTestAgentIdentity(),
      input: createHiddenEdgeInput()
    };

    const paid = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const { receiptId } = (await paid.json()) as { receiptId: string };
    const receiptResponse = await harness.app.request(`http://growthbase.test/receipts/${receiptId}`);
    const receipt = (await receiptResponse.json()) as Record<string, unknown>;
    const reconstructed = await reconstructTransaction(harness.database, receiptId);

    expect(receiptResponse.status).toBe(200);
    expect(receipt.serviceId).toBe(SERVICE_ID);
    expect(receipt.requestHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.artifactHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.snapshotHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.proofHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(receipt.agentIdentity).toMatchObject({
      agentWallet: body.policy.agentWallet
    });
    expect(reconstructed.receipt.receiptId).toBe(receiptId);
    expect(reconstructed.request.serviceId).toBe(SERVICE_ID);
    expect(reconstructed.snapshot.snapshotId).toBe(reconstructed.artifact.snapshotId);
    expect(reconstructed.proof.snapshot_id).toBe(reconstructed.snapshot.snapshotId);
    expect(reconstructed.verification.fullyVerified).toBe(true);
  });
});
