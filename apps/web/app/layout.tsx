import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Growth Base — Agent Substrate",
  description:
    "The substrate where every verified delivery makes the agent stronger. Safe permission controls, verifiable proof, and compounding trust for AI agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="topbar-brand">
            Growth Base
          </Link>
          <nav className="nav">
            <Link href="/">Home</Link>
            <Link href="/policy">Policy</Link>
            <Link href="/verify">Verify</Link>
            <Link href="/identity">Identity</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
