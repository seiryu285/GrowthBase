/**
 * Lane A: start a fixture-mode API + Cloudflare quick tunnel, then run
 * scripts/external-verify-proof.ts against the public tunnel URL.
 *
 * Requires `cloudflared` on PATH (https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const PORT = process.env.SUCCESS_LANE_PORT?.trim() || "3111";
const LOCAL_ORIGIN = `http://127.0.0.1:${PORT}`;
const SQLITE_REL = path.join("data", "success-lane-tunnel.sqlite");
const SQLITE_ABS = path.join(workspaceRoot, SQLITE_REL);

function ensureDir() {
  const dir = path.dirname(SQLITE_ABS);
  fs.mkdirSync(dir, { recursive: true });
}

async function waitForTunnelUrl(proc: ChildProcess, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for cloudflared tunnel URL.`));
      }
    }, timeoutMs);

    const tryMatch = (chunk: Buffer) => {
      if (settled) {
        return;
      }
      const text = chunk.toString();
      const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m?.[0]) {
        settled = true;
        clearTimeout(timer);
        resolve(m[0].replace(/\/$/, ""));
      }
    };

    proc.stdout?.on("data", tryMatch);
    proc.stderr?.on("data", tryMatch);
    proc.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

async function waitForLocalOffersOk(origin: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin.replace(/\/$/, "")}/offers`);
      if (response.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for GET ${origin}/offers.`);
}

/** Wait until the tunnel hostname resolves and `/offers` works from this process (DNS + edge propagation). */
async function waitForPublicOffersOk(publicBase: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const base = publicBase.replace(/\/$/, "");
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/offers`, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      /* ENOTFOUND / connection reset — retry */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for public GET ${publicBase}/offers.`);
}

async function main() {
  ensureDir();

  const tunnelBin = process.env.CLOUDFLARED_PATH?.trim() || "cloudflared";
  const tunnelProc = spawn(tunnelBin, ["tunnel", "--url", LOCAL_ORIGIN], {
    cwd: workspaceRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32"
  });

  let publicBaseUrl: string;
  try {
    publicBaseUrl = await waitForTunnelUrl(tunnelProc, 90_000);
  } catch (error) {
    tunnelProc.kill("SIGTERM");
    throw error;
  }

  const apiEnv = {
    ...process.env,
    PORT,
    MARKET_DATA_MODE: "fixture",
    X402_MODE: "local",
    DATABASE_URL: SQLITE_REL,
    API_BASE_URL: publicBaseUrl,
    AGENT_URI: `${publicBaseUrl}/.well-known/agent-registration.json`,
    PUBLIC_WEB_APP_URL: process.env.PUBLIC_WEB_APP_URL?.trim() || "https://growthbase-web.vercel.app",
    NODE_ENV: "development"
  };

  const apiProc = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@growthbase/api", "exec", "tsx", "src/index.ts"],
    {
      cwd: workspaceRoot,
      env: apiEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32"
    }
  );

  try {
    await waitForLocalOffersOk(LOCAL_ORIGIN, 60_000);
    await waitForPublicOffersOk(publicBaseUrl, 120_000);
  } catch (error) {
    apiProc.kill("SIGTERM");
    tunnelProc.kill("SIGTERM");
    throw error;
  }

  const proofEnv = {
    ...process.env,
    API_BASE_URL: publicBaseUrl,
    PROOF_LABEL: process.env.PROOF_LABEL?.trim() || "lane-a-public-tunnel-verify",
    GROWTHBASE_DEMO_MAX_BOOK_AGE_MS: process.env.GROWTHBASE_DEMO_MAX_BOOK_AGE_MS?.trim() || "15000"
  };

  try {
    const proofCmd =
      process.platform === "win32"
        ? "pnpm.cmd exec tsx scripts/external-verify-proof.ts"
        : "pnpm exec tsx scripts/external-verify-proof.ts";
    execSync(proofCmd, {
      cwd: workspaceRoot,
      env: proofEnv,
      stdio: "inherit",
      shell: true
    });
  } finally {
    apiProc.kill("SIGTERM");
    tunnelProc.kill("SIGTERM");
    await Promise.race([
      once(apiProc, "exit").catch(() => undefined),
      new Promise((r) => setTimeout(r, 3000))
    ]);
    await Promise.race([
      once(tunnelProc, "exit").catch(() => undefined),
      new Promise((r) => setTimeout(r, 3000))
    ]);
  }
}

await main().catch((error) => {
  console.error(JSON.stringify({ proofKind: "success-lane-tunnel-orchestrator", outcome: "failure", message: String(error) }, null, 2));
  process.exitCode = 1;
});
