import "server-only";
import { cache } from "react";
import { checkoutMethods } from "@/server/checkout/quote";
import { getSettings, parseSettings } from "@/server/settings";
import type { ShopTerms } from "@/lib/terms";

/**
 * The shop's delivery and payment terms, from Settings (and which gateways are really on), for the
 * product pages, /discovery and the bag. Cached per request. Without a database it falls back to
 * the defaults and claims no payment method, so it never promises what checkout won't offer.
 */
export const getShopTerms = cache(async (): Promise<ShopTerms> => {
  const ship = parseSettings("shipping", undefined);
  const fallback: ShopTerms = {
    insideFee: ship.insideDhakaFee,
    outsideFee: ship.outsideDhakaFee,
    insideDays: ship.insideDhakaDays,
    outsideDays: ship.outsideDhakaDays,
    freeFrom: ship.freeShippingThreshold,
    online: false,
    cod: false,
    wallets: [],
  };
  if (!process.env.DATABASE_URL) return fallback;
  try {
    const [s, { pay, methods }] = await Promise.all([getSettings("shipping"), checkoutMethods()]);
    const wallets = methods.includes("manual")
      ? [
          ...(pay.manual.bkash.enabled && pay.manual.bkash.number ? ["bKash"] : []),
          ...(pay.manual.nagad.enabled && pay.manual.nagad.number ? ["Nagad"] : []),
        ]
      : [];
    return {
      insideFee: s.insideDhakaFee,
      outsideFee: s.outsideDhakaFee,
      insideDays: s.insideDhakaDays,
      outsideDays: s.outsideDhakaDays,
      freeFrom: s.freeShippingThreshold,
      online: methods.includes("sslcommerz"),
      cod: methods.includes("cod"),
      wallets,
    };
  } catch (err) {
    console.warn("[terms] using defaults:", (err as Error).message);
    return fallback;
  }
});
