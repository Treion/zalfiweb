import type { NextConfig } from "next";

/**
 * Baseline security headers for every page and route. The admin adds stricter ones of its own
 * (no framing at all, never cached, never indexed) in src/proxy.ts, which run after these.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Payment is left on for the gateways' own pages, which customers are sent to
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
