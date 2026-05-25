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

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  async headers() {
    if (!isDev) return [];
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
  async rewrites() {
    // beforeFiles: run BEFORE Next.js app-router pages so the expo-platform
    // requests are proxied to Metro (port 8080) before the auth layer can
    // redirect unauthenticated requests to /login.
    const expoRewrites = [
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
    return {
      beforeFiles: expoRewrites,
    };
  },
};

export default nextConfig;
