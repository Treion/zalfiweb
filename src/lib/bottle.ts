import { BOTTLE_META, type BottleMeta } from "@/components/stage/bottle-meta";

/**
 * Where a bottle's layout data and WebGL relighting maps come from:
 *  - an admin-uploaded photo: stored on the fragrance (bottle_meta, bottle_maps)
 *  - the launch bottles: the generated BOTTLE_META and /images/bottles/maps/{slug}
 *  - neither (a new fragrance before its photo): a neutral full-frame layout and no maps, so the
 *    stage leaves it to the DOM photo instead of drawing it
 */
export type Bottle = { meta: BottleMeta; maps: string | null };
export type { BottleMeta };

const neutral = (slug: string): BottleMeta => ({
  slug,
  source: { w: 2000, h: 2000 },
  trim: { x: 0, y: 0, w: 2000, h: 2000 },
  shoulder: 0.37,
  capShape: "cylinder",
  capTint: [0.5, 0.5, 0.5],
});

export function resolveBottle(
  slug: string,
  meta?: BottleMeta | null,
  maps?: string | null,
): Bottle {
  if (meta && maps) return { meta, maps };
  const generated = BOTTLE_META[slug];
  if (generated) return { meta: generated, maps: `/images/bottles/maps/${slug}` };
  return { meta: neutral(slug), maps: null };
}
