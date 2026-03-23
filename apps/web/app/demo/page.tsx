import Link from "next/link";

import { loadLatestArtifact, loadLiveReadiness } from "../../lib/liveDemo";
import { CANONICAL_SITE_URL, LIVE_API_BASE_URL, REPO_DOC_BLOB_BASE } from "../../lib/site";

export default async function DemoPage() {
  const offersUrl = `${LIVE_API_BASE_URL}/offers`;
  const specUrl = `${LIVE_API_BASE_URL}/purchase/polymarket-hidden-edge-scan`;
  const readinessUrl = `${LIVE_API_BASE_URL}/offers/polymarket-hidden-edge-scan/live-readiness`;
  const rootUrl = `${LIVE_API_BASE_URL}/`;
  const readiness = await loadLiveReadiness();
  const latestArtifact = await loadLatestArtifact();

  return (
    <div className="subpage">
      <section className="subpage-hero">
        <span className="section-label">REVIEWER DEMO</span>
        <h1 className="subpage-title">Guided path over the public live API</h1>
        <p className="subpage-subtitle">
          This page is a <strong>reviewer-facing walkthrough</strong> for the same public Railway host as{" "}
          <Link href="/live">Live</Link>. It uses <strong>MARKET_DATA_MODE=live</strong> — outcomes depend on real upstream
          market state, funding, and serviceability checks. You may see <code className="inline-code">503</code>{" "}
          <code className="inline-code">PRE_PAYMENT_SERVICEABILITY_FAILED</code> when the live book is not serviceable; that is
          fail-closed behavior, not a scripted fixture.
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Public live API base</h3>
        <p className="subpage-subtitle">
          <code className="inline-code">{LIVE_API_BASE_URL}</code>
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Quick links</h3>
        <ul className="link-list">
          <li>
            <a href={rootUrl} target="_blank" rel="noreferrer">
              GET / (API identity)
            </a>
          </li>
          <li>
            <a href={offersUrl} target="_blank" rel="noreferrer">
              GET /offers
            </a>
          </li>
          <li>
            <a href={specUrl} target="_blank" rel="noreferrer">
              GET /purchase/polymarket-hidden-edge-scan (purchase spec)
            </a>
          </li>
          <li>
            <a href={readinessUrl} target="_blank" rel="noreferrer">
              GET /offers/polymarket-hidden-edge-scan/live-readiness
            </a>
          </li>
        </ul>
      </section>

      <section className="subpage-card">
        <div className="card-heading-row">
          <h3 className="card-heading">Step 1. Confirm live readiness</h3>
          <span className={`status-dot ${readiness.data?.readiness.ok ? "status-success" : "status-error"}`} />
        </div>
        {readiness.error ? (
          <p className="subpage-subtitle">{readiness.error}</p>
        ) : (
          <>
            <p className="subpage-subtitle">
              {readiness.data?.readiness.ok
                ? "The public live host currently passes the pre-payment gate for its recommended input."
                : readiness.data?.readiness.message}
            </p>
            <pre className="code-block">{JSON.stringify(readiness.data, null, 2)}</pre>
          </>
        )}
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Recommended video sequence</h3>
        <p className="subpage-subtitle">
          Show the product story in this order: <Link href="/policy">Policy</Link>, <Link href="/identity">Identity</Link>, live{" "}
          readiness, live <code className="inline-code">/offers</code>, live purchase spec,{" "}
          <Link href="/latest-artifact">Latest Artifact</Link>, <Link href="/verify">Verify</Link>, then{" "}
          <Link href="/evidence">Evidence</Link> for the canonical payment-proof bundle and limitation note.
        </p>
      </section>

      <section className="subpage-card">
        <div className="card-heading-row">
          <h3 className="card-heading">Step 2. Show the latest live artifact</h3>
          <span className={`status-dot ${latestArtifact.data ? "status-success" : "status-error"}`} />
        </div>
        {latestArtifact.error ? (
          <p className="subpage-subtitle">{latestArtifact.error}</p>
        ) : (
          <>
            <p className="subpage-subtitle">
              Latest delivered receipt: <code className="inline-code">{latestArtifact.data?.receiptId}</code>
            </p>
            <p className="subpage-subtitle">
              Open <Link href="/latest-artifact">/latest-artifact</Link> to show the Polymarket-derived ranking, then continue to{" "}
              <Link href={`/verify?receiptId=${encodeURIComponent(latestArtifact.data?.receiptId ?? "")}`}>/verify</Link> for full
              hash linkage.
            </p>
          </>
        )}
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">External proof (CLI)</h3>
        <p className="subpage-subtitle">
          For submission-style evidence against this host: <code className="inline-code">PROOF_TARGET=live</code>,{" "}
          <code className="inline-code">API_BASE_URL={LIVE_API_BASE_URL}</code>, funded Base USDC,{" "}
          <code className="inline-code">pnpm.cmd proof:external</code>. Full commands:{" "}
          <a href={`${REPO_DOC_BLOB_BASE}/docs/runbook.md`} target="_blank" rel="noreferrer">
            docs/runbook.md
          </a>
          .
        </p>
        <p className="subpage-subtitle">
          Operators can also run <code className="inline-code">PROOF_TARGET=deterministic-demo</code> against an{" "}
          <strong>explicit</strong> <code className="inline-code">MARKET_DATA_MODE=fixture</code> host (local or tunnel) for
          offline-repeatable bundles — that path is documented in the runbook and does <strong>not</strong> imply a second
          public Railway service.
        </p>
        <p className="subpage-subtitle">
          Canonical public payment-proof example for the demo video: tx hash{" "}
          <code className="inline-code">0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e</code> with its
          historical funded Railway bundle documented on <Link href="/evidence">/evidence</Link>.
        </p>
        <p className="subpage-subtitle">
          Site entrypoint:{" "}
          <a href={CANONICAL_SITE_URL} target="_blank" rel="noreferrer">
            {CANONICAL_SITE_URL}
          </a>
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Related</h3>
        <ul className="link-list">
          <li>
            <Link href="/live">Live API (same host, detailed notes)</Link>
          </li>
          <li>
            <Link href="/verify">Verify receipt (defaults to live verify-bundle on Vercel)</Link>
          </li>
          <li>
            <Link href="/latest-artifact">Latest live artifact</Link>
          </li>
          <li>
            <Link href="/evidence">Public evidence &amp; agent logs</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
