import { env } from "@/lib/env";
import { testProvidersAllowed } from "@/server/test-mode";
import { mockCourier } from "./mock";
import { pathao, type PathaoConfig, type PathaoProvider } from "./pathao";
import { steadfast, type SteadfastConfig } from "./steadfast";
import { COURIER_LABELS, type CourierName, type CourierProvider } from "./types";

/**
 * Which couriers can take parcels now. A real courier is available only when its keys are in the
 * environment; the test courier only off the live site. The default courier is chosen in
 * Settings → Shipping, and each order can be sent with another.
 */

export function pathaoConfig(): PathaoConfig | null {
  const c = {
    clientId: env("PATHAO_CLIENT_ID"),
    clientSecret: env("PATHAO_CLIENT_SECRET"),
    username: env("PATHAO_USERNAME"),
    password: env("PATHAO_PASSWORD"),
    storeId: env("PATHAO_STORE_ID"),
  };
  if (!c.clientId || !c.clientSecret || !c.username || !c.password || !c.storeId) return null;
  return {
    ...(c as Required<{ [K in keyof typeof c]: string }>),
    live: env("PATHAO_IS_LIVE") === "true",
    webhookSecret: env("PATHAO_WEBHOOK_SECRET") ?? null,
  };
}

export function steadfastConfig(): SteadfastConfig | null {
  const apiKey = env("STEADFAST_API_KEY");
  const secretKey = env("STEADFAST_SECRET_KEY");
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey, webhookToken: env("STEADFAST_WEBHOOK_TOKEN") ?? null };
}

export function courier(name: string): CourierProvider | null {
  if (name === "mock") return testProvidersAllowed() ? mockCourier : null;
  if (name === "pathao") {
    const c = pathaoConfig();
    return c ? pathao(c) : null;
  }
  if (name === "steadfast") {
    const c = steadfastConfig();
    return c ? steadfast(c) : null;
  }
  return null;
}

export const pathaoCourier = () => courier("pathao") as PathaoProvider | null;

export type CourierOption = { name: CourierName; label: string; mode: string };

/** The couriers an admin can send with right now */
export function availableCouriers(): CourierOption[] {
  return (["pathao", "steadfast", "mock"] as const).flatMap((n) => {
    const c = courier(n);
    return c ? [{ name: n, label: COURIER_LABELS[n], mode: c.mode }] : [];
  });
}

export { trackingUrl } from "./tracking";

export type CourierStatus = {
  name: CourierName;
  label: string;
  /** "live", "sandbox", "test", or null when it can't take parcels */
  mode: string | null;
  note: string;
  /** Where the courier posts its updates (null for the test courier, which needs none) */
  webhookPath: string | null;
  webhookReady: boolean;
};

/** Each courier's set-up, in plain words, for Settings → Shipping */
export function courierStatuses(): CourierStatus[] {
  const p = pathaoConfig();
  const s = steadfastConfig();
  const test = testProvidersAllowed();
  return [
    {
      name: "pathao",
      label: COURIER_LABELS.pathao,
      mode: p ? (p.live ? "live" : "sandbox") : null,
      note: p
        ? p.live
          ? "Live: real pickups and deliveries."
          : "Sandbox: test parcels only. Set PATHAO_IS_LIVE=true to go live."
        : "Keys not set (PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME, PATHAO_PASSWORD, PATHAO_STORE_ID).",
      webhookPath: "/api/couriers/webhook/pathao",
      webhookReady: !!p?.webhookSecret,
    },
    {
      name: "steadfast",
      label: COURIER_LABELS.steadfast,
      mode: s ? "live" : null,
      note: s
        ? "Live: real pickups and deliveries."
        : "Keys not set (STEADFAST_API_KEY, STEADFAST_SECRET_KEY).",
      webhookPath: "/api/couriers/webhook/steadfast",
      webhookReady: !!s?.webhookToken,
    },
    {
      name: "mock",
      label: COURIER_LABELS.mock,
      mode: test ? "test" : null,
      note: test
        ? "No real parcels. You play the courier from the order page."
        : "Off on the live site.",
      webhookPath: null,
      webhookReady: true,
    },
  ];
}
