import { deriveGrowthHistory } from "@growthbase/growth";

import { getWebDatabase } from "../../../../lib/api";

export default async function GrowthPage({ params }: { params: Promise<{ agentWallet: string }> }) {
  const { agentWallet } = await params;
  const database = await getWebDatabase();
  const entries = deriveGrowthHistory(database, agentWallet);
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
          {count} {count === 1 ? "entry" : "entries"} derived from receipts — every verified delivery compounds here.
        </p>
      </section>

      {/* entries */}
      {count > 0 ? (
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
