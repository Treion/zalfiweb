import type { Palette } from "@/lib/fragrance";

/** The house world: shown for the intro, hero and collection. */
export const HOUSE_PALETTE: Palette = {
  bg: "#0E0D0C",
  deep: "#050505",
  accent: "#C8B89A",
  ink: "#EFEAE1",
};

export type StageFragrance = {
  slug: string;
  name: string;
  palette: Palette;
  capFinish: string;
};
