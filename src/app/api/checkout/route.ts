import { z } from "zod";
import { bagSchema } from "@/lib/checkout";
import { priceBag } from "@/server/checkout/quote";
import { checkoutOpen, noStore } from "@/server/checkout/http";
import { poolDb } from "@/server/db/pool";

// The bag's "Checkout" button: checks the bag can be bought (prices and stock are re-read here,
// never taken from the browser), then sends the customer to the checkout page.

export type CheckoutResponse =
  | { status: "ready"; url: string }
  | { status: "unavailable"; message: string }
  | { status: "invalid"; message: string };

const Body = z.object({ items: bagSchema }).strict();
const reply = (r: CheckoutResponse, status = 200) => Response.json(r, { status, headers: noStore });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ status: "invalid", message: "Your bag looks empty." }, 422);
  if (!checkoutOpen())
    return reply({
      status: "unavailable",
      message: "Checkout opens soon. Your bag is saved on this device.",
    });
  try {
    const { lines, unavailable } = await priceBag(poolDb(), parsed.data.items);
    if (unavailable.length)
      return reply(
        {
          status: "invalid",
          message: "Something in your bag has sold out. Remove it to continue.",
        },
        409,
      );
    const short = lines.find((l) => l.qty > l.available);
    if (short)
      return reply(
        {
          status: "invalid",
          message: `Only ${short.available} ${short.name} left. Adjust the quantity.`,
        },
        409,
      );
    return reply({ status: "ready", url: "/checkout" });
  } catch (e) {
    console.error("[checkout]", e);
    return reply({ status: "invalid", message: "We couldn't check your bag. Try again." }, 503);
  }
}
