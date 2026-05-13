import path from "node:path";
import type { NextConfig } from "next";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const replitExpoDevDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;

const allowedOrigins = [
  "localhost:3000",
  ...(replitDevDomain
    ? [replitDevDomain, `${replitDevDomain}:5000`]
    : []),
  ...(replitExpoDevDomain ? [replitExpoDevDomain] : []),
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async rewrites() {
    return [
      {
        source: "/",
        has: [{ type: "header", key: "expo-platform" }],
        destination: "http://localhost:8080/",
      },
      {
        source: "/:path+",
        has: [{ type: "header", key: "expo-platform" }],
        destination: "http://localhost:8080/:path+",
      },
    ];
  },
};

export default nextConfig;
