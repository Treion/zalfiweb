/** How a size reads everywhere (bag, checkout, receipts, admin): "50 ml", or "3 × 3 ml" for a pack */
export const sizeLabel = (sizeMl: number, pieces = 1) =>
  pieces > 1 ? `${pieces} × ${sizeMl} ml` : `${sizeMl} ml`;
