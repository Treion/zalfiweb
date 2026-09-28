import { lineupOpen } from "@/components/stage/choreography";
import { ROOM_FOLLOW_S } from "@/components/stage/config";
import { stageState } from "@/components/stage/stage-state";

/**
 * The line-up's hover preview: hovering a bottle fills the room with its world. The stage washes
 * the background (stageState.collectionHover); the line-up's words and the nav take that world's
 * ink over the same time (the registered --room-ink property transitions; see globals.css), so
 * text never sits in a colour it can't be read on.
 *
 * html[data-room] is set while a preview is showing or fading out: it switches the nav from its
 * blend mode to the plain ink colour. It is only cleared once the room is back in the house dark,
 * where the two look the same, so the switch is never seen.
 */

/** The DOM ink transition, matched to the stage's colour follow (critically damped, ~3 smooth times) */
const ROOM_MS = ROOM_FOLLOW_S * 3000;
/** Moving across the gap between two bottles shouldn't flash the house dark in between */
const LEAVE_MS = 160;

let leaving: number | undefined;
let settling: number | undefined;
let shown = false;

function paint(ink: string | null) {
  const html = document.documentElement;
  window.clearTimeout(settling);
  if (ink) {
    html.dataset.room = "";
    html.style.setProperty("--room-to", ink);
    shown = true;
  } else if (shown) {
    shown = false;
    html.style.removeProperty("--room-to");
    settling = window.setTimeout(() => delete html.dataset.room, ROOM_MS);
  }
}

/** A bottle in the line-up is hovered or focused */
export function enterWorld(index: number, ink: string) {
  window.clearTimeout(leaving);
  if (lineupOpen(stageState.s, stageState.k) < 0.5) return;
  stageState.collectionHover = index;
  // Only the stage washes the room; without it (still loading, or the static layout) the text
  // stays in the house colours
  if (document.documentElement.classList.contains("stage-ready")) paint(ink);
}

/** The pointer or focus left bottle `index` */
export function leaveWorld(index: number) {
  window.clearTimeout(leaving);
  leaving = window.setTimeout(() => {
    if (stageState.collectionHover === index) closeRoom();
  }, LEAVE_MS);
}

/** Back to the house colours (a scroll away from the line-up, or leaving the page) */
export function closeRoom() {
  window.clearTimeout(leaving);
  stageState.collectionHover = -1;
  paint(null);
}

/** Whether a preview is showing (cheap check for per-frame callers) */
export const roomOpen = () => shown || stageState.collectionHover >= 0;

/** At once, with no fade: the line-up is unmounting (a navigation), and the next page has its own light */
export function resetRoom() {
  window.clearTimeout(leaving);
  window.clearTimeout(settling);
  stageState.collectionHover = -1;
  shown = false;
  const html = document.documentElement;
  html.style.removeProperty("--room-to");
  delete html.dataset.room;
}
