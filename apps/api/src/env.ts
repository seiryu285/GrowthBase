import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  X402_MODE: z.enum(["local", "live"]).default("local"),
  MARKET_DATA_MODE: z.enum(["live", "fixture"]).default("live"),
  POLYMARKET_GAMMA_BASE_URL: z.string().url().default("https://gamma-api.polymarket.com"),
  POLYMARKET_CLOB_BASE_URL: z.string().url().default("https://clob.polymarket.com"),
  POLYMARKET_EVENT_SLUGS: z.string().optional(),
  POLYMARKET_MARKET_SLUGS: z.string().optional(),
  POLYMARKET_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  POLYMARKET_MAX_BOOK_AGE_MS: z.coerce.number().int().positive().default(5000),
  X402_NETWORK: z.string().default("eip155:8453"),
  X402_PRICE_ATOMIC: z.string().default("50000"),
  X402_PAY_TO: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0x1111111111111111111111111111111111111111"),
  X402_FACILITATOR_URL: z.string().url().default("https://x402.org/facilitator"),
  AGENT_REGISTRY: z.string().default("eip155:8453:0x2222222222222222222222222222222222222222"),
  AGENT_ID: z.string().default("1"),
  AGENT_URI: z.string().url().default("http://localhost:3001/.well-known/agent-registration.json"),
  AGENT_WALLET: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0x3333333333333333333333333333333333333333"),
  SELLER_WALLET: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0x1111111111111111111111111111111111111111"),
  SELLER_IMAGE: z.string().url().default("https://placehold.co/600x600/png"),
  API_BASE_URL: z.string().url().optional()
});

export type ApiEnv = {
  databaseUrl?: string;
  port: number;
  x402Mode: "local" | "live";
  marketDataMode: "live" | "fixture";
  polymarketGammaBaseUrl: string;
  polymarketClobBaseUrl: string;
  polymarketEventSlugs: string[];
  polymarketMarketSlugs: string[];
  polymarketFetchTimeoutMs: number;
  polymarketMaxBookAgeMs: number;
  x402Network: `${string}:${string}`;
  x402PriceAtomic: string;
  x402PayTo: `0x${string}`;
  x402FacilitatorUrl: string;
  agentRegistry: string;
  agentId: string;
  agentUri: string;
  agentWallet: `0x${string}`;
  sellerWallet: `0x${string}`;
  sellerImage: string;
  apiBaseUrl: string;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = envSchema.parse(source);

  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    x402Mode: parsed.X402_MODE,
    marketDataMode: parsed.MARKET_DATA_MODE,
    polymarketGammaBaseUrl: parsed.POLYMARKET_GAMMA_BASE_URL,
    polymarketClobBaseUrl: parsed.POLYMARKET_CLOB_BASE_URL,
    polymarketEventSlugs: splitEnvList(parsed.POLYMARKET_EVENT_SLUGS),
    polymarketMarketSlugs: splitEnvList(parsed.POLYMARKET_MARKET_SLUGS),
    polymarketFetchTimeoutMs: parsed.POLYMARKET_FETCH_TIMEOUT_MS,
    polymarketMaxBookAgeMs: parsed.POLYMARKET_MAX_BOOK_AGE_MS,
    x402Network: parsed.X402_NETWORK as `${string}:${string}`,
    x402PriceAtomic: parsed.X402_PRICE_ATOMIC,
    x402PayTo: parsed.X402_PAY_TO as `0x${string}`,
    x402FacilitatorUrl: parsed.X402_FACILITATOR_URL,
    agentRegistry: parsed.AGENT_REGISTRY,
    agentId: parsed.AGENT_ID,
    agentUri: parsed.AGENT_URI,
    agentWallet: parsed.AGENT_WALLET as `0x${string}`,
    sellerWallet: parsed.SELLER_WALLET as `0x${string}`,
    sellerImage: parsed.SELLER_IMAGE,
    apiBaseUrl: parsed.API_BASE_URL ?? `http://localhost:${parsed.PORT}`
  };
}

function splitEnvList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}
