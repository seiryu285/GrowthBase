import Link from "next/link";
import type { CSSProperties } from "react";

import { DemoPurchaseRail } from "../components/DemoPurchaseRail";
import DotField from "./DotField";

/* ═══════════════════════════════════════════════════════════════════════════
   CONCENTRIC RING DATA
   Each ring: label repeated, radius tier, rotation direction, speed
   ═══════════════════════════════════════════════════════════════════════════ */

const rings = [
  { words: "SERVICES", count: 12, radius: 92, duration: 90, reverse: false, opacity: 0.35 },
  { words: "RECEIPTS", count: 10, radius: 78, duration: 75, reverse: true, opacity: 0.45 },
  { words: "VERIFICATION", count: 8, radius: 64, duration: 60, reverse: false, opacity: 0.55 },
  { words: "DELEGATION", count: 8, radius: 50, duration: 50, reverse: true, opacity: 0.7 },
  { words: "TRUST", count: 6, radius: 36, duration: 40, reverse: false, opacity: 0.85 },
];

function RingText({
  word,
  count,
  radius,
  duration,
  reverse,
  opacity,
}: {
  word: string;
  count: number;
  radius: number;
  duration: number;
  reverse: boolean;
  opacity: number;
}) {
  const text = Array(count).fill(`${word} // `).join("");
  const id = `ring-${word.toLowerCase()}`;

  return (
    <g
      className="ring-group"
      style={{
        "--dur": `${duration}s`,
        "--dir": reverse ? "reverse" : "normal",
        opacity,
      } as CSSProperties}
    >
      <defs>
        <path
          id={id}
          d={`M 0,-${radius} A ${radius},${radius} 0 1,1 -0.01,-${radius}`}
          fill="none"
        />
      </defs>
      <text className="ring-text">
        <textPath href={`#${id}`} startOffset="0%">
          {text}
        </textPath>
      </text>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BAR VISUALIZATION (for pillar cards)
   ═══════════════════════════════════════════════════════════════════════════ */

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
      h: Math.max(6, Math.min(260, Math.round(heightFn(i, t)))),
      accent: accentFn(i),
      w: 2.8 + Math.sin(i * 0.7) * 0.8,
    };
  });
}

const delegateBars = makeBars(
  40,
  (_, t) =>
    30 + 180 * Math.abs(Math.sin(Math.PI * t * 2.4)) *
      (0.5 + 0.5 * Math.cos(Math.PI * t * 0.9)) + 20 * Math.sin(t * 16),
  (i) => i % 3 !== 1,
);
const verifyBars = makeBars(
  36,
  (i, t) => {
    const c = Math.abs(t - 0.5) * 2;
    return 20 + 200 * (1 - c * c) * (0.7 + 0.3 * Math.sin(i * 1.4)) + 12 * Math.cos(i * 0.8);
  },
  (i) => i % 4 <= 2,
);
const growBars = makeBars(
  38,
  (i, t) => 10 + 220 * Math.pow(t, 1.5) * (0.85 + 0.15 * Math.sin(i * 0.7)) + 8 * Math.sin(i * 2.1),
  (i) => i >= 18 || i % 2 === 0,
);
const discoverBars = makeBars(
  34,
  (i, t) =>
    30 + 100 * Math.abs(Math.sin(i * 1.618033988)) +
    50 * Math.abs(Math.cos(i * 0.618)) + 15 * Math.sin(i * 3.2) + 35 * t,
  (i) => i % 3 !== 0,
);

function BarViz({ data, color, ghost = "rgba(255,255,255,0.06)" }: {
  data: Bar[];
  color: string;
  ghost?: string;
}) {
  return (
    <svg viewBox="0 0 400 300" className="bar-viz" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      {data.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={300 - b.h - 8}
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

/* ═══════════════════════════════════════════════════════════════════════════
   PILLAR CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

const pillars = [
  {
    label: "DELEGATE",
    color: "#22c55e",
    ghost: "rgba(34,197,94,0.10)",
    data: delegateBars,
    tagline: "Permission controls",
    description: "Safe, scoped delegation from human to agent with real-time cost boundaries.",
    href: "/policy",
  },
  {
    label: "VERIFY",
    color: "#f472b6",
    ghost: "rgba(244,114,182,0.10)",
    data: verifyBars,
    tagline: "Proof of delivery",
    description: "Cryptographic receipts that make every deliverable independently verifiable.",
    href: "/verify",
  },
  {
    label: "GROW",
    color: "#d4a053",
    ghost: "rgba(212,160,83,0.10)",
    data: growBars,
    tagline: "Compounding trust",
    description: "Every verified delivery compounds into a track record that strengthens the agent.",
    href: "/agents/0x3333333333333333333333333333333333333333/growth",
  },
  {
    label: "DISCOVER",
    color: "#60a5fa",
    ghost: "rgba(96,165,250,0.10)",
    data: discoverBars,
    tagline: "Network emergence",
    description: "Track record drives discoverability, trust, and access across the network.",
    href: "/identity",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <div className="page-root">
      {/* ── GLOBAL DOT FIELD BACKGROUND ── */}
      <DotField />

      {/* ── IMMERSIVE HERO ── */}
      <section className="hero-immersive">

        {/* concentric rings */}
        <div className="rings-container">
          <svg viewBox="-100 -100 200 200" className="rings-svg">
            {rings.map((r) => (
              <RingText
                key={r.words}
                word={r.words}
                count={r.count}
                radius={r.radius}
                duration={r.duration}
                reverse={r.reverse}
                opacity={r.opacity}
              />
            ))}
            {/* center glow */}
            <circle cx="0" cy="0" r="22" className="core-glow" />
            <circle cx="0" cy="0" r="14" className="core-inner" />
          </svg>
        </div>

        {/* hero text overlay */}
        <div className="hero-content">
          <h1 className="hero-title-immersive">
            The substrate where every<br />
            verified delivery makes<br />
            the agent stronger.
          </h1>
        </div>

        {/* vertical side label */}
        <span className="side-label">GROWTH BASE — AGENT SUBSTRATE</span>
      </section>

      {/* ── MANIFESTO ── */}
      <section className="manifesto">
        <div className="manifesto-inner">
          <p className="manifesto-em">
            GrowthBase lets a human delegate a paid task to an AI agent on Base,
            cross the x402 purchase boundary, and verify the delivery with
            receipts, proofs, and growth history.
          </p>
          <p className="manifesto-lead">
            Humans want to delegate work to AI agents, but current infrastructure
            lacks safe permission controls, real-time cost tracking, and
            verifiable proof of deliverables.
          </p>
          <p className="manifesto-body">
            Beyond the human side, autonomous agents themselves have no substrate
            that gives them a survival and growth advantage. An agent that
            performs well, delivers reliably, and builds a verifiable track
            record should compound that history into increased discoverability,
            trust, and capability.
          </p>
          <p className="manifesto-em">
            Growth Base is designed to be that substrate: a layer where every
            verified delivery makes the agent stronger.
          </p>
          <p className="manifesto-body">
            Reviewer path for a short demo video: <strong>Policy</strong> and{" "}
            <strong>Identity</strong> for the agent component, then{" "}
            <strong>Live</strong>, <strong>Artifact</strong>, <strong>Verify</strong>, and{" "}
            <strong>Evidence</strong> for the paid boundary, proof surfaces, and
            honest live limitation.
          </p>
        </div>
      </section>

      {/* ── DEMO PURCHASE (single-service reviewer path) ── */}
      <section className="demo-purchase-section" aria-labelledby="demo-purchase-heading">
        <div className="demo-purchase-section-inner">
          <span className="section-label" id="demo-purchase-heading">
            DEMO PURCHASE
          </span>
          <p className="demo-purchase-lead">
            One deterministic service — <strong>Buy now</strong> runs the real <code className="inline-code">POST /purchase</code>{" "}
            flow (402 → x402 payment → 200) via a server-side helper, then jump to Verify.
          </p>
          <DemoPurchaseRail />
        </div>
      </section>

      {/* ── PILLARS ── */}
      <section className="pillars-section">
        <div className="pillars-header">
          <span className="section-label">THE FOUR PRIMITIVES</span>
        </div>
        <div className="pillar-grid">
          {pillars.map((p) => (
            <Link key={p.label} href={p.href} className="pillar-card">
              <div className="pillar-top">
                <span className="pillar-label">{p.label}</span>
                <span className="pillar-tagline">{p.tagline}</span>
              </div>
              <div className="pillar-viz">
                <BarViz data={p.data} color={p.color} ghost={p.ghost} />
              </div>
              <p className="pillar-desc">{p.description}</p>
              <span className="pillar-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── SUBSTRATE STATEMENT ── */}
      <section className="substrate-section">
        <div className="substrate-ring" />
        <p className="substrate-text">
          The services on top change.<br />
          <strong>The substrate remains.</strong>
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-inner">
          <span className="footer-brand">GROWTH BASE</span>
          <span className="footer-divider">//</span>
          <span className="footer-sub">Receipt-first agent commerce</span>
        </div>
        <nav className="footer-reviewer" aria-label="Public reviewer routes">
          <Link href="/policy">Policy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/identity">Identity</Link>
          <span aria-hidden="true">·</span>
          <Link href="/live">Live</Link>
          <span aria-hidden="true">·</span>
          <Link href="/demo">Demo</Link>
          <span aria-hidden="true">·</span>
          <Link href="/latest-artifact">Artifact</Link>
          <span aria-hidden="true">·</span>
          <Link href="/verify">Verify</Link>
          <span aria-hidden="true">·</span>
          <Link href="/evidence">Evidence</Link>
        </nav>
      </footer>
    </div>
  );
}
