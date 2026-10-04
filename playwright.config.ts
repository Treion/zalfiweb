import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (tests/e2e): the shop and the admin in a real browser, with the test gateway,
 * the test courier and the dev SMS and email stand-ins, so nothing needs a key.
 *
 *   npm run test:e2e
 *
 * It uses the site at E2E_BASE_URL (default: NEXT_PUBLIC_SITE_URL or localhost:3000), starting
 * `npm run dev` if nothing answers there. Payment return addresses are built from the site's own
 * address, so the tests run against that same address.
 */
const baseURL =
  process.env.E2E_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// The Chromium preinstalled in cloud sessions; elsewhere, `npx playwright install chromium`
const PREINSTALLED = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    launchOptions: existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {},
  },
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/admin/login`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
