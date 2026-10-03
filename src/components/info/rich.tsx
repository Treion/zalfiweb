import Link from "next/link";
import { Fragment } from "react";

/** Text with links written as [label](/path). Internal paths use next/link. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!m) return <Fragment key={i}>{part}</Fragment>;
        const [, label, href] = m;
        const cls = "text-bone border-b border-current/40 transition-colors hover:border-current";
        return href!.startsWith("/") ? (
          <Link key={i} href={href!} className={cls}>
            {label}
          </Link>
        ) : (
          <a key={i} href={href} className={cls} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      })}
    </>
  );
}
