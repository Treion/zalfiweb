import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Two root layouts (storefront and admin): unmatched URLs use app/global-not-found.tsx
  // authInterrupts: forbidden() renders the admin's 403 page for pages a role may not open
  experimental: { globalNotFound: true, authInterrupts: true },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 requires an explicit allowlist. 90 is reserved for the bottles, which are the hero of the site.
    qualities: [75, 90],
    deviceSizes: [375, 640, 828, 1080, 1440, 1920, 2560],
  },
};

export default nextConfig;
