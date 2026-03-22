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

  const verified = result?.verification.fullyVerified;

  return (
    <div className="subpage">
      {/* header */}
      <section className="subpage-hero">
        <span className="section-label">VERIFY</span>
        <h1 className="subpage-title">Reconstruct one full transaction</h1>
        <p className="subpage-subtitle">
          Recompute request, snapshot, artifact, and proof hashes — then verify full linkage.
        </p>
        <form className="verify-form" method="get">
          <div className="verify-input-wrap">
            <span className="verify-prefix">//</span>
            <input
              name="receiptId"
              defaultValue={receiptId}
              placeholder="receipt_..."
              className="verify-input"
            />
          </div>
          <button className="btn-primary" type="submit">
            Verify
          </button>
        </form>
      </section>

      {error && (
        <section className="subpage-card error-card">
          <div className="card-heading-row">
            <h3 className="card-heading">Verification error</h3>
            <span className="status-dot status-error" />
          </div>
          <p className="subpage-subtitle">{error}</p>
        </section>
      )}

      {result && (
        <>
          {/* verification status banner */}
          <section className={`verify-banner ${verified ? "banner-success" : "banner-warning"}`}>
            <span className={`status-dot ${verified ? "status-success" : "status-error"}`} />
            <span className="verify-banner-text">
              {verified ? "Fully verified — all hashes match" : "Verification mismatch detected"}
            </span>
          </section>

          {/* detail grid */}
          <section className="subpage-grid two">
            {[
              { title: "Verification", data: result.verification },
              { title: "Receipt", data: result.receipt },
              { title: "Artifact", data: result.artifact },
              { title: "Snapshot + Proof", data: { snapshot: result.snapshot, proof: result.proof } },
              { title: "Policy + Request", data: { policy: result.policy, request: result.request } },
              { title: "Growth entry", data: result.growthEntry },
            ].map((section) => (
              <div key={section.title} className="subpage-card">
                <h3 className="card-heading">{section.title}</h3>
                <pre className="code-block">{JSON.stringify(section.data, null, 2)}</pre>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
