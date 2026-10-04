import { poolDb, type Executor } from "@/server/db/pool";
import { getIntegration, type Resolved } from "@/server/integrations";
import { getSettings } from "@/server/settings";
import { testProvidersAllowed } from "@/server/test-mode";
import { aamarpay, type AamarConfig } from "./aamarpay";
import { mockProvider } from "./mock";
import { sslcommerz, type SslConfig } from "./sslcommerz";
import { GATEWAYS, type GatewayName, type PaymentProvider } from "./types";

/**
 * Which gateways take payments. Each is set up and switched on in Admin → Integrations (keys saved
 * there, or the old environment variables). Checkout tries the switched-on gateways in the owner's
 * order (Settings → integrations.gatewayOrder) and moves to the next when one can't open a payment
 * page. The test gateway comes last, and never runs on the live site.
 */

/** The test gateway is for development and previews only (see test-mode.ts) */
export const mockAllowed = testProvidersAllowed;

export const sslConfigOf = (r: Resolved): SslConfig => ({
  storeId: r.values.storeId!,
  storePassword: r.values.storePassword!,
  live: r.mode === "live",
});

export const aamarConfigOf = (r: Resolved): AamarConfig => ({
  storeId: r.values.storeId!,
  signatureKey: r.values.signatureKey!,
  live: r.mode === "live",
});

/** A gateway built from a set-up (configured or not: the caller checks) */
export function gatewayFrom(name: GatewayName, r: Resolved): PaymentProvider {
  return name === "sslcommerz" ? sslcommerz(sslConfigOf(r)) : aamarpay(aamarConfigOf(r));
}

export const isGateway = (n: string): n is GatewayName =>
  (GATEWAYS as readonly string[]).includes(n);

/**
 * A provider by name, for a payment that already exists. Configured is enough: a payment opened
 * before its gateway was switched off still settles, reconciles and refunds.
 */
export async function providerByName(
  name: string,
  exec: Executor = poolDb(),
): Promise<PaymentProvider | null> {
  if (name === "mock") return mockAllowed() ? mockProvider : null;
  if (!isGateway(name)) return null;
  const r = await getIntegration(name, exec);
  return r.configured ? gatewayFrom(name, r) : null;
}

/** The gateways new payments go through, in the order checkout tries them */
export async function onlineGateways(exec: Executor = poolDb()): Promise<PaymentProvider[]> {
  const { gatewayOrder } = await getSettings("integrations", exec);
  const out: PaymentProvider[] = [];
  for (const name of gatewayOrder) {
    const r = await getIntegration(name, exec);
    if (r.enabled) out.push(gatewayFrom(name, r));
  }
  if (mockAllowed() && (await getIntegration("test-gateway", exec)).enabled) out.push(mockProvider);
  return out;
}

/** Plain words for the admin: what checkout uses now */
export async function gatewaySummary(exec: Executor = poolDb()) {
  const list = await onlineGateways(exec);
  const label = (p: PaymentProvider) =>
    p.name === "mock"
      ? "the test gateway"
      : `${p.name === "sslcommerz" ? "SSLCommerz" : "aamarPay"}${p.mode === "sandbox" ? " (sandbox)" : ""}`;
  if (!list.length)
    return { ready: false, note: "No payment gateway is on: online payment is off." };
  const [first, ...rest] = list;
  return {
    ready: true,
    note: rest.length
      ? `Checkout uses ${label(first!)}, then ${rest.map(label).join(", then ")} if it can't open.`
      : `Checkout uses ${label(first!)}.`,
  };
}
