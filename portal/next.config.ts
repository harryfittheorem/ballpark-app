import path from "node:path";
import type { NextConfig } from "next";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

const allowedOrigins = [
  "localhost:3000",
  ...(replitDevDomain
    ? [replitDevDomain, `${replitDevDomain}:5000`]
    : []),
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
