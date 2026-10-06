import clsx from "clsx";
import { whatsappUrl } from "@/lib/contact";
import { formatPrice } from "@/lib/money";
import { paymentMarks, usually, type ShopTerms } from "@/lib/terms";

/**
 * Delivery and payment, where shoppers decide (under Add to bag, and in the bag): the fee and the
 * usual time inside and outside Dhaka, free delivery, how to pay, and WhatsApp for questions.
 * Every line follows Settings; a line with nothing to say isn't shown.
 */
export function DeliveryNote({
  terms: t,
  className,
  whatsappText,
}: {
  terms: ShopTerms;
  className?: string;
  /** The first line of the WhatsApp message, e.g. "Hi, a question about Bond" */
  whatsappText?: string;
}) {
  const marks = paymentMarks(t);
  const rows = [
    ["Inside Dhaka", t.insideFee, t.insideDays],
    ["Outside Dhaka", t.outsideFee, t.outsideDays],
  ] as const;
  return (
    <div className={clsx("text-sm", className)}>
      <dl className="divide-y divide-current/15 border-y border-current/15">
        {rows.map(([label, fee, days]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="eyebrow opacity-70">{label}</dt>
            <dd className="text-right">
              {fee === 0 ? "Free delivery" : `${formatPrice(fee)} delivery`}
              {days && <span className="opacity-70"> · {usually(days)}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {t.freeFrom !== null && (
        <p className="mt-3">Free delivery on orders over {formatPrice(t.freeFrom)}.</p>
      )}
      {marks.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Ways to pay">
          <span className="eyebrow mr-1 opacity-70">Pay with</span>
          {marks.map((m) => (
            <span key={m} className="border border-current/25 px-2 py-0.5 text-xs">
              {m}
            </span>
          ))}
        </p>
      )}
      <p className="mt-4 opacity-80">
        Questions?{" "}
        <a
          href={whatsappUrl(whatsappText)}
          target="_blank"
          rel="noreferrer"
          data-cursor="Chat"
          className="border-b border-current/40 pb-px"
        >
          WhatsApp us
        </a>
      </p>
    </div>
  );
}
