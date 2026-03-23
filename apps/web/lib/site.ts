/**
 * Public site and API entrypoints for the GrowthBase web app (e.g. Vercel).
 * Submission uses one public live API base (`NEXT_PUBLIC_LIVE_API_BASE_URL`).
 */

export const CANONICAL_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://growthbase-web.vercel.app"
).replace(/\/$/, "");

export const LIVE_API_BASE_URL = (
  process.env.NEXT_PUBLIC_LIVE_API_BASE_URL ?? "https://growthbase-production.up.railway.app"
).replace(/\/$/, "");

export const RECEIPT_ANCHOR_ADDRESS = process.env.NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS?.trim() as
  | `0x${string}`
  | undefined;

/**
 * API used by /verify when loading full verification (hash linkage). Prefer live API
 * on Vercel where local sqlite is unavailable.
 */
export function getReceiptVerifyApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_RECEIPT_VERIFY_API_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  return LIVE_API_BASE_URL;
}

/** GitHub blob base for deep links to docs/proofs from the deployed site (no /docs route on Vercel). */
export const REPO_DOC_BLOB_BASE = (
  process.env.NEXT_PUBLIC_REPO_DOC_BLOB_BASE ?? "https://github.com/seiryu285/GrowthBase/blob/main"
).replace(/\/$/, "");

export function getReceiptAnchorExplorerUrl(): string | null {
  if (!RECEIPT_ANCHOR_ADDRESS) {
    return null;
  }

  const explicit = process.env.NEXT_PUBLIC_RECEIPT_ANCHOR_EXPLORER_URL?.trim();
  if (explicit) {
    return explicit;
  }

  return `https://basescan.org/address/${RECEIPT_ANCHOR_ADDRESS}`;
}
