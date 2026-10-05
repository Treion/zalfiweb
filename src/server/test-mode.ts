import { env, isLiveSite } from "@/lib/env";

/**
 * The test gateway and the test courier are for development and previews only. They are refused
 * on the live site (isLiveSite(): Vercel or Netlify production, or SITE_ENV=production), and on any other production build unless
 * ALLOW_TEST_PROVIDERS=true (a staging site that should take test orders).
 */
export function testProvidersAllowed() {
  if (isLiveSite()) return false;
  if (process.env.NODE_ENV === "production" && env("ALLOW_TEST_PROVIDERS") !== "true") return false;
  return true;
}
