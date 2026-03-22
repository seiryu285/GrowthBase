import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();
const { app } = await createApp({ env });

serve({
  fetch: app.fetch,
  port: env.port
});

console.log(`GrowthBase API listening on http://localhost:${env.port}`);
