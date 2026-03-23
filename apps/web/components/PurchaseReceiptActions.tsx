"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  receiptId: string;
};

export function PurchaseReceiptActions({ receiptId }: Props) {
  const [copied, setCopied] = useState(false);
  const verifyHref = `/verify?receipt_id=${encodeURIComponent(receiptId)}`;

  async function copyReceiptId() {
    try {
      await navigator.clipboard.writeText(receiptId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="purchase-receipt-actions">
      <button type="button" className="btn-secondary" onClick={copyReceiptId}>
        {copied ? "Copied" : "Copy receipt ID"}
      </button>
      <Link className="btn-primary" href={verifyHref}>
        Verify now
      </Link>
    </div>
  );
}
