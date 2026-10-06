import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Sections that fold open, as perfume houses lay out a product page: built on <details>, so they
 * work without JavaScript. Opening fades the text in; nothing slides. Ink and hairlines come from
 * the page around them (a fragrance's world, or bone paper).
 */
export function Folds({
  items,
  className,
}: {
  items: { title: string; body: ReactNode; open?: boolean }[];
  className?: string;
}) {
  return (
    <div className={clsx("divide-y divide-current/15 border-y border-current/15", className)}>
      {items.map((it) => (
        <details key={it.title} open={it.open} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 [&::-webkit-details-marker]:hidden">
            <span className="eyebrow">{it.title}</span>
            <span aria-hidden className="relative block size-3">
              <span className="absolute top-1/2 left-0 block h-px w-3 bg-current" />
              <span className="absolute top-0 left-1/2 block h-3 w-px bg-current transition-opacity duration-300 group-open:opacity-0" />
            </span>
          </summary>
          <div className="info-reveal pb-6 text-sm leading-relaxed">{it.body}</div>
        </details>
      ))}
    </div>
  );
}
