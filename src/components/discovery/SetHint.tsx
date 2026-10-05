import Link from "next/link";
import clsx from "clsx";
import { companions, setsFor, type DiscoverySet } from "@/lib/discovery";
import { listNames } from "@/lib/words";

/** One quiet line under a fragrance's Add: the discovery set it's in, to try it first */
export function SetHint({
  sets,
  slug,
  className,
}: {
  sets: DiscoverySet[];
  slug: string;
  className?: string;
}) {
  const set = setsFor(sets, slug)[0];
  if (!set) return null;
  return (
    <p className={clsx("text-sm", className)}>
      Try it first: in the{" "}
      <Link
        href={`/discovery#${set.slug}`}
        data-cursor="Discover"
        className="border-b border-current/40 pb-px"
      >
        {set.name}
      </Link>
      , with {listNames(companions(set, slug))}.
    </p>
  );
}
