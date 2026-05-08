import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo root has its own lockfile (the Expo mobile app). Pin Next's
  // file-tracing root to the portal directory so it doesn't pick that up.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
