import { z } from "zod";
import { DHAKA_CITY_THANAS } from "@/lib/bd-geo";
import { CONTACT } from "@/lib/contact";
import { DEFAULT_TOGGLES } from "@/server/auth/permissions";

/**
 * Every setting the dashboard can edit, one Zod schema per section. Each field has a default, so a
 * fresh database (or a section added later) always reads as a complete, valid value. Money is in
 * poisha. Secrets never live here: they are environment variables (see .env.example).
 */
const poisha = z.number().int().min(0).max(100_000_00);

export const SETTINGS_SCHEMAS = {
  store: z.object({
    name: z.string().trim().min(1).max(80).default("ZALFI"),
    contactPhone: z.string().trim().max(30).default(CONTACT.phoneDisplay),
    email: z.string().trim().email().max(120).default(CONTACT.email),
    address: z.string().trim().max(300).default(CONTACT.address.join(", ")),
  }),
  /** Appears on receipts and invoices when filled in */
  invoice: z.object({
    businessName: z.string().trim().max(120).default(""),
    address: z.string().trim().max(300).default(""),
    tradeLicence: z.string().trim().max(60).default(""),
    bin: z.string().trim().max(60).default(""),
    vatEnabled: z.boolean().default(false),
    /** Percent, e.g. 15 */
    vatRate: z.number().min(0).max(100).default(0),
    footerNote: z.string().trim().max(500).default(""),
  }),
  shipping: z.object({
    insideDhakaFee: poisha.default(7_000),
    outsideDhakaFee: poisha.default(20_000),
    /** Dhaka district areas that count as "Inside Dhaka" */
    insideDhakaAreas: z
      .array(z.string().trim().min(1).max(60))
      .max(200)
      .default([...DHAKA_CITY_THANAS]),
    /** Orders at or above this subtotal ship free. Null: off. */
    freeShippingThreshold: poisha.nullable().default(null),
    defaultCourier: z.enum(["mock", "pathao", "steadfast"]).default("mock"),
  }),
  payments: z.object({
    sslcommerzEnabled: z.boolean().default(true),
    /** Cash on Delivery: off by default */
    codEnabled: z.boolean().default(false),
    /** Unpaid online-payment orders lapse (and release their stock) after this long */
    unpaidExpiryMinutes: z
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .default(30),
  }),
  inventory: z.object({
    lowStockThreshold: z.number().int().min(0).max(10_000).default(5),
  }),
  /** Owner-only switches that widen what managers may do (src/server/auth/permissions.ts) */
  permissions: z.object({
    managersCanRefund: z.boolean().default(DEFAULT_TOGGLES.managersCanRefund),
    managersSeeRevenue: z.boolean().default(DEFAULT_TOGGLES.managersSeeRevenue),
  }),
  /**
   * Which provider each integration uses. "mock"/"dev" run everything locally; a live provider is
   * used only when its keys are in the environment too (see docs/guides/deploy-vercel.md).
   */
  integrations: z.object({
    payments: z.enum(["mock", "sslcommerz"]).default("mock"),
    sms: z.enum(["dev", "bulksmsbd"]).default("dev"),
    email: z.enum(["dev", "resend"]).default("dev"),
    storage: z.enum(["local", "blob"]).default("local"),
  }),
};

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type Settings<K extends SettingsKey> = z.output<(typeof SETTINGS_SCHEMAS)[K]>;
export const SETTINGS_KEYS = Object.keys(SETTINGS_SCHEMAS) as SettingsKey[];

/** A section's value from whatever is stored: unknown fields are dropped, missing ones defaulted. */
export function parseSettings<K extends SettingsKey>(key: K, stored: unknown): Settings<K> {
  const schema = SETTINGS_SCHEMAS[key];
  const res = schema.safeParse(stored ?? {});
  if (res.success) return res.data as Settings<K>;
  // A stored value that no longer validates (an old shape): keep what still does, default the rest
  const base = schema.parse({}) as Record<string, unknown>;
  const raw = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  for (const field of Object.keys(base)) {
    const one = schema.shape[field as keyof typeof schema.shape] as z.ZodType;
    const ok = one.safeParse(raw[field]);
    if (ok.success) base[field] = ok.data;
  }
  return base as Settings<K>;
}

export const defaultSettings = <K extends SettingsKey>(key: K) => parseSettings(key, {});
