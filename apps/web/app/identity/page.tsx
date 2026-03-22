import { fetchApiJson } from "../../lib/api";

export default async function IdentityPage() {
  const [profile, registration] = await Promise.all([
    fetchApiJson<Record<string, unknown>>("/agent-profile"),
    fetchApiJson<Record<string, unknown>>("/.well-known/agent-registration.json")
  ]);

  return (
    <div className="page">
      <section className="card stack">
        <p className="eyebrow">Identity</p>
        <h2>ERC-8004-compatible profile</h2>
      </section>

      <section className="grid two">
        <div className="card stack">
          <h3>Agent profile</h3>
          <pre className="mono">{JSON.stringify(profile, null, 2)}</pre>
        </div>
        <div className="card stack">
          <h3>Registration JSON</h3>
          <pre className="mono">{JSON.stringify(registration, null, 2)}</pre>
        </div>
      </section>
    </div>
  );
}
