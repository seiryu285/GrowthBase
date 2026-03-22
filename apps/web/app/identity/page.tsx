import { fetchApiJson } from "../../lib/api";

export default async function IdentityPage() {
  let profile: Record<string, unknown> | null = null;
  let registration: Record<string, unknown> | null = null;
  let error: string | null = null;

  try {
    [profile, registration] = await Promise.all([
      fetchApiJson<Record<string, unknown>>("/agent-profile"),
      fetchApiJson<Record<string, unknown>>("/.well-known/agent-registration.json")
    ]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to fetch identity data.";
  }

  return (
    <div className="subpage">
      {/* header */}
      <section className="subpage-hero">
        <span className="section-label">DISCOVER</span>
        <h1 className="subpage-title">ERC-8004-compatible identity</h1>
        <p className="subpage-subtitle">
          {error
            ? "API unavailable — identity data cannot be loaded in this environment."
            : "Agent profile and registration JSON — exposed for network-wide discovery without coupling to payment."}
        </p>
      </section>

      {error ? (
        <section className="subpage-card error-card">
          <div className="card-heading-row">
            <h3 className="card-heading">Connection error</h3>
            <span className="status-dot status-error" />
          </div>
          <pre className="code-block">{error}</pre>
        </section>
      ) : (
        <section className="subpage-grid two">
          <div className="subpage-card">
            <div className="card-heading-row">
              <h3 className="card-heading">Agent profile</h3>
              <span className="card-badge">/agent-profile</span>
            </div>
            <pre className="code-block">{JSON.stringify(profile, null, 2)}</pre>
          </div>
          <div className="subpage-card">
            <div className="card-heading-row">
              <h3 className="card-heading">Registration JSON</h3>
              <span className="card-badge">/.well-known</span>
            </div>
            <pre className="code-block">{JSON.stringify(registration, null, 2)}</pre>
          </div>
        </section>
      )}
    </div>
  );
}
