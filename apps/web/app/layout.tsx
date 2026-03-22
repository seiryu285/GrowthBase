import type { ReactNode } from "react";
import Link from "next/link";

import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">GrowthBase</p>
              <h1>Receipt-first agent commerce</h1>
            </div>
            <nav className="nav">
              <Link href="/">Home</Link>
              <Link href="/policy">Policy</Link>
              <Link href="/verify">Verify</Link>
              <Link href="/identity">Identity</Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
