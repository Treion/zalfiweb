import { z } from "zod";
import { DHAKA_CITY_THANAS } from "@/lib/bd-geo";
import { CONTACT } from "@/lib/contact";
import { DEFAULT_TOGGLES } from "@/server/auth/permissions";
import { EMAIL_PROVIDERS, SMS_PROVIDERS } from "@/server/integrations/catalog";
import { COURIER_NAMES } from "@/server/shipping/types";

/**
 * Every setting the dashboard can edit, one Zod schema per section. Each field has a default, so a
 * fresh database (or a section added later) always reads as a complete, valid value. Money is in
 * poisha. Provider keys never live here: they are sealed in the integrations table (Admin →
 * Integrations), or come from environment variables.
 */
const poisha = z.number().int().min(0).max(100_000_00);

/** A mobile wallet that takes manual payments: the number customers send money to */
const wallet = z
  .object({
    enabled: z.boolean().default(false),
    /** Empty, or a Bangladeshi mobile number (checked when saved) */
    number: z
      .string()
      .trim()
      .max(20)
      .refine(
        (n) => n === "" || /^01[3-9]\d{8}$/.test(n.replace(/[\s-]/g, "")),
        "Use an 11-digit mobile number",
      )
      .default(""),
    /** Personal: Send Money. Merchant: Payment. Agent: Cash In. */
    accountType: z.enum(["personal", "merchant", "agent"]).default("personal"),
  })
  .prefault({});

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
    defaultCourier: z.enum(COURIER_NAMES).default("mock"),
    /** "Other courier": parcels sent another way, recorded and moved along by the team */
    manualCourierEnabled: z.boolean().default(true),
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
    /**
     * bKash or Nagad Send Money, confirmed by the team: for when the gateways are down, or for
     * customers who prefer it. Set up in Admin → Integrations.
     */
    manual: z
      .object({
        enabled: z.boolean().default(false),
        /** How long an order waits for its transaction ID before it lapses */
        holdHours: z.number().int().min(1).max(72).default(24),
        bkash: wallet,
        nagad: wallet,
      })
      .prefault({}),
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
   * Providers are set up and switched on in Admin → Integrations (src/server/integrations). This
   * section keeps only the choices that aren't a provider's own: which online gateway checkout
   * tries first, and the order SMS gateways and email services are tried in (the next takes
   * over when one fails). (Photos go to Vercel Blob whenever its token is set.)
   */
  integrations: z.object({
    gatewayOrder: z
      .array(z.enum(["sslcommerz", "aamarpay"]))
      .length(2)
      .refine((a) => new Set(a).size === 2, "Each gateway once")
      .default(["sslcommerz", "aamarpay"]),
    smsOrder: z
      .array(z.enum(SMS_PROVIDERS))
      .max(SMS_PROVIDERS.length)
      .default([...SMS_PROVIDERS]),
    emailOrder: z
      .array(z.enum(EMAIL_PROVIDERS))
      .max(EMAIL_PROVIDERS.length)
      .default([...EMAIL_PROVIDERS]),
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
