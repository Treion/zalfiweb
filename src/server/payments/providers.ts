import { env } from "@/lib/env";
import { testProvidersAllowed } from "@/server/test-mode";
import { poolDb, type Executor } from "@/server/db/pool";
import { getSettings } from "@/server/settings";
import { mockProvider } from "./mock";
import { sslcommerz, type SslConfig } from "./sslcommerz";
import type { PaymentProvider, ProviderName } from "./types";

/**
 * Which gateway takes payments. Settings → Payments chooses (integrations.payments); SSLCommerz is
 * used only when its keys are in the environment too. The test gateway never runs on the live site.
 */

/** The test gateway is for development and previews only (see test-mode.ts) */
export const mockAllowed = testProvidersAllowed;

export function sslConfig(): SslConfig | null {
  const storeId = env("SSLCOMMERZ_STORE_ID");
  const storePassword = env("SSLCOMMERZ_STORE_PASSWORD");
  if (!storeId || !storePassword) return null;
  return { storeId, storePassword, live: env("SSLCOMMERZ_IS_LIVE") === "true" };
}

/** A provider by name, for a payment that already exists (whatever the setting says now) */
export function providerByName(name: string): PaymentProvider | null {
  if (name === "mock") return mockAllowed() ? mockProvider : null;
  if (name === "sslcommerz") {
    const cfg = sslConfig();
    return cfg ? sslcommerz(cfg) : null;
  }
  return null;
}

export type Gateway = {
  selected: ProviderName;
  provider: PaymentProvider | null;
  /** Plain words for the admin: what is in use, and why */
  note: string;
};

export function resolveGateway(selected: ProviderName): Gateway {
  const cfg = sslConfig();
  if (selected === "sslcommerz") {
    if (cfg)
      return {
        selected,
        provider: sslcommerz(cfg),
        note: cfg.live
          ? "SSLCommerz, live: real payments."
          : "SSLCommerz sandbox: test cards only, no real money.",
      };
    if (mockAllowed())
      return {
        selected,
        provider: mockProvider,
        note: "SSLCommerz keys aren't set, so the test gateway is used. No money moves.",
      };
    return {
      selected,
      provider: null,
      note: "SSLCommerz keys aren't set: online payment is off until they are.",
    };
  }
  if (mockAllowed())
    return { selected, provider: mockProvider, note: "The test gateway. No money moves." };
  return {
    selected,
    provider: null,
    note: "The test gateway doesn't run on the live site. Choose SSLCommerz.",
  };
}

/** The gateway new payments go through right now */
export async function currentGateway(exec: Executor = poolDb()) {
  const { payments } = await getSettings("integrations", exec);
  return resolveGateway(payments);
}
