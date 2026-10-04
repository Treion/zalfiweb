import { mapMock } from "./status-mock";
import { mapPathao } from "./status-pathao";
import { mapRedx } from "./status-redx";
import { mapSteadfast } from "./status-steadfast";
import { CANCELLED_HERE, type CourierName, type MappedStatus } from "./types";

/** Any courier's status, in plain words (no keys needed) */
export function mapStatus(name: CourierName, status: string): MappedStatus {
  if (status === "creating") return { label: "Sending…", order: null, final: false };
  if (status === CANCELLED_HERE)
    return { label: "Cancelled before pickup", order: null, final: true };
  switch (name) {
    case "pathao":
      return mapPathao(status);
    case "steadfast":
      return mapSteadfast(status);
    case "redx":
      return mapRedx(status);
    case "manual":
    case "mock":
      return mapMock(status);
  }
}
