import { deriveGrowthHistory } from "@growthbase/growth";

import { getWebDatabase } from "../../../../lib/api";

export default async function GrowthPage({ params }: { params: Promise<{ agentWallet: string }> }) {
  const { agentWallet } = await params;
  const database = await getWebDatabase();
  const entries = deriveGrowthHistory(database, agentWallet);

  return (
    <div className="page">
      <section className="card stack">
        <p className="eyebrow">Growth history</p>
        <h2>{agentWallet}</h2>
        <p className="muted">Entries are derived from receipts only, with optional summary fields from the hidden-edge artifact.</p>
      </section>

      <section className="card stack">
        <pre className="mono">{JSON.stringify(entries, null, 2)}</pre>
      </section>
    </div>
  );
}
