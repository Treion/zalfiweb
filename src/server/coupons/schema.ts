import { z } from "zod";

/**
 * A coupon as the admin edits it. Money in poisha; dates as ISO strings (or null). Options combine:
 * a percentage (with an optional cap) or a fixed amount, free shipping, a minimum order, first
 * order only, usage limits, dates, and a fragrance or size restriction. One coupon per order.
 */
const poisha = z.number().int().min(0).max(100_000_00);
const date = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,29}$/, "3–30 letters, numbers, - or _"),
    description: z.string().trim().max(200),
    active: z.boolean(),
    percentOff: z.number().int().min(1).max(100).nullable(),
    maxDiscount: poisha.nullable(),
    amountOff: poisha.min(100).nullable(),
    freeShipping: z.boolean(),
    minSubtotal: poisha.nullable(),
    firstOrderOnly: z.boolean(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable(),
    perCustomerLimit: z.number().int().min(1).max(1000).nullable(),
    startsAt: date,
    endsAt: date,
    fragranceIds: z.array(z.number().int().positive()).max(100),
    variantIds: z.array(z.number().int().positive()).max(500),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.percentOff === null && c.amountOff === null && !c.freeShipping)
      ctx.addIssue({
        code: "custom",
        path: ["percentOff"],
        message: "Give it a discount: a percentage, an amount, or free shipping.",
      });
    if (c.percentOff !== null && c.amountOff !== null)
      ctx.addIssue({
        code: "custom",
        path: ["amountOff"],
        message: "Choose a percentage or a fixed amount, not both.",
      });
    if (c.maxDiscount !== null && c.percentOff === null)
      ctx.addIssue({
        code: "custom",
        path: ["maxDiscount"],
        message: "A cap only applies to a percentage.",
      });
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt)
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The end must be after the start.",
      });
  });

export type CouponInput = z.input<typeof couponSchema>;
export type CouponValues = z.output<typeof couponSchema>;
