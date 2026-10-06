import clsx from "clsx";
import { ratingLabel, type ReviewSummary } from "@/lib/reviews";
import { formatDate } from "@/lib/time";
import { countWord } from "@/lib/words";
import { Stars } from "./Stars";

/** The average beside the name, linking down to the reviews */
export function RatingLine({
  summary,
  href = "#reviews",
  className,
}: {
  summary: ReviewSummary;
  href?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={clsx("inline-flex items-center gap-3 text-sm", className)}
      aria-label={ratingLabel(summary.average, summary.count)}
    >
      <Stars rating={summary.average} label={false} />
      <span className="tabular-nums">{summary.average.toFixed(1)}</span>
      <span className="border-b border-current/40 opacity-70">
        {summary.count} {summary.count === 1 ? "review" : "reviews"}
      </span>
    </a>
  );
}

/**
 * Reviews from verified buyers, approved by the house, with its replies. Only rendered once there
 * is at least one, so it never stands empty. Ink and hairlines come from the page's world.
 */
export function Reviews({
  summary,
  name,
  id = "reviews",
  limit,
  className,
}: {
  summary: ReviewSummary;
  name: string;
  id?: string;
  /** How many to list (all that were loaded by default) */
  limit?: number;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={clsx("scroll-mt-28 border-t border-current/15 pt-8", className)}
    >
      <div className="flex items-baseline justify-between gap-6">
        <h2 id={`${id}-title`} className="eyebrow opacity-70">
          Worn by
        </h2>
        <p className="eyebrow opacity-70">Verified buyers</p>
      </div>
      <p className="mt-6 flex items-end gap-5">
        <span className="font-display text-7xl leading-none tabular-nums">
          {summary.average.toFixed(1)}
        </span>
        <span className="pb-1.5">
          <Stars rating={summary.average} label={false} className="text-lg" />
          <span className="mt-1 block text-sm opacity-70">
            {`${countWord(summary.count, true)} ${summary.count === 1 ? "review" : "reviews"} of ${name}`}
          </span>
        </span>
        <span className="sr-only">{ratingLabel(summary.average, summary.count)}</span>
      </p>
      <ul className="mt-10 divide-y divide-current/15 border-y border-current/15">
        {summary.reviews.slice(0, limit).map((r) => (
          <li key={r.id} className="py-7">
            <Stars rating={r.rating} />
            {r.body && (
              <p className="display-italic mt-4 text-xl leading-snug whitespace-pre-line">
                {r.body}
              </p>
            )}
            <p className="eyebrow mt-4 opacity-70">
              {r.name} · <time dateTime={r.date}>{formatDate(r.date)}</time>
            </p>
            {r.reply && (
              <div className="mt-5 border-l border-current/30 pl-4">
                <p className="eyebrow opacity-70">ZALFI replied</p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
