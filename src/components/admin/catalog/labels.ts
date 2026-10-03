import type { CAP_FINISHES } from "@/server/catalog/schema";

export const CAP_LABELS: Record<(typeof CAP_FINISHES)[number], string> = {
  silver: "Silver, ribbed",
  gunmetal: "Gunmetal, ribbed",
  gold: "Gold, ribbed",
  chrome: "Chrome sphere",
  black: "Black sphere",
  "gold-sphere": "Gold sphere",
};

export const LAYER_LABELS = { top: "Top", heart: "Heart", base: "Base" } as const;
