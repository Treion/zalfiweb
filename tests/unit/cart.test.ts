import { describe, expect, it } from "vitest";
import { cartReducer, type CartLine } from "@/components/cart/cart-store";

const line = (sku: string, qty = 1, pricePoisha = 300000): CartLine => ({
  sku,
  slug: sku.toLowerCase(),
  name: sku,
  sizeMl: 50,
  pricePoisha,
  bottleImage: `/images/bottles/${sku.toLowerCase()}.png`,
  qty,
});
const empty = { lines: [], open: false, hydrated: false };
const reva: Omit<CartLine, "qty"> = {
  sku: "REVA",
  slug: "reva",
  name: "REVA",
  sizeMl: 50,
  pricePoisha: 300000,
  bottleImage: "/images/bottles/reva.png",
};

describe("the bag", () => {
  it("keeps what was added before the saved bag was read", () => {
    let s = cartReducer(empty, { type: "add", line: reva, qty: 1 });
    s = cartReducer(s, { type: "hydrate", lines: [line("REVA", 2), line("BOND")] });
    expect(s.lines.map((l) => [l.sku, l.qty])).toEqual([
      ["REVA", 3],
      ["BOND", 1],
    ]);
    expect(s.open).toBe(true);
  });

  it("reads the saved bag once, even when the effect runs twice", () => {
    const saved = [line("REVA", 2)];
    let s = cartReducer(empty, { type: "hydrate", lines: saved });
    s = cartReducer(s, { type: "hydrate", lines: saved });
    expect(s.lines).toEqual(saved);
  });

  it("a new catalogue reprices the bag and drops what's no longer sold, keeping what was just added", () => {
    let s = cartReducer(empty, { type: "hydrate", lines: [line("REVA"), line("OLD-100")] });
    s = cartReducer(s, { type: "add", line: { ...reva, sku: "SET" }, qty: 1 });
    s = cartReducer(s, { type: "reprice", catalogue: { REVA: 320000, SET: 150000 } });
    expect(s.lines.map((l) => [l.sku, l.pricePoisha])).toEqual([
      ["REVA", 320000],
      ["SET", 150000],
    ]);
  });
});
