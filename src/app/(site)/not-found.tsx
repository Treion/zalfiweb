import Link from "next/link";
import { getFragrances } from "@/db/queries";
import { countWord } from "@/lib/words";

export default async function NotFound() {
  const count = (await getFragrances()).length;
  return (
    <main id="main" className="bg-noir px-gutter text-bone grid min-h-svh place-items-center">
      <div className="max-w-xl">
        <p className="eyebrow text-bone-dim">404</p>
        <h1 className="font-display mt-6 text-[clamp(3rem,8vw,7rem)] leading-[0.9]">
          This world
          <br />
          <span className="display-italic">doesn&rsquo;t exist.</span>
        </h1>
        <p className="text-bone-dim mt-8">{`${countWord(count, true)} others do.`}</p>
        <Link href="/#collection" className="eyebrow border-bone mt-8 inline-block border-b pb-1">
          See the collection
        </Link>
      </div>
    </main>
  );
}
