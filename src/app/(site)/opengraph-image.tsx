import { getFragrances } from "@/db/queries";
import { OG_SIZE, houseOgImage } from "@/lib/og";

export const alt = "ZALFI: six eaux de parfum in smoked glass";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return houseOgImage(await getFragrances());
}
