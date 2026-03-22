import Link from "next/link";
import type { CSSProperties } from "react";

/* ─── generative bar data ──────────────────────────────────────────────────── */

type Bar = { x: number; h: number; accent: boolean; w: number };

function makeBars(
  count: number,
  heightFn: (i: number, t: number) => number,
  accentFn: (i: number) => boolean,
): Bar[] {
  const span = 380;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return {
      x: 10 + (i * span) / (count - 1),
      h: Math.max(6, Math.min(310, Math.round(heightFn(i, t)))),
      accent: accentFn(i),
      w: 2.8 + Math.sin(i * 0.7) * 0.8,
    };
  });
}

// DELEGATE — organic double-peak wave, permission boundaries
const delegateBars = makeBars(
  40,
  (_, t) =>
    40 +
    200 * Math.abs(Math.sin(Math.PI * t * 2.4)) *
      (0.5 + 0.5 * Math.cos(Math.PI * t * 0.9)) +
    30 * Math.sin(t * 16),
  (i) => i % 3 !== 1,
);

// VERIFY — structured precision lattice with central mass
const verifyBars = makeBars(
  36,
  (i, t) => {
    const center = Math.abs(t - 0.5) * 2;
    return 20 + 220 * (1 - center * center) * (0.7 + 0.3 * Math.sin(i * 1.4)) + 15 * Math.cos(i * 0.8);
  },
  (i) => i % 4 <= 2,
);

// GROW — exponential ascent, compounding history
const growBars = makeBars(
  38,
  (i, t) =>
    10 + 260 * Math.pow(t, 1.5) * (0.85 + 0.15 * Math.sin(i * 0.7)) +
    10 * Math.sin(i * 2.1),
  (i) => i >= 18 || i % 2 === 0,
);

// DISCOVER — golden-ratio resonance, emergent pattern
const discoverBars = makeBars(
  34,
  (i, t) =>
    35 +
    120 * Math.abs(Math.sin(i * 1.618033988)) +
    60 * Math.abs(Math.cos(i * 0.618)) +
    20 * Math.sin(i * 3.2) +
    40 * t,
  (i) => i % 3 !== 0,
);

/* ─── generative SVG ───────────────────────────────────────────────────────── */

function BarViz({
  data,
  color,
  ghost = "rgba(0,0,0,0.06)",
}: {
  data: Bar[];
  color: string;
  ghost?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 340"
      className="bar-viz"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
      {data.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={340 - b.h - 10}
          width={b.w}
          height={b.h}
          rx={b.w / 2}
          fill={b.accent ? color : ghost}
          style={{ "--i": i } as CSSProperties}
          className="bar"
        />
      ))}
    </svg>
  );
}

/* ─── pillar config ────────────────────────────────────────────────────────── */

const pillars = [
  {
    label: "DELEGATE",
    color: "#22c55e",
    ghost: "rgba(34,197,94,0.08)",
    data: delegateBars,
    description: "Safe permission controls for human → agent work delegation",
    href: "/policy",
  },
  {
    label: "VERIFY",
    color: "#f472b6",
    ghost: "rgba(244,114,182,0.08)",
    data: verifyBars,
    description: "Cryptographic proof that every deliverable is real",
    href: "/verify",
  },
  {
    label: "GROW",
    color: "#d4a053",
    ghost: "rgba(212,160,83,0.08)",
    data: growBars,
    description: "Every verified delivery compounds into trust and capability",
    href: "/agents/0x3333333333333333333333333333333333333333/growth",
  },
  {
    label: "DISCOVER",
    color: "#3b82f6",
    ghost: "rgba(59,130,246,0.08)",
    data: discoverBars,
    description: "Track record drives discoverability across the network",
    href: "/identity",
  },
];

/* ─── page ─────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="page-root">
      {/* hero */}
      <section className="hero">
        <h1 className="hero-title">
          The substrate where
          <br />
          every verified delivery
          <br />
          makes the agent stronger.
        </h1>
        <p className="hero-sub">
          Humans delegate work to AI agents — but lack safe permissions,
          real-time cost tracking, and verifiable proof. Agents that deliver
          reliably have no way to compound that history into trust.
          <br />
          <span className="hero-em">Growth Base is designed to be that foundation.</span>
        </p>
      </section>

      {/* pillar grid */}
      <section className="pillar-grid">
        {pillars.map((p) => (
          <Link key={p.label} href={p.href} className="pillar-card">
            <span className="pillar-label">{p.label}</span>
            <div className="pillar-viz">
              <BarViz data={p.data} color={p.color} ghost={p.ghost} />
            </div>
            <p className="pillar-desc">{p.description}</p>
          </Link>
        ))}
      </section>

      {/* substrate statement */}
      <section className="substrate">
        <div className="substrate-inner">
          <p className="substrate-text">
            A layer where permission control, cost tracking, and verifiable
            receipts are primitives — not afterthoughts. The services on top
            change. The substrate remains.
          </p>
          <div className="substrate-line" />
        </div>
      </section>

      {/* bottom tagline */}
      <footer className="page-footer">
        <p className="footer-mono">GROWTH BASE</p>
        <p className="footer-tagline">
          Receipt-first agent commerce
        </p>
      </footer>
    </div>
  );
}
