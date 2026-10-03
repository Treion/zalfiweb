/** How a parcel came back. Pure, so the admin's client components can use it too. */
export const RETURN_CONDITIONS = ["unopened", "opened", "damaged", "missing"] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  unopened: "Unopened, as sent",
  opened: "Opened",
  damaged: "Damaged",
  missing: "Bottles missing",
};
