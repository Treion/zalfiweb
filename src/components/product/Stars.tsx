import clsx from "clsx";

/** One five-point star in the site's hairline, drawn here (no icon set) */
export function StarMark({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={clsx("size-[0.9em] shrink-0", className)}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinejoin="round"
    >
      <path d="M12 2.8l2.75 5.9 6.45.75-4.8 4.4 1.3 6.35L12 17l-5.7 3.2 1.3-6.35-4.8-4.4 6.45-.75z" />
    </svg>
  );
}

/** A rating as five stars, read aloud as words ("4 out of 5") */
export function Stars({
  rating,
  className,
  label = true,
}: {
  rating: number;
  className?: string;
  /** Off where the number is already said next to it */
  label?: boolean;
}) {
  const full = Math.round(rating);
  return (
    <span
      className={clsx("inline-flex items-center gap-0.5", className)}
      role={label ? "img" : undefined}
      aria-label={label ? `${rating} out of 5` : undefined}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <StarMark key={n} filled={n <= full} />
      ))}
    </span>
  );
}
