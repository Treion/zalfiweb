import { z } from "zod";
import { DISTRICTS } from "@/lib/bd-geo";
import { normalisePhone } from "@/lib/phone";

/**
 * The checkout's inputs, shared by the browser (for instant feedback) and the server (which
 * validates everything again and never trusts the browser's prices or totals).
 */

/**
 * How a customer can pay. "sslcommerz" is the stored name of online payment through any gateway
 * (SSLCommerz or aamarPay, whichever the owner puts first); "manual" is bKash or Nagad Send Money,
 * confirmed by the team.
 */
export const PAYMENT_METHODS = ["sslcommerz", "manual", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  sslcommerz: "Pay online",
  manual: "bKash or Nagad (Send Money)",
  cod: "Cash on delivery",
};

export const MAX_QTY = 10;

export const phoneSchema = z
  .string()
  .trim()
  .max(24)
  .transform((v, ctx) => {
    const p = normalisePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a Bangladeshi mobile number, 01XXXXXXXXX." });
      return z.NEVER;
    }
    return p;
  });

export const bagSchema = z
  .array(
    z
      .object({ sku: z.string().trim().min(1).max(64), qty: z.number().int().min(1).max(MAX_QTY) })
      .strict(),
  )
  .min(1, "Your bag is empty.")
  .max(20);

export const couponCodeSchema = z
  .string()
  .trim()
  .max(40)
  .transform((v) => v.toUpperCase());

export const addressSchema = z.object({
  district: z.enum(DISTRICTS, "Choose a district."),
  area: z.string().trim().min(2, "Add your area or thana.").max(80),
  street: z.string().trim().min(5, "Add your house, road and street.").max(300),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Add your full name.").max(80),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("Add an email for your receipt.").max(254),
});

export const quoteSchema = z
  .object({
    items: bagSchema,
    district: z.enum(DISTRICTS).optional(),
    area: z.string().trim().max(80).optional(),
    coupon: couponCodeSchema.optional(),
  })
  .strict();

export const placeOrderSchema = z
  .object({
    ...contactSchema.shape,
    ...addressSchema.shape,
    items: bagSchema,
    coupon: couponCodeSchema.optional(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    /** The total the customer saw. If the server's differs (a price changed), nothing is placed. */
    expectedTotal: z.number().int().min(0),
    /** One per checkout attempt: the same key never creates a second order */
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  })
  .strict();

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/** What the server answers a quote with */
export type Quote = {
  lines: {
    sku: string;
    name: string;
    sizeMl: number;
    unitPrice: number;
    qty: number;
    lineTotal: number;
    available: number;
  }[];
  /** SKUs that can't be bought any more (sold out, hidden, removed) */
  unavailable: string[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  /** Null until the address says which zone */
  zone: "inside_dhaka" | "outside_dhaka" | null;
  total: number;
  coupon:
    | { code: string; ok: true; freeShipping: boolean }
    | { code: string; ok: false; message: string }
    | null;
  freeShippingFrom: number | null;
  methods: PaymentMethod[];
};
