import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ASA reports and integration payloads are fetched server-side; no remote images needed yet.
};

export default nextConfig;
