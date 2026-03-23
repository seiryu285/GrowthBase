import Link from "next/link";

import { PurchaseReceiptActions } from "../../components/PurchaseReceiptActions";
import { loadLatestArtifact } from "../../lib/liveDemo";

export default async function LatestArtifactPage() {
  const { data, error } = await loadLatestArtifact();
  const bundle = data?.bundle ?? null;

  return (
    <div className="subpage">
      <section className="subpage-hero">
        <span className="section-label">LATEST LIVE ARTIFACT</span>
        <h1 className="subpage-title">Most recent delivered Hidden Edge result</h1>
        <p className="subpage-subtitle">
          This page shows the latest successful live receipt currently stored on the public API, then expands its Polymarket-derived
          ranking, proof, and linkage.
        </p>
      </section>

      {error ? (
        <section className="subpage-card error-card">
          <div className="card-heading-row">
            <h3 className="card-heading">Latest artifact unavailable</h3>
            <span className="status-dot status-error" />
          </div>
          <p className="subpage-subtitle">{error}</p>
          <p className="subpage-subtitle">
            Run a successful live purchase first, then reopen this page. If live readiness is currently poor, use{" "}
            <Link href="/live">/live</Link> to inspect the gate state before retrying.
          </p>
        </section>
      ) : null}

      {data && bundle ? (
        <>
          <section className="verify-banner banner-success">
            <span className="status-dot status-success" />
            <span className="verify-banner-text">
              Receipt <code className="inline-code">{data.receiptId}</code> captured at{" "}
              <code className="inline-code">{data.timestamp}</code>
            </span>
          </section>

          <section className="subpage-card">
            <div className="card-heading-row">
              <h3 className="card-heading">After a successful purchase</h3>
              <span className="card-badge">browser path</span>
            </div>
            <p className="subpage-subtitle">
              Copy the receipt ID or open verification. You can also return to <Link href="/demo">/demo</Link> for the full
              reviewer sequence.
            </p>
            <PurchaseReceiptActions receiptId={data.receiptId} />
          </section>

          <section className="subpage-grid two">
            {[
              { title: "Artifact", data: bundle.artifact },
              { title: "Ranking candidates", data: bundle.artifact.candidates },
              { title: "Receipt", data: bundle.receipt },
              { title: "Snapshot + Proof", data: { snapshot: bundle.snapshot, proof: bundle.proof } },
              { title: "Policy + Request", data: { policy: bundle.policy, request: bundle.request } },
              { title: "Growth entry", data: bundle.growthEntry }
            ].map((section) => (
              <div key={section.title} className="subpage-card">
                <h3 className="card-heading">{section.title}</h3>
                <pre className="code-block">{JSON.stringify(section.data, null, 2)}</pre>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
