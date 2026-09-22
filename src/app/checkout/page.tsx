import type { Metadata } from "next";
import { CheckoutSummary } from "@/components/cart/CheckoutSummary";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * Placeholder checkout. When Stripe is added, /api/checkout returns a Checkout Session URL and
 * Stripe redirects back here with ?status=success or ?status=cancelled.
 */
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const { status } = await searchParams;
  return (
    <main id="main" className="bg-bone px-gutter text-noir min-h-svh pt-36 pb-24">
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <div className="col-span-12 md:col-span-5">
          <p className="eyebrow text-smoke">Checkout</p>
          <h1 className="font-display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.9]">
            {status === "success" ? (
              <>
                Thank you.
                <br />
                <span className="display-italic">It&rsquo;s on its way.</span>
              </>
            ) : (
              <>
                Almost
                <br />
                <span className="display-italic">yours.</span>
              </>
            )}
          </h1>
          <p className="text-smoke mt-8 max-w-sm leading-relaxed">
            {status === "success"
              ? "A confirmation is on its way to your inbox."
              : "Online checkout opens soon. Your bag is saved on this device, and nothing has been charged."}
          </p>
        </div>
        <div className="col-span-12 md:col-span-6 md:col-start-7">
          <CheckoutSummary />
        </div>
      </div>
    </main>
  );
}
