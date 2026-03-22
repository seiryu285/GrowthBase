import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">P0 closed loop</p>
        <h2>One policy. One paid Polymarket hidden-edge scan. One typed artifact. One append-only receipt spine.</h2>
        <p className="muted">
          GrowthBase remains the commerce and trust substrate while Hidden Edge Scan becomes the first flagship paid service on top of it.
        </p>
      </section>

      <section className="grid two">
        <div className="card stack">
          <span className="pill">Human</span>
          <h3>Create and sign one DelegationPolicy</h3>
          <p className="muted">Use an injected wallet to sign the single canonical policy object.</p>
          <Link className="button" href="/policy">
            Open policy page
          </Link>
        </div>

        <div className="card stack">
          <span className="pill">Verifier</span>
          <h3>Reconstruct one full transaction</h3>
          <p className="muted">Load a receipt, recompute request, snapshot, artifact, and proof hashes, and verify the full linkage.</p>
          <Link className="button" href="/verify">
            Open verification
          </Link>
        </div>

        <div className="card stack">
          <span className="pill">Growth</span>
          <h3>Derived history only</h3>
          <p className="muted">Growth entries are still projected from receipts on read, with cheap summary fields from the delivered scan.</p>
          <Link className="button secondary" href="/agents/0x3333333333333333333333333333333333333333/growth">
            View sample growth
          </Link>
        </div>

        <div className="card stack">
          <span className="pill">Identity</span>
          <h3>ERC-8004-compatible discovery</h3>
          <p className="muted">Expose the agent profile and registration JSON without making payment depend on it.</p>
          <Link className="button secondary" href="/identity">
            View identity
          </Link>
        </div>
      </section>
    </div>
  );
}
