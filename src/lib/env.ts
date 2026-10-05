/** An environment variable, or undefined when it's missing or blank (.env.example leaves many empty) */
export function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export const siteUrl = () => env("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";

/**
 * The live shop, on any host: Vercel's production deployment (VERCEL_ENV), Netlify's production
 * context (CONTEXT), or SITE_ENV=production, set by hand where neither is (the Netlify guide sets it
 * on the Production context, since Netlify's CONTEXT isn't always there while the site runs).
 * Previews, branch deploys and computers are not live.
 */
export const isLiveSite = () =>
  env("VERCEL_ENV") === "production" ||
  env("CONTEXT") === "production" ||
  env("SITE_ENV") === "production";
