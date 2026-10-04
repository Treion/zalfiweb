import { poolDb, type Executor } from "@/server/db/pool";
import { getIntegration, type Resolved } from "@/server/integrations";
import { getSettings } from "@/server/settings";
import { testProvidersAllowed } from "@/server/test-mode";
import { carrybee, type CarrybeeConfig, type CarrybeeProvider } from "./carrybee";
import { manualCourier } from "./manual";
import { mockCourier } from "./mock";
import { pathao, type PathaoConfig, type PathaoProvider } from "./pathao";
import { redx, type RedxConfig, type RedxProvider } from "./redx";
import { steadfast, type SteadfastConfig, type SteadfastProvider } from "./steadfast";
import { COURIER_LABELS, COURIER_NAMES, type CourierName, type CourierProvider } from "./types";

/**
 * Which couriers take parcels. Pathao, Steadfast, RedX and CarryBee are set up and switched on in Admin →
 * Integrations (keys saved there, or the old environment variables). "Other courier" (the team's
 * own records) has its switch there too; the test courier runs only off the live site.
 *
 *  - configured: its keys are there. Parcels already out keep updating (webhooks, polls, labels)
 *    even after it is switched off.
 *  - enabled: it is offered for new parcels.
 */

export const pathaoConfigOf = (r: Resolved): PathaoConfig => ({
  clientId: r.values.clientId!,
  clientSecret: r.values.clientSecret!,
  username: r.values.username!,
  password: r.values.password!,
  storeId: r.values.storeId!,
  live: r.mode === "live",
  webhookSecret: r.webhookToken,
});

export const steadfastConfigOf = (r: Resolved): SteadfastConfig => ({
  apiKey: r.values.apiKey!,
  secretKey: r.values.secretKey!,
  webhookToken: r.webhookToken,
});

export const redxConfigOf = (r: Resolved): RedxConfig => ({
  accessToken: r.values.accessToken!,
  pickupStoreId: r.values.pickupStoreId!,
  live: r.mode === "live",
  webhookToken: r.webhookToken,
});

export const carrybeeConfigOf = (r: Resolved): CarrybeeConfig => ({
  clientId: r.values.clientId!,
  clientSecret: r.values.clientSecret!,
  clientContext: r.values.clientContext!,
  storeId: r.values.storeId!,
  live: r.mode === "live",
  webhookSecret: r.values.webhookSecret ?? null,
});

/** Where each courier's switch lives in the integrations table */
const INTEGRATION = {
  pathao: "pathao",
  steadfast: "steadfast",
  redx: "redx",
  carrybee: "carrybee",
  mock: "test-courier",
} as const;

/** "Other courier" needs no keys; its switch is a shipping setting */
async function manualEnabled(exec: Executor) {
  return (await getSettings("shipping", exec)).manualCourierEnabled;
}

type Found = { provider: CourierProvider; enabled: boolean; mode: string };

async function find(name: CourierName, exec: Executor): Promise<Found | null> {
  if (name === "manual")
    return { provider: manualCourier, enabled: await manualEnabled(exec), mode: "manual" };
  const r = await getIntegration(INTEGRATION[name], exec);
  if (!r.configured) return null;
  const provider =
    name === "pathao"
      ? pathao(pathaoConfigOf(r))
      : name === "steadfast"
        ? steadfast(steadfastConfigOf(r))
        : name === "redx"
          ? redx(redxConfigOf(r))
          : name === "carrybee"
            ? carrybee(carrybeeConfigOf(r))
            : testProvidersAllowed()
              ? mockCourier
              : null;
  return provider ? { provider, enabled: r.enabled, mode: provider.mode } : null;
}

/** A courier for parcels already out (configured is enough), or null */
export async function courier(name: string, exec: Executor = poolDb()) {
  if (!(COURIER_NAMES as readonly string[]).includes(name)) return null;
  return (await find(name as CourierName, exec))?.provider ?? null;
}

/** A courier for a new parcel: configured and switched on, or null */
export async function courierForNew(name: CourierName, exec: Executor = poolDb()) {
  const f = await find(name, exec);
  return f?.enabled ? f.provider : null;
}

export const pathaoCourier = async () => (await courier("pathao")) as PathaoProvider | null;
export const steadfastCourier = async () =>
  (await courier("steadfast")) as SteadfastProvider | null;
export const redxCourier = async () => (await courier("redx")) as RedxProvider | null;
export const carrybeeCourier = async () => (await courier("carrybee")) as CarrybeeProvider | null;

export type CourierOption = { name: CourierName; label: string; mode: string };

/** The couriers an admin can send new parcels with right now */
export async function availableCouriers(exec: Executor = poolDb()): Promise<CourierOption[]> {
  const out: CourierOption[] = [];
  for (const name of COURIER_NAMES) {
    const f = await find(name, exec);
    if (f?.enabled) out.push({ name, label: COURIER_LABELS[name], mode: f.mode });
  }
  return out;
}

export type CourierChoice = { name: CourierName; label: string; ready: boolean };

/** Every courier, and whether it takes new parcels: for the default-courier choice in Settings */
export async function courierChoices(exec: Executor = poolDb()): Promise<CourierChoice[]> {
  const out: CourierChoice[] = [];
  for (const name of COURIER_NAMES) {
    if (name === "mock" && !testProvidersAllowed()) continue;
    const f = await find(name, exec);
    out.push({ name, label: COURIER_LABELS[name], ready: !!f?.enabled });
  }
  return out;
}

export { trackingUrl } from "./tracking";
