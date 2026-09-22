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
  priceCents: number;
  currency: string;
  bottleImage: string;
  qty: number;
};

type State = { lines: CartLine[]; open: boolean; hydrated: boolean };

type Action =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "add"; line: Omit<CartLine, "qty">; qty: number }
  | { type: "setQty"; sku: string; qty: number }
  | { type: "remove"; sku: string }
  | { type: "clear" }
  | { type: "open" }
  | { type: "close" };

const MAX_QTY = 10;
const KEY = "zalfi.bag.v1";

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return { ...state, lines: a.lines, hydrated: true };
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
  subtotalCents: number;
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

/** The bag lives on this device (localStorage). Prices are re-validated by /api/checkout. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [], open: false, hydrated: false });

  useEffect(() => {
    let lines: CartLine[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) lines = JSON.parse(raw) as CartLine[];
    } catch {
      /* storage blocked or corrupt: start empty */
    }
    dispatch({ type: "hydrate", lines: Array.isArray(lines) ? lines : [] });
  }, []);

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
      subtotalCents: state.lines.reduce((n, l) => n + l.qty * l.priceCents, 0),
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
