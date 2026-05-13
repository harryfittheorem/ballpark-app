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
      // Expo manifest request (expo-platform header present)
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
      // JS bundle downloads (platform=ios or platform=android query param)
      {
        source: "/:path*",
        has: [{ type: "query", key: "platform", value: "ios" }],
        destination: "http://localhost:8080/:path*",
      },
      {
        source: "/:path*",
        has: [{ type: "query", key: "platform", value: "android" }],
        destination: "http://localhost:8080/:path*",
      },
      // React Native assets (fonts, images) — path-based, no special header needed
      {
        source: "/assets/:path*",
        destination: "http://localhost:8080/assets/:path*",
      },
      // Source maps
      {
        source: "/symbolicate",
        destination: "http://localhost:8080/symbolicate",
      },
    ];
  },
};

export default nextConfig;
