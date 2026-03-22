import { deriveGrowthHistory } from "@growthbase/growth";

import { getWebDatabase } from "../../../../lib/api";

export default async function GrowthPage({ params }: { params: Promise<{ agentWallet: string }> }) {
  const { agentWallet } = await params;

  let entries: unknown = [];
  let error: string | null = null;

  try {
    const database = await getWebDatabase();
    entries = deriveGrowthHistory(database, agentWallet);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Failed to load growth history.";
    entries = [];
  }

  const count = Array.isArray(entries) ? entries.length : 0;

  return (
    <div className="subpage">
      {/* header */}
      <section className="subpage-hero">
        <span className="section-label">GROW</span>
        <h1 className="subpage-title">Growth history</h1>
        <p className="subpage-subtitle agent-address">
          <span className="address-prefix">Agent</span>
          <code className="address-mono">{agentWallet}</code>
        </p>
        <p className="subpage-subtitle">
          {error
            ? "Unable to connect to database — growth entries are unavailable in this environment."
            : `${count} ${count === 1 ? "entry" : "entries"} derived from receipts — every verified delivery compounds here.`}
        </p>
      </section>

      {/* entries */}
      {error ? (
        <section className="subpage-card error-card">
          <div className="card-heading-row">
            <h3 className="card-heading">Connection error</h3>
            <span className="status-dot status-error" />
          </div>
          <pre className="code-block">{error}</pre>
        </section>
      ) : count > 0 ? (
        <section className="growth-list">
          {(entries as any[]).map((entry: any, i: number) => (
            <div key={i} className="subpage-card growth-entry">
              <div className="card-heading-row">
                <h3 className="card-heading">Entry {i + 1}</h3>
                <span className="card-badge">receipt</span>
              </div>
              <pre className="code-block">{JSON.stringify(entry, null, 2)}</pre>
            </div>
          ))}
        </section>
      ) : (
        <section className="subpage-card">
          <pre className="code-block">{JSON.stringify(entries, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
