const serviceId = process.env.SERVICE_ID ?? "polymarket-hidden-edge-scan";
const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
const probeUrl = process.env.PROBE_URL ?? (apiBaseUrl ? `${apiBaseUrl}/purchase/${serviceId}` : null);
const payloadFile = process.env.PROBE_PAYLOAD_FILE;
const payloadText = process.env.PROBE_PAYLOAD ?? (payloadFile ? await readFileUtf8(payloadFile) : null);

if (!probeUrl) {
  console.error("Set PROBE_URL or set API_BASE_URL and optionally SERVICE_ID.");
  process.exit(1);
}

try {
  if (!payloadText) {
    const spec = await fetchJson(probeUrl, { method: "GET" });
    console.log(
      JSON.stringify(
        {
          mode: "spec-only",
          probeUrl,
          message: "No PROBE_PAYLOAD was provided. Returning the machine-readable purchase spec instead.",
          spec
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const payload = JSON.parse(payloadText);
  const response = await fetch(probeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  const headers = Object.fromEntries(response.headers.entries());

  console.log(
    JSON.stringify(
      {
        probeUrl,
        status: response.status,
        statusText: response.statusText,
        headers,
        bodyText: text
      },
      null,
      2
    )
  );
} catch (error) {
  const details = normalizeError(error);
  const spec = await fetchJson(probeUrl, { method: "GET" }).catch(() => null);

  console.error(
    JSON.stringify(
      {
        probeUrl,
        error: details,
        hint:
          details.code === "ENOTFOUND"
            ? "PROBE_URL is not a real host. Use your actual API base URL, for example http://localhost:3001/purchase/polymarket-hidden-edge-scan."
            : "Inspect the purchase spec and ensure the JSON body includes policy, agentIdentity, and input.",
        spec
      },
      null,
      2
    )
  );
  process.exit(1);
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: tryParseJson(text) ?? text
  };
}

async function readFileUtf8(path) {
  const fs = await import("node:fs/promises");
  return fs.readFile(path, "utf8");
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: "code" in error ? error.code : undefined,
      cause: "cause" in error ? error.cause : undefined
    };
  }

  return {
    name: "UnknownError",
    message: String(error)
  };
}
