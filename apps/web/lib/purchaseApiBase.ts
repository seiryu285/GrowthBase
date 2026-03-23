import { LIVE_API_BASE_URL } from "./site";

/**
 * Base URL for the GrowthBase API used by the demo purchase rail (server route).
 * Prefer `DEMO_PURCHASE_API_BASE_URL` or `API_BASE_URL` when the web app and API differ.
 */
export function getPurchaseApiBaseUrl(): string {
  const explicit =
    process.env.DEMO_PURCHASE_API_BASE_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return (explicit || LIVE_API_BASE_URL).replace(/\/$/, "");
}
