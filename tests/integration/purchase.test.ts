import { afterEach, describe, expect, it } from "vitest";

import { hiddenEdgeArtifactSchema, hiddenEdgeProofSchema, SERVICE_ID } from "@growthbase/core";

import { createHiddenEdgeInput, createSignedPolicy, createTestAgentIdentity, createTestHarness } from "../helpers";

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

    const paid = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    expect(paid.status).toBe(200);

    const json = (await paid.json()) as { artifact: unknown; proof: unknown; receiptId: string; deliveryStatus: string };
    const artifact = hiddenEdgeArtifactSchema.parse(json.artifact);
    const proof = hiddenEdgeProofSchema.parse(json.proof);

    expect(json.deliveryStatus).toBe("DELIVERED");
    expect(json.receiptId).toMatch(/^receipt_/);
    expect(artifact.snapshotId).toBe(proof.snapshot_id);
    expect(proof.artifact_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(proof.snapshot_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(proof.request_hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(artifact.candidates[0]).toMatchObject({
      rank: 1
    });
  });
});
