"use client";

import { useState } from "react";

import { SERVICE_ID, SERVICE_PRICE_ATOMIC } from "@growthbase/core";

import { PurchaseReceiptActions } from "./PurchaseReceiptActions";

function formatAtomicUsdc6(atomic: string): string {
  const n = BigInt(atomic);
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

const DEMO_SERVICE_TITLE = "Polymarket hidden-edge scan";

const DEMO_SERVICE_DESCRIPTION =
  "Scan Polymarket liquidity for asymmetric edge signals. This path calls the real POST /purchase API with an x402 402 challenge and paid retry (same stack as the agent demo).";

type DemoPurchaseSuccess = {
  receiptId: string;
  transactionId: string;
  verifyUrl: string;
};

export function DemoPurchaseRail() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<DemoPurchaseSuccess | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/demo-purchase", { method: "POST" });
      const data = (await response.json()) as { error?: string } & Partial<DemoPurchaseSuccess>;

      if (!response.ok) {
        throw new Error(data.error ?? `Request failed (${response.status})`);
      }

      if (!data.receiptId || !data.transactionId || !data.verifyUrl) {
        throw new Error("Invalid success payload from API.");
      }

      setSuccess({
        receiptId: data.receiptId,
        transactionId: data.transactionId,
        verifyUrl: data.verifyUrl
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purchase failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo-purchase-rail">
      <div className="demo-purchase-card">
        <div className="demo-purchase-card-head">
          <h2 className="demo-purchase-title">{DEMO_SERVICE_TITLE}</h2>
          <p className="demo-purchase-service-id">
            <span className="demo-purchase-label">serviceId</span>{" "}
            <code className="inline-code">{SERVICE_ID}</code>
          </p>
        </div>
        <p className="demo-purchase-desc">{DEMO_SERVICE_DESCRIPTION}</p>
        <div className="demo-purchase-price-row">
          <span className="demo-purchase-price">
            {formatAtomicUsdc6(SERVICE_PRICE_ATOMIC)} USDC
          </span>
          <span className="demo-purchase-network">Base · x402</span>
        </div>
        <p className="demo-purchase-honest">
          Payment is handled by the API’s x402 stack. When the API runs with local / deterministic settlement, the
          receipt still reflects a real verified payment payload (not a mocked JSON success). Keys are server-side only.
        </p>
        <button type="button" className="btn-primary demo-purchase-buy" onClick={buy} disabled={busy}>
          {busy ? "Purchasing…" : "Buy now"}
        </button>
      </div>

      {error && (
        <div className="demo-purchase-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="demo-purchase-success">
          <h3 className="demo-purchase-success-title">Purchase complete</h3>
          <dl className="demo-purchase-dl">
            <div>
              <dt>receiptId</dt>
              <dd>
                <code className="inline-code">{success.receiptId}</code>
              </dd>
            </div>
            <div>
              <dt>transactionId</dt>
              <dd>
                <code className="inline-code">{success.transactionId}</code>
              </dd>
            </div>
            <div>
              <dt>verifyUrl</dt>
              <dd>
                <a className="demo-purchase-link" href={success.verifyUrl} target="_blank" rel="noreferrer">
                  {success.verifyUrl}
                </a>
              </dd>
            </div>
          </dl>
          <PurchaseReceiptActions receiptId={success.receiptId} />
        </div>
      )}

    </div>
  );
}
