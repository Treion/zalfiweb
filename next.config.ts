import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Let the dev server be opened as 127.0.0.1 as well as localhost
  allowedDevOrigins: ["127.0.0.1"],
  // Two root layouts (storefront and admin): unmatched URLs use app/global-not-found.tsx
  // authInterrupts: forbidden() renders the admin's 403 page for pages a role may not open
  // serverActions.bodySizeLimit: admin photo uploads go through server actions (4 MB files)
  experimental: {
    globalNotFound: true,
    authInterrupts: true,
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 requires an explicit allowlist. 90 is reserved for the bottles, which are the hero of the site.
    qualities: [75, 90],
    deviceSizes: [375, 640, 828, 1080, 1440, 1920, 2560],
    // Product photos uploaded in the admin, when stored on Vercel Blob
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
