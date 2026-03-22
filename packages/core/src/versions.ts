export const SCHEMA_VERSION = "1";
export const SERVICE_VERSION = "v1";
export const POLICY_EIP712_NAME = "GrowthBase DelegationPolicy";
export const POLICY_EIP712_VERSION = "1";

export const SERVICE_ID = "polymarket-hidden-edge-scan";
export const CAPABILITY_ID = "hidden_edge_scan_polymarket";
export const ARTIFACT_KIND = "hidden_edge_scan_result";
export const SERVICE_PRICE_ATOMIC = "50000";
export const SERVICE_NETWORK = "eip155:8453";
export const DEFAULT_CURRENCY = "USDC";
export const PAYMENT_METHOD = "x402_v2";
export const SERVICE_CATEGORY = "market_intelligence";
export const INPUT_SCHEMA_VERSION = "1";
export const ARTIFACT_SCHEMA_VERSION = "1";
export const PROOF_SCHEMA_VERSION = "1";

export const SERVICE_TAGS = [
  "polymarket",
  "scanner",
  "hidden-edge",
  "prediction-market",
  "entry",
  "agents"
] as const;

export const CONTRACT_VERSION_BUNDLE = {
  discovery: "v1",
  request_input: "1",
  artifact: "1",
  proof: "1",
  quote: "hl-a2a-quote/0.1",
  payment_required: "x402/v2",
  paid_run: "hl-a2a-service-run/1"
} as const;
