import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 requires an explicit allowlist. 90 is reserved for the bottles, which are the hero of the site.
    qualities: [75, 90],
    deviceSizes: [375, 640, 828, 1080, 1440, 1920, 2560],
  },
};

export default nextConfig;
