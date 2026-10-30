import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Dev only: Next 16 blocks dev scripts/HMR for any host other than localhost, which leaves client-rendered
  // screens (Analytics) stuck on their loading placeholder. Allow the loopback IP and private LAN ranges.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
