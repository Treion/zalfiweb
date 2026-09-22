import { Logo } from "@/components/brand/Logo";

/**
 * Temporary landing (M0). The cinematic intro, hero and fragrance chapters replace this in M3–M5.
 */
export default function Home() {
  return (
    <main id="main" className="bg-noir px-gutter text-bone grid min-h-svh place-items-center">
      <div className="flex flex-col items-center gap-10">
        <Logo className="w-[min(58vw,26rem)]" />
        <p className="eyebrow text-bone-dim">Maison de parfum</p>
      </div>
    </main>
  );
}
