import type { PathaoPlace } from "./pathao";

/**
 * Matching our address (district, area) to Pathao's city and zone lists. Pathao spells several
 * districts the older way (Chittagong, Comilla, Bogra…), so names are compared after normalising
 * and through a list of known spellings. When nothing matches, the admin picks the zone by hand.
 */
const ALIASES: Record<string, string[]> = {
  chattogram: ["chittagong", "ctg"],
  cumilla: ["comilla"],
  bogura: ["bogra"],
  jashore: ["jessore"],
  barishal: ["barisal"],
  jhalokathi: ["jhalokati", "jhalakathi"],
  chapainawabganj: ["chapainababganj", "nawabganj", "chapai"],
  moulvibazar: ["maulvibazar", "moulvi bazar"],
  netrokona: ["netrakona"],
  khagrachhari: ["khagrachari"],
  lakshmipur: ["laxmipur", "lakhsmipur"],
  narsingdi: ["narshingdi"],
  coxsbazar: ["coxs bazar", "cox bazar"],
  brahmanbaria: ["b baria", "bbaria"],
  kishoreganj: ["kishorganj"],
  panchagarh: ["panchagar"],
  thakurgaon: ["thakurgoan"],
  gaibandha: ["gaibanda"],
  sirajganj: ["sirajgonj"],
  munshiganj: ["munsiganj"],
  shariatpur: ["sariatpur"],
  "sher e bangla nagar": ["sher-e-bangla nagar", "agargaon"],
  bimanbandar: ["airport"],
};

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");

function names(name: string) {
  const n = norm(name);
  const extra = Object.entries(ALIASES).flatMap(([k, v]) =>
    norm(k) === n || v.some((a) => norm(a) === n) ? [k, ...v] : [],
  );
  return [...new Set([n, ...extra.map(norm)])];
}

/**
 * The best place for a name: an exact match (or a known spelling), else the shortest place whose
 * name starts with it or that it starts with ("Mirpur" ↔ "Mirpur 10"), else none.
 */
export function matchPlace(list: PathaoPlace[], name: string): PathaoPlace | null {
  const wanted = names(name);
  const exact = list.find((p) => wanted.includes(norm(p.name)));
  if (exact) return exact;
  const loose = list
    .filter((p) => {
      const n = norm(p.name);
      return wanted.some(
        (w) => w.length >= 4 && n.length >= 4 && (n.startsWith(w) || w.startsWith(n)),
      );
    })
    .sort((a, b) => a.name.length - b.name.length);
  return loose[0] ?? null;
}
