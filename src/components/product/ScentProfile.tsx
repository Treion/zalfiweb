import clsx from "clsx";
import type { ReactNode } from "react";
import type { ScentProfile as Profile } from "@/lib/fragrance";

const LONGEVITY = ["", "A few hours", "Half a day", "Most of the day", "All day", "Into tomorrow"];
const SILLAGE = ["", "Close to the skin", "Soft", "Noticed", "Generous", "Fills the room"];

const list = (words: string[]) =>
  words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(", ");

/** The scent's character: family, how long it lasts, how far it carries, and when to wear it. */
export function ScentProfile({ profile }: { profile: Profile | null }) {
  if (!profile) return null;
  return (
    <section aria-labelledby="character-title">
      <h2 id="character-title" className="eyebrow opacity-70">
        The character
      </h2>
      <p className="display-italic mt-5 text-3xl leading-tight">{profile.family}</p>
      <dl className="mt-8 divide-y divide-current/15 border-y border-current/15">
        <Row label="Longevity">
          <Meter value={profile.longevity} />
          <span>
            {LONGEVITY[profile.longevity]}
            <span className="sr-only">, {profile.longevity} of 5</span>
          </span>
        </Row>
        <Row label="Sillage">
          <Meter value={profile.sillage} />
          <span>
            {SILLAGE[profile.sillage]}
            <span className="sr-only">, {profile.sillage} of 5</span>
          </span>
        </Row>
        <Row label="Season">
          <span className="display-italic text-lg">{list(profile.seasons)}</span>
        </Row>
        <Row label="Wear it">
          <span className="display-italic text-lg">{list(profile.moments)}</span>
        </Row>
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-4 py-4">
      <dt className="eyebrow opacity-70">{label}</dt>
      <dd className="flex items-center gap-5 text-sm">{children}</dd>
    </div>
  );
}

/** Five hairline segments: an instrument reading, not a rating */
function Meter({ value }: { value: number }) {
  return (
    <span aria-hidden className="flex w-24 shrink-0 gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={clsx("h-px flex-1 bg-current", n > value && "opacity-25")} />
      ))}
    </span>
  );
}
