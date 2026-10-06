import type { Metadata } from "next";
import { TrackForm } from "@/components/cart/TrackForm";
import { whatsappUrl } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Find your ZALFI order with its number and your mobile number.",
  alternates: { canonical: "/track" },
};

/** Where's my order: the number and the phone open the order's own page */
export default function TrackPage() {
  return (
    <main id="main" className="bg-bone text-noir px-gutter min-h-svh pt-36 pb-32 md:pt-48">
      <div className="grid grid-cols-12 gap-x-4 gap-y-12">
        <p className="eyebrow text-smoke col-span-12 md:col-span-2">Your order</p>
        <div className="col-span-12 md:col-span-5">
          <h1 className="font-display text-[clamp(3rem,7vw,7rem)] leading-[0.9]">
            Where is
            <br />
            <span className="display-italic">my order?</span>
          </h1>
          <p className="text-smoke mt-8 max-w-sm leading-relaxed">
            Its status, its parcel, and how to pay if it&rsquo;s still waiting.
          </p>
        </div>
        <div className="col-span-12 md:col-span-4 md:col-start-9 md:pt-4">
          <TrackForm />
          <p className="text-smoke mt-8 text-sm">
            Can&rsquo;t find the number?{" "}
            <a
              href={whatsappUrl("Hi ZALFI, I'm looking for my order")}
              target="_blank"
              rel="noreferrer"
              className="text-noir border-noir/40 border-b"
            >
              WhatsApp us
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
