import Link from "next/link";

import {
  CANONICAL_SITE_URL,
  LIVE_API_BASE_URL,
  RECEIPT_ANCHOR_ADDRESS,
  REPO_DOC_BLOB_BASE,
  getReceiptAnchorExplorerUrl
} from "../../lib/site";

const canonicalPaymentProof = {
  txHash: "0x436ecfefe0a4fea553e85350ca2d44ee5ee9d2c193d6b4d1264fd66bf66efe6e",
  bundlePath: "data/proofs/external-purchase-proof-railway-live-funded.latest.json",
  explanationPath: "docs/external-purchase-proof.md"
} as const;

const proofArtifacts: { path: string; label: string }[] = [
  {
    path: canonicalPaymentProof.bundlePath,
    label: "Canonical historical payment proof on the public Railway host (accepted payment + transaction-hash evidence)",
  },
  {
    path: "data/proofs/external-purchase-proof-railway-live-submission-2026-03-23.latest.json",
    label: "Current live submission-labeled proof (pre-charge 503 fail-closed outcome)",
  },
  {
    path: "data/proofs/external-purchase-proof-public-fixture-postdeploy-2026-03-23.latest.json",
    label: "Historical fixture-host success bundle for offline-repeatable comparison (not a public production host)",
  },
];

const agentLogs = [
  "docs/agent-logs/2026-03-23-post-deploy-public-evidence.md",
  "docs/agent-logs/2026-03-23-submission-evidence-closure.md",
  "docs/agent-logs/2026-03-23-prepayment-serviceability-paid-failure-demo-path.md",
];

export default function EvidencePage() {
  const receiptAnchorExplorerUrl = getReceiptAnchorExplorerUrl();

  return (
    <div className="subpage">
      <section className="subpage-hero">
        <span className="section-label">PUBLIC EVIDENCE</span>
        <h1 className="subpage-title">Proof bundles &amp; agent logs</h1>
        <p className="subpage-subtitle">
          Canonical marketing URL for the project:{" "}
          <a href={CANONICAL_SITE_URL} target="_blank" rel="noreferrer">
            {CANONICAL_SITE_URL}
          </a>
          . The public purchase API is the <strong>live</strong> Railway host:{" "}
          <code className="inline-code">{LIVE_API_BASE_URL}</code>.
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Submission overview</h3>
        <p className="subpage-subtitle">
          One-page honest summary of live vs demo vs evidence:{" "}
          <a href={`${REPO_DOC_BLOB_BASE}/docs/SUBMISSION.md`} target="_blank" rel="noreferrer">
            docs/SUBMISSION.md
          </a>
          .
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Canonical payment proof for the demo video</h3>
        <p className="subpage-subtitle">
          Use this one historical example consistently when you need a reviewer-facing payment proof from the public Railway host.
        </p>
        <p className="subpage-subtitle">
          Transaction hash evidence: <code className="inline-code">{canonicalPaymentProof.txHash}</code>
        </p>
        <p className="subpage-subtitle">
          Proof bundle:{" "}
          <a href={`${REPO_DOC_BLOB_BASE}/${canonicalPaymentProof.bundlePath}`} target="_blank" rel="noreferrer">
            {canonicalPaymentProof.bundlePath}
          </a>
        </p>
        <p className="subpage-subtitle">
          Explanation path:{" "}
          <a href={`${REPO_DOC_BLOB_BASE}/${canonicalPaymentProof.explanationPath}`} target="_blank" rel="noreferrer">
            {canonicalPaymentProof.explanationPath}
          </a>
        </p>
        <p className="subpage-subtitle">
          Scope: this proves accepted payment and transaction-hash evidence on the public Railway host. It does <strong>not</strong>{" "}
          prove successful live artifact delivery under current market conditions.
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">ReceiptAnchor contract proof</h3>
        <p className="subpage-subtitle">
          <code className="inline-code">ReceiptAnchor</code> is the optional on-chain trust layer for anchoring{" "}
          <code className="inline-code">receiptHash</code>,{" "}
          <code className="inline-code">policyHash</code>, and <code className="inline-code">artifactHash</code>. It complements
          the main verify-bundle flow rather than replacing it.
        </p>
        <p className="subpage-subtitle">
          Source contract:{" "}
          <a href={`${REPO_DOC_BLOB_BASE}/contracts/ReceiptAnchor.sol`} target="_blank" rel="noreferrer">
            contracts/ReceiptAnchor.sol
          </a>
        </p>
        {RECEIPT_ANCHOR_ADDRESS ? (
          <>
            <p className="subpage-subtitle">
              Contract address: <code className="inline-code">{RECEIPT_ANCHOR_ADDRESS}</code>
            </p>
            {receiptAnchorExplorerUrl ? (
              <p className="subpage-subtitle">
                Explorer:{" "}
                <a href={receiptAnchorExplorerUrl} target="_blank" rel="noreferrer">
                  {receiptAnchorExplorerUrl}
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <p className="subpage-subtitle">
            This deployment has not published a public <code className="inline-code">ReceiptAnchor</code> address yet. The repo
            is wired to surface it here once Vercel sets <code className="inline-code">NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS</code>.
          </p>
        )}
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Agent logs (append-only)</h3>
        <ul className="link-list">
          {agentLogs.map((p) => (
            <li key={p}>
              <a href={`${REPO_DOC_BLOB_BASE}/${p}`} target="_blank" rel="noreferrer">
                {p}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Additional proof JSON (repo paths)</h3>
        <p className="subpage-subtitle">
          Open on GitHub for machine-readable request/response evidence. Labels describe what each bundle represents — they are
          not interchangeable as &quot;live success&quot; proofs.
        </p>
        <ul className="link-list">
          {proofArtifacts.map(({ path: p, label }) => (
            <li key={p}>
              <a href={`${REPO_DOC_BLOB_BASE}/${p}`} target="_blank" rel="noreferrer">
                {p}
              </a>
              <span className="evidence-label"> — {label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Documentation</h3>
        <ul className="link-list">
          <li>
            <a href={`${REPO_DOC_BLOB_BASE}/docs/runbook.md`} target="_blank" rel="noreferrer">
              docs/runbook.md
            </a>
          </li>
          <li>
            <a href={`${REPO_DOC_BLOB_BASE}/docs/external-purchase-proof.md`} target="_blank" rel="noreferrer">
              docs/external-purchase-proof.md
            </a>
          </li>
          <li>
            <a href={`${REPO_DOC_BLOB_BASE}/docs/conversation-log.md`} target="_blank" rel="noreferrer">
              docs/conversation-log.md
            </a>
          </li>
        </ul>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">On-site tools</h3>
        <ul className="link-list">
          <li>
            <Link href="/policy">Policy signer (AI-agent delegation boundary)</Link>
          </li>
          <li>
            <Link href="/identity">Identity JSON (ERC-8004-compatible agent surface)</Link>
          </li>
          <li>
            <Link href="/live">Live API notes</Link>
          </li>
          <li>
            <Link href="/demo">Reviewer demo (guided path over the live public API)</Link>
          </li>
          <li>
            <Link href="/verify">Verify receipt (verify-bundle via configured API base; defaults to Live on Vercel)</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
