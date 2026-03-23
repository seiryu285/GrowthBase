import Link from "next/link";

import { loadLatestArtifact, loadLiveReadiness } from "../../lib/liveDemo";
import { LIVE_API_BASE_URL, REPO_DOC_BLOB_BASE } from "../../lib/site";

export default async function LivePage() {
  const offersUrl = `${LIVE_API_BASE_URL}/offers`;
  const specUrl = `${LIVE_API_BASE_URL}/purchase/polymarket-hidden-edge-scan`;
  const readinessUrl = `${LIVE_API_BASE_URL}/offers/polymarket-hidden-edge-scan/live-readiness`;
  const latestArtifactUrl = `${LIVE_API_BASE_URL}/offers/polymarket-hidden-edge-scan/latest-artifact`;
  const rootUrl = `${LIVE_API_BASE_URL}/`;
  const readiness = await loadLiveReadiness();
  const latestArtifact = await loadLatestArtifact();

  return (
    <div className="subpage">
      <section className="subpage-hero">
        <span className="section-label">LIVE API</span>
        <h1 className="subpage-title">Production purchase API (live market mode)</h1>
        <p className="subpage-subtitle">
          The Railway host runs <strong>MARKET_DATA_MODE=live</strong>. Stale or unserviceable Polymarket state should fail{" "}
          <strong>before settlement</strong> with <code className="inline-code">503 PRE_PAYMENT_SERVICEABILITY_FAILED</code> when
          knowable — not silently downgraded to fixture data.
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Base URL</h3>
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
              GET /purchase/polymarket-hidden-edge-scan
            </a>
          </li>
          <li>
            <a href={readinessUrl} target="_blank" rel="noreferrer">
              GET /offers/polymarket-hidden-edge-scan/live-readiness
            </a>
          </li>
          <li>
            <a href={latestArtifactUrl} target="_blank" rel="noreferrer">
              GET /offers/polymarket-hidden-edge-scan/latest-artifact
            </a>
          </li>
        </ul>
      </section>

      <section className="subpage-card">
        <div className="card-heading-row">
          <h3 className="card-heading">Live readiness right now</h3>
          <span className={`status-dot ${readiness.data?.readiness.ok ? "status-success" : "status-error"}`} />
        </div>
        {readiness.error ? (
          <p className="subpage-subtitle">{readiness.error}</p>
        ) : (
          <>
            <p className="subpage-subtitle">
              {readiness.data?.readiness.ok
                ? "The current recommended live input passed the pre-payment gate."
                : readiness.data?.readiness.message}
            </p>
            <pre className="code-block">{JSON.stringify(readiness.data, null, 2)}</pre>
          </>
        )}
      </section>

      <section className="subpage-card">
        <div className="card-heading-row">
          <h3 className="card-heading">Latest stored successful artifact</h3>
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
              Open <Link href="/latest-artifact">/latest-artifact</Link> to inspect the ranking, or jump straight to{" "}
              <Link href={`/verify?receiptId=${encodeURIComponent(latestArtifact.data?.receiptId ?? "")}`}>/verify</Link>.
            </p>
          </>
        )}
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">External proof (CLI)</h3>
        <p className="subpage-subtitle">
          <code className="inline-code">PROOF_TARGET=live</code>,{" "}
          <code className="inline-code">API_BASE_URL={LIVE_API_BASE_URL}</code>,{" "}
          <code className="inline-code">GROWTHBASE_SPENDER_PRIVATE_KEY=0x…</code> (funded Base USDC),{" "}
          <code className="inline-code">pnpm.cmd proof:external</code>
        </p>
        <p className="subpage-subtitle">
          Runbook:{" "}
          <a href={`${REPO_DOC_BLOB_BASE}/docs/runbook.md`} target="_blank" rel="noreferrer">
            docs/runbook.md
          </a>
        </p>
        <p className="subpage-subtitle">
          Canonical historical payment proof for the video: tx hash{" "}
          <code className="inline-code">0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e</code>. Use{" "}
          <Link href="/evidence">/evidence</Link> for the bundle path and honest explanation.
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Reviewer demo path</h3>
        <p className="subpage-subtitle">
          <Link href="/demo">/demo</Link> is a guided walkthrough over this same public live host (not a separate deterministic
          public API). It does not change how the API runs.
        </p>
        <p className="subpage-subtitle">
          If current live market conditions are stale, the honest outcome is a visible{" "}
          <code className="inline-code">503 PRE_PAYMENT_SERVICEABILITY_FAILED</code> rather than a hidden switch to fixture data.
        </p>
        <p className="subpage-subtitle">
          A practical browser flow is: readiness check, purchase spec, <Link href="/latest-artifact">latest live artifact</Link>,
          then <Link href="/verify">verify</Link>.
        </p>
      </section>
    </div>
  );
}
