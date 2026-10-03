import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/cart/CheckoutFlow";
import { CheckoutSummary } from "@/components/cart/CheckoutSummary";
import { DHAKA_AREAS } from "@/lib/bd-geo";
import { checkoutOpen, phoneFromCookie } from "@/server/checkout/http";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/** Guest checkout: details, phone code, address, payment. Prices come from the server. */
export default async function CheckoutPage() {
  const open = checkoutOpen();
  const [verifiedPhone, shipping] = open
    ? await Promise.all([phoneFromCookie().catch(() => null), getSettings("shipping")])
    : [null, null];
  // Dhaka's areas: the city thanas and upazilas, plus anything the owner added to the list
  const dhakaAreas = [...new Set([...DHAKA_AREAS, ...(shipping?.insideDhakaAreas ?? [])])].sort(
    (a, b) => a.localeCompare(b),
  );

  return (
    <main id="main" className="bg-bone px-gutter text-noir min-h-svh pt-36 pb-24">
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <div className="col-span-12 md:col-span-7">
          <p className="eyebrow text-smoke">Checkout</p>
          <h1 className="font-display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.9]">
            Almost <span className="display-italic">yours.</span>
          </h1>
        </div>
        {open ? (
          <CheckoutFlow verifiedPhone={verifiedPhone} dhakaAreas={dhakaAreas} />
        ) : (
          <>
            <p className="text-smoke col-span-12 max-w-sm leading-relaxed md:col-span-5">
              Online checkout opens soon. Your bag is saved on this device, and nothing has been
              charged.
            </p>
            <div className="col-span-12 md:col-span-6 md:col-start-7">
              <CheckoutSummary />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
