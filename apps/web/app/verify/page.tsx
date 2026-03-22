import { reconstructTransaction } from "@growthbase/receipt";

import { getWebDatabase } from "../../lib/api";

export default async function VerifyPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = (await props.searchParams) ?? {};
  const rawReceiptId = searchParams.receiptId;
  const receiptId = Array.isArray(rawReceiptId) ? rawReceiptId[0] : rawReceiptId;

  let result: Awaited<ReturnType<typeof reconstructTransaction>> | null = null;
  let error: string | null = null;

  if (receiptId) {
    try {
      const database = await getWebDatabase();
      result = await reconstructTransaction(database, receiptId);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Verification failed.";
    }
  }

  return (
    <div className="page">
      <section className="card stack">
        <p className="eyebrow">Receipt verification</p>
        <h2>Reconstruct one full transaction</h2>
        <form className="actions" method="get">
          <input name="receiptId" defaultValue={receiptId} placeholder="receipt_..." />
          <button className="button" type="submit">
            Verify
          </button>
        </form>
      </section>

      {error ? (
        <section className="card stack">
          <h3>Verification error</h3>
          <p className="muted">{error}</p>
        </section>
      ) : null}

      {result ? (
        <section className="grid two">
          <div className="card stack">
            <h3>Verification status</h3>
            <span className="pill">{result.verification.fullyVerified ? "Fully verified" : "Verification mismatch"}</span>
            <pre className="mono">{JSON.stringify(result.verification, null, 2)}</pre>
          </div>
          <div className="card stack">
            <h3>Receipt</h3>
            <pre className="mono">{JSON.stringify(result.receipt, null, 2)}</pre>
          </div>
          <div className="card stack">
            <h3>Artifact</h3>
            <pre className="mono">{JSON.stringify(result.artifact, null, 2)}</pre>
          </div>
          <div className="card stack">
            <h3>Snapshot + proof</h3>
            <pre className="mono">{JSON.stringify({ snapshot: result.snapshot, proof: result.proof }, null, 2)}</pre>
          </div>
          <div className="card stack">
            <h3>Policy + request + growth</h3>
            <pre className="mono">{JSON.stringify({ policy: result.policy, request: result.request, growth: result.growthEntry }, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}
