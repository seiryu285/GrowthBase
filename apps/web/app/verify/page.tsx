import type { VerificationReport } from "@growthbase/receipt";

import { getReceiptVerifyApiBaseUrl, LIVE_API_BASE_URL } from "../../lib/site";

function getVerifyBundleFetchBaseUrl(): string {
  const legacy = process.env.NEXT_PUBLIC_RECEIPT_VERIFY_API_URL?.trim();
  const preferred = process.env.NEXT_PUBLIC_RECEIPT_VERIFY_API_BASE_URL?.trim();
  if (preferred) {
    return preferred.replace(/\/$/, "");
  }
  if (legacy) {
    return legacy.replace(/\/$/, "");
  }

  return getReceiptVerifyApiBaseUrl();
}

type VerifyBundleResponse = {
  policy: unknown;
  offer: unknown;
  request: unknown;
  snapshot: unknown;
  artifact: unknown;
  proof: unknown;
  receipt: { receiptId: string };
  growthEntry: unknown;
  verification: {
    fullyVerified: boolean;
    [key: string]: boolean | undefined;
  };
  verificationReport?: VerificationReport;
};

async function loadVerification(
  receiptId: string
): Promise<{ result: VerifyBundleResponse | null; error: string | null }> {
  const base = getVerifyBundleFetchBaseUrl();
  const response = await fetch(`${base}/receipts/${encodeURIComponent(receiptId)}/verify-bundle`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();

    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      const message = parsed.error?.message ?? text;
      return { result: null, error: message || `Verification failed (${response.status})` };
    } catch {
      return { result: null, error: text || `Verification failed (${response.status})` };
    }
  }

  const result = (await response.json()) as VerifyBundleResponse;
  return { result, error: null };
}

function resolveReceiptIdParam(searchParams: Record<string, string | string[] | undefined>): string | undefined {
  const raw = searchParams.receipt_id ?? searchParams.receiptId;
  const receiptId = Array.isArray(raw) ? raw[0] : raw;
  return receiptId?.trim() || undefined;
}

export default async function VerifyPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = (await props.searchParams) ?? {};
  const receiptId = resolveReceiptIdParam(searchParams);

  let result: VerifyBundleResponse | null = null;
  let error: string | null = null;

  if (receiptId) {
    const loaded = await loadVerification(receiptId);
    result = loaded.result;
    error = loaded.error;
  }

  const report = result?.verificationReport;
  const verified = report?.passed ?? result?.verification.fullyVerified;
  const verifyBundleBase = getVerifyBundleFetchBaseUrl();

  return (
    <div className="subpage">
      <section className="subpage-hero">
        <span className="section-label">VERIFY</span>
        <h1 className="subpage-title">Verify a completed purchase receipt</h1>
        <p className="subpage-subtitle">
          Enter the <strong>receipt ID</strong> returned by a successful purchase. The server recomputes hashes from durable
          database state and returns structured pass/fail checks.
        </p>
        <form className="verify-form" method="get">
          <div className="verify-input-wrap">
            <span className="verify-prefix">//</span>
            <input
              name="receiptId"
              defaultValue={receiptId}
              placeholder="Paste receipt ID from a completed purchase"
              className="verify-input"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button className="btn-primary" type="submit">
            Verify
          </button>
        </form>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">Which API this verification uses</h3>
        <p className="subpage-subtitle">
          This page calls{" "}
          <code className="inline-code">
            GET {verifyBundleBase}/receipts/&lt;receiptId&gt;/verify-bundle
          </code>{" "}
          (durable state on the API host only — no local database on this page).
        </p>
        <p className="subpage-subtitle">
          On Vercel, <code className="inline-code">{verifyBundleBase}</code> defaults to the public <strong>live</strong> API (
          <code className="inline-code">{LIVE_API_BASE_URL}</code>) unless you set{" "}
          <code className="inline-code">NEXT_PUBLIC_RECEIPT_VERIFY_API_BASE_URL</code> (or legacy{" "}
          <code className="inline-code">NEXT_PUBLIC_RECEIPT_VERIFY_API_URL</code>).
        </p>
        <p className="subpage-subtitle">
          A receipt exists on <strong>one</strong> API database. To verify a receipt issued against a different base URL (for
          example a local dev API), point the verify base at that host using the env vars above.
        </p>
      </section>

      <section className="subpage-card">
        <h3 className="card-heading">What this page proves</h3>
        <p className="subpage-subtitle">
          <code className="inline-code">/verify</code> is for <strong>receipt-linked verification</strong> after a successful
          purchase: request, snapshot, artifact, proof, and growth linkage. If you need the canonical historical payment proof with
          a transaction hash but no successful live receipt, use <a href="/evidence">/evidence</a>.
        </p>
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

      {result && receiptId && (
        <>
          <section className={`verify-banner ${verified ? "banner-success" : "banner-warning"}`}>
            <span className={`status-dot ${verified ? "status-success" : "status-error"}`} />
            <span className="verify-banner-text">
              {verified ? "All checks passed" : "One or more checks failed"}
              <span className="verify-banner-meta"> — source: {verifyBundleBase}</span>
              {report ? (
                <span className="verify-banner-meta">
                  {" "}
                  — {report.checks.filter((c) => c.pass).length}/{report.checks.length} checks passed
                </span>
              ) : null}
            </span>
          </section>

          {report ? (
            <section className="subpage-card">
              <h3 className="card-heading">Structured checks</h3>
              <p className="subpage-subtitle">
                Overall: <strong>{report.passed ? "pass" : "fail"}</strong>
              </p>
              <ul className="verify-checks">
                {report.checks.map((check) => (
                  <li key={check.id} className="verify-check-row">
                    <code className="inline-code verify-check-id">{check.id}</code>
                    <span className={`verify-check-pass ${check.pass ? "pass" : "fail"}`}>{check.pass ? "pass" : "fail"}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="subpage-grid two">
            {[
              { title: "Receipt", data: result.receipt },
              { title: "Artifact", data: result.artifact },
              { title: "Snapshot + Proof", data: { snapshot: result.snapshot, proof: result.proof } },
              { title: "Policy + Request", data: { policy: result.policy, request: result.request } },
              { title: "Growth entry", data: result.growthEntry }

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

