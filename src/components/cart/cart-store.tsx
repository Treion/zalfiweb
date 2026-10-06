"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export type CartLine = {
  sku: string;
  slug: string;
  name: string;
  sizeMl: number;
  /** Vials in a discovery set's pack (absent for a bottle) */
  pieces?: number;
  /** "set": a discovery set (it links to /discovery, not a product page) */
  kind?: "set";
  pricePoisha: number;
  /** The bottle, or the set's box */
  bottleImage: string;
  qty: number;
};

/** Where a bag line leads */
export const lineHref = (l: Pick<CartLine, "kind" | "slug">) =>
  l.kind === "set" ? `/discovery#${l.slug}` : `/fragrances/${l.slug}`;

type State = { lines: CartLine[]; open: boolean; hydrated: boolean };

type Action =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "reprice"; catalogue: Record<string, number> }
  | { type: "add"; line: Omit<CartLine, "qty">; qty: number }
  | { type: "setQty"; sku: string; qty: number }
  | { type: "remove"; sku: string }
  | { type: "clear" }
  | { type: "open" }
  | { type: "close" };

const MAX_QTY = 10;
// v2: prices in poisha (BDT). A v1 bag held USD cents and is dropped.
const KEY = "zalfi.bag.v2";

/** The saved lines, then any added since, quantities summed */
function merge(saved: CartLine[], added: CartLine[]): CartLine[] {
  const lines = saved.map((l) => ({ ...l }));
  for (const n of added) {
    const l = lines.find((x) => x.sku === n.sku);
    if (l) l.qty = Math.min(MAX_QTY, l.qty + n.qty);
    else lines.push(n);
  }
  return lines;
}

/** Exported for tests */
export function cartReducer(state: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      // Once only (Strict Mode runs effects twice). Anything added before the saved bag was read
      // stays in it.
      if (state.hydrated) return state;
      return { ...state, lines: merge(a.lines, state.lines), hydrated: true };
    case "reprice":
      return {
        ...state,
        lines: state.lines
          .filter((l) => l.sku in a.catalogue)
          .map((l) => ({ ...l, pricePoisha: a.catalogue[l.sku]! })),
      };
    case "add": {
      const existing = state.lines.find((l) => l.sku === a.line.sku);
      const lines = existing
        ? state.lines.map((l) =>
            l.sku === a.line.sku ? { ...l, qty: Math.min(MAX_QTY, l.qty + a.qty) } : l,
          )
        : [...state.lines, { ...a.line, qty: Math.min(MAX_QTY, a.qty) }];
      return { ...state, lines, open: true };
    }
    case "setQty":
      return {
        ...state,
        lines: state.lines
          .map((l) => (l.sku === a.sku ? { ...l, qty: Math.min(MAX_QTY, a.qty) } : l))
          .filter((l) => l.qty > 0),
      };
    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.sku !== a.sku) };
    case "clear":
      return { ...state, lines: [] };
    case "open":
      return { ...state, open: true };
    case "close":
      return { ...state, open: false };
  }
}

type CartApi = State & {
  count: number;
  subtotalPoisha: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  openBag: () => void;
  closeBag: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

/**
 * The bag lives on this device (localStorage). Prices are re-validated by /api/checkout.
 * `catalogue` (sku → current price) lets the bag drop sizes that are no longer sold and pick up
 * price changes. The saved bag is read once; a new catalogue (the layout re-rendered) reprices the
 * bag in memory, so it can never put back an older bag over something just added.
 */
export function CartProvider({
  children,
  catalogue,
}: {
  children: ReactNode;
  catalogue?: Record<string, number>;
}) {
  const [state, dispatch] = useReducer(cartReducer, { lines: [], open: false, hydrated: false });

  useEffect(() => {
    let lines: CartLine[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) lines = JSON.parse(raw) as CartLine[];
    } catch {
      /* storage blocked or corrupt: start empty */
    }
    if (!Array.isArray(lines)) lines = [];
    dispatch({ type: "hydrate", lines });
  }, []);

  // Runs after the hydrate above on mount, and again whenever the catalogue changes
  useEffect(() => {
    if (catalogue) dispatch({ type: "reprice", catalogue });
  }, [catalogue]);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state.lines));
    } catch {
      /* ignore */
    }
  }, [state.lines, state.hydrated]);

  const add = useCallback(
    (line: Omit<CartLine, "qty">, qty = 1) => dispatch({ type: "add", line, qty }),
    [],
  );
  const setQty = useCallback(
    (sku: string, qty: number) => dispatch({ type: "setQty", sku, qty }),
    [],
  );
  const remove = useCallback((sku: string) => dispatch({ type: "remove", sku }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  const openBag = useCallback(() => dispatch({ type: "open" }), []);
  const closeBag = useCallback(() => dispatch({ type: "close" }), []);

  const api = useMemo<CartApi>(
    () => ({
      ...state,
      count: state.lines.reduce((n, l) => n + l.qty, 0),
      subtotalPoisha: state.lines.reduce((n, l) => n + l.qty * l.pricePoisha, 0),
      add,
      setQty,
      remove,
      clear,
      openBag,
      closeBag,
    }),
    [state, add, setQty, remove, clear, openBag, closeBag],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}
