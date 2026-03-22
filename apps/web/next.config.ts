import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@growthbase/core",
    "@growthbase/db",
    "@growthbase/growth",
    "@growthbase/policy",
    "@growthbase/receipt"
  ]
};

export default nextConfig;
