import { afterEach, describe, expect, it } from "vitest";

import { SERVICE_ID } from "@growthbase/core";
import { deriveGrowthHistory } from "@growthbase/growth";

import { createHiddenEdgeInput, createSignedPolicy, createTestAgentIdentity, createTestHarness } from "../helpers";

describe("growth history and replay", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it("derives growth history from receipts only, including cheap summary fields", async () => {
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
    const entries = deriveGrowthHistory(harness.database, body.policy.agentWallet);
    const routeResponse = await harness.app.request(`http://growthbase.test/agents/${body.policy.agentWallet}/growth-history`);
    const routeBody = (await routeResponse.json()) as { entries: typeof entries };

    expect(entries).toHaveLength(1);
    expect(entries[0]?.receiptId).toBe(receiptId);
    expect(entries[0]?.serviceId).toBe(SERVICE_ID);
    expect(entries[0]?.candidatesReturned).toBeGreaterThan(0);
    expect(entries[0]?.topCandidateAction).toBeDefined();
    expect(entries[0]?.topCandidateScore).toBeTypeOf("number");
    expect(routeBody.entries[0]?.receiptId).toBe(receiptId);
  });

  it("replays canonical results from the persisted snapshot instead of re-fetching upstream data", async () => {
    const harness = await createTestHarness();
    cleanups.push(harness.close);

    const body = {
      policy: await createSignedPolicy(),
      agentIdentity: createTestAgentIdentity(),
      input: createHiddenEdgeInput()
    };

    const first = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const firstJson = (await first.json()) as { artifact: { scanId: string }; proof: { artifact_hash: string; snapshot_hash: string } };

    expect(harness.tracker.discoveryCalls).toBe(1);
    expect(harness.tracker.marketDataCalls).toBe(1);

    const second = await harness.paidFetch(`http://growthbase.test/purchase/${SERVICE_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const secondJson = (await second.json()) as { artifact: { scanId: string }; proof: { artifact_hash: string; snapshot_hash: string } };

    expect(harness.tracker.discoveryCalls).toBe(1);
    expect(harness.tracker.marketDataCalls).toBe(1);
    expect(harness.deps.serviceAdapter.metrics.idempotentReplayCount).toBe(1);
    expect(firstJson.artifact.scanId).toBe(secondJson.artifact.scanId);
    expect(firstJson.proof.artifact_hash).toBe(secondJson.proof.artifact_hash);
    expect(firstJson.proof.snapshot_hash).toBe(secondJson.proof.snapshot_hash);
  });
});
