import clsx from "clsx";

/**
 * Splits text into masked words for typographic reveals (no paid SplitText plugin needed).
 * Each word's inner span carries data-w; timelines animate it from yPercent 110 → 0.
 * Assistive tech reads the intact sentence from the visually hidden copy.
 */
export function SplitWords({
  text,
  className,
  wordClassName,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span
            key={i}
            className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom"
          >
            <span data-w data-reveal className={clsx("inline-block", wordClassName)}>
              {w}
            </span>
            {i < words.length - 1 && " "}
          </span>
        ))}
      </span>
    </span>
  );
}
