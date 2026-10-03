/**
 * Times are stored in UTC and shown in Bangladesh time (Asia/Dhaka, UTC+6, no daylight saving).
 * Reports group days by Dhaka midnight (see dhakaDayStart).
 */
export const TIME_ZONE = "Asia/Dhaka";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dateOnly = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

/** 2 Oct 2026, 5:10 pm */
export const formatDateTime = (d: Date | string | number) => dateTime.format(toDate(d));
/** 2 Oct 2026 */
export const formatDate = (d: Date | string | number) => dateOnly.format(toDate(d));

/** The UTC instant of midnight in Dhaka on the Dhaka calendar day containing `d` */
export function dhakaDayStart(d: Date = new Date()) {
  const offsetMs = 6 * 3600_000;
  const local = new Date(d.getTime() + offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMs);
}

/** "3 minutes ago", "yesterday", or the date */
export function formatRelative(d: Date | string | number, now: Date = new Date()) {
  const ms = now.getTime() - toDate(d).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

/** A Date as a `datetime-local` value in Dhaka time: "2026-10-05T18:30" */
export function toDhakaInput(d: Date | string | null) {
  if (!d) return "";
  return new Date(toDate(d).getTime() + 6 * 3600_000).toISOString().slice(0, 16);
}

/** A `datetime-local` value typed in Dhaka time, as an ISO instant: "2026-10-05T18:30:00+06:00" */
export const fromDhakaInput = (v: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+06:00` : null;
