/** A parcel's public tracking page. Works without the courier's keys (for receipts sent later). */
export function trackingUrl(name: string, trackingCode: string | null, phone: string) {
  if (!trackingCode) return null;
  if (name === "pathao")
    return `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(trackingCode)}&phone=${encodeURIComponent(phone)}`;
  if (name === "steadfast") return `https://steadfast.com.bd/t/${encodeURIComponent(trackingCode)}`;
  if (name === "redx")
    return `https://redx.com.bd/track-parcel/?trackingId=${encodeURIComponent(trackingCode)}`;
  return null;
}
