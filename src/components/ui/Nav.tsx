"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/brand/Logo";
import { useCart } from "@/components/cart/cart-store";
import { INFO_GROUP_LABELS, INFO_NAV, isInfoPath, type InfoGroup } from "@/content/info-nav";
import { whatsappUrl } from "@/lib/contact";
import { useHomeJump } from "@/components/sections/home-jump";
import { HomeLink } from "@/components/sections/HomeLink";
import type { SearchEntry } from "@/lib/shop-search";
import { useNavSection } from "./nav-section";

// The search panel loads the first time it's opened
const SearchPanel = dynamic(() => import("./SearchPanel").then((m) => m.SearchPanel), {
  ssr: false,
});

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Fixed editorial navigation. Uses mix-blend-difference so it stays legible over every
 * fragrance world; while a line-up hover fills the room with a world, it takes that world's ink
 * instead (html[data-room], see sections/room.ts). On the home page the wordmark waits while the
 * landing logo holds the screen, and the experience timeline fades it in (data-nav-logo).
 *
 * Where you are is a hairline box around the item: Shop on the shop and product pages, The worlds
 * while the line-up is open, Discovery on the discovery sets, Find yours on the finder, Info on the
 * house pages (or while its menu is open). It fades as you scroll or navigate away. Only opacity
 * changes.
 *
 * Below md there's no room for the shop links in the bar, so Info becomes Menu: the same panel,
 * with Shop, The worlds, Discovery sets, Find yours and Track your order on top of the house
 * pages. The worlds joins the bar from lg. Search is always there (press / anywhere).
 */
export function Nav({
  discovery = false,
  searchIndex = [],
}: {
  discovery?: boolean;
  /** What the header search finds (built on the server from the catalogue) */
  searchIndex?: SearchEntry[];
}) {
  const { count, openBag } = useCart();
  const pathname = usePathname();
  const home = pathname === "/";
  const section = useNavSection();
  const jumpTop = useHomeJump("top");
  const jumpCollection = useHomeJump("collection");
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The panel's code is fetched the first time search opens, then kept
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const menuId = useId();
  const infoButton = useRef<HTMLButtonElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const closeInfo = useCallback((refocus: boolean) => {
    setInfoOpen(false);
    if (refocus) infoButton.current?.focus();
  }, []);
  const openSearch = useCallback(() => {
    setInfoOpen(false);
    setSearchLoaded(true);
    setSearchOpen(true);
  }, []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // A navigation closes the menu and the search
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setInfoOpen(false);
    setSearchOpen(false);
  }

  // "/" opens search from anywhere, except while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"))
        return;
      e.preventDefault();
      openSearch();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

  return (
    <>
      <header
        data-nav
        className="room-ink pointer-events-none fixed inset-x-0 top-0 z-[70] text-white mix-blend-difference"
      >
        <nav
          aria-label="Primary"
          className="px-gutter flex items-center justify-between py-5 md:py-7"
        >
          <Link
            href="/"
            onClick={jumpTop}
            aria-label="ZALFI, home"
            data-nav-logo
            data-reveal={home ? "" : undefined}
            className="pointer-events-auto block"
          >
            <Logo variant="wordmark" title={null} className="h-4 w-auto md:h-5" />
          </Link>
          <ul className="pointer-events-auto flex items-center gap-6 md:gap-8 lg:gap-10">
            <li className="hidden md:block">
              <NavItem
                href="/fragrances"
                active={pathname.startsWith("/fragrances")}
                current="page"
                exact={pathname === "/fragrances"}
              >
                Shop
              </NavItem>
            </li>
            <li className="hidden lg:block">
              <NavItem
                href="/#collection"
                onClick={jumpCollection}
                active={home && section === "worlds"}
                current="location"
              >
                The worlds
              </NavItem>
            </li>
            {discovery && (
              <li className="hidden md:block">
                <NavItem
                  href="/discovery"
                  active={pathname.startsWith("/discovery")}
                  current="page"
                >
                  Discovery
                </NavItem>
              </li>
            )}
            <li className="hidden md:block">
              <NavItem href="/find" active={pathname.startsWith("/find")} current="page">
                Find yours
              </NavItem>
            </li>
            <li>
              <button
                ref={infoButton}
                type="button"
                aria-expanded={infoOpen}
                aria-controls={menuId}
                onClick={() => {
                  setSearchOpen(false);
                  setInfoOpen((o) => !o);
                }}
                className="eyebrow relative block"
              >
                <span className="md:hidden">Menu</span>
                <span className="hidden md:inline">Info</span>
                <Outline on={infoOpen || isInfoPath(pathname)} />
              </button>
            </li>
            <li>
              <button
                ref={searchButton}
                type="button"
                onClick={openSearch}
                aria-label="Search"
                aria-keyshortcuts="/"
                aria-expanded={searchOpen}
                className="-m-2 block p-2"
              >
                <SearchMark />
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={openBag}
                aria-label={`Bag, ${count} ${count === 1 ? "item" : "items"}`}
                className="-m-2 flex items-center gap-1.5 p-2"
              >
                <CartMark />
                {/* The count, beside the cart, rolls when it changes */}
                <span
                  aria-hidden
                  className="eyebrow relative inline-block min-w-3 overflow-hidden text-center tabular-nums"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={count}
                      className="inline-block"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "-100%" }}
                      transition={{ duration: 0.45, ease: EASE }}
                    >
                      {count}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </header>
      <InfoMenu
        id={menuId}
        discovery={discovery}
        open={infoOpen}
        pathname={pathname}
        onClose={closeInfo}
        anchor={infoButton}
      />
      {searchLoaded && (
        <SearchPanel
          open={searchOpen}
          index={searchIndex}
          onClose={closeSearch}
          restoreFocus={searchButton}
        />
      )}
    </>
  );
}

/** A magnifier in the site's own hairline (no icon set), beside the bag */
function SearchMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-5 md:size-[1.35rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
    >
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </svg>
  );
}

/** A cart in the site's own hairline (no icon set), the nav's way into the bag */
function CartMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-5 md:size-[1.35rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4h2.6l2.3 10.6a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.8L20.5 7.5H6" />
      <circle cx="9.5" cy="19" r="1.25" />
      <circle cx="17" cy="19" r="1.25" />
    </svg>
  );
}

/** The hairline box that marks where you are. Fades in and out; nothing moves. */
function Outline({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-x-3 -inset-y-2 border border-current transition-opacity duration-500 ease-out"
      style={{ opacity: on ? 1 : 0 }}
    />
  );
}

function NavItem({
  href,
  onClick,
  active,
  current,
  exact = true,
  children,
}: {
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Outlined: this part of the site */
  active: boolean;
  current: "page" | "location";
  /** aria-current only on the page itself (Shop is outlined on product pages too) */
  exact?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active && exact ? current : undefined}
      className="eyebrow relative block"
    >
      {children}
      <Outline on={active} />
    </Link>
  );
}

const GROUPS: InfoGroup[] = ["house", "help", "legal"];

/** The shop's way in, shown in the menu below md only (the bar has them on larger screens) */
const shopLinks = (discovery: boolean) => [
  { href: "/fragrances", title: "Shop" },
  { href: "/#collection", title: "The worlds" },
  ...(discovery ? [{ href: "/discovery", title: "Discovery sets" }] : []),
  { href: "/find", title: "Find yours" },
  { href: "/track", title: "Track your order" },
];

/**
 * The house pages, in a small panel under the nav. It sits outside the nav's blend layer so it
 * reads as a plain dark sheet. Esc, a click outside, or choosing a page closes it.
 */
function InfoMenu({
  id,
  discovery,
  open,
  pathname,
  onClose,
  anchor,
}: {
  id: string;
  discovery: boolean;
  open: boolean;
  pathname: string;
  onClose: (refocus: boolean) => void;
  anchor: React.RefObject<HTMLButtonElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // The first link that's showing (the shop links are hidden on larger screens)
    const t = setTimeout(
      () =>
        [...(panel.current?.querySelectorAll<HTMLElement>("a") ?? [])]
          .find((a) => a.offsetParent !== null)
          ?.focus(),
      30,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(true);
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) onClose(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose, anchor]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          id={id}
          role="region"
          aria-label="Menu"
          data-lenis-prevent
          className="bg-noir text-bone border-bone/15 px-gutter fixed inset-x-0 top-16 z-[71] max-h-[calc(100svh-4rem)] overflow-y-auto border-y py-8 sm:right-[var(--gutter)] sm:left-auto sm:w-[22rem] sm:border sm:px-8 md:top-20"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: EASE }}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const links = [...(panel.current?.querySelectorAll<HTMLElement>("a") ?? [])].filter(
              (a) => a.offsetParent !== null,
            );
            if (!links.length) return;
            const last = links[links.length - 1];
            if (!e.shiftKey && document.activeElement === last) onClose(true);
          }}
        >
          <div className="space-y-7">
            <div className="md:hidden">
              <p className="eyebrow text-bone-dim">Shop</p>
              <ul className="mt-3 space-y-1.5">
                {shopLinks(discovery).map((l) => (
                  <li key={l.href}>
                    {l.href === "/#collection" ? (
                      // On the home page this glides to the line-up instead of reloading
                      <HomeLink
                        to="collection"
                        onClick={() => onClose(false)}
                        className="font-display block text-3xl leading-snug transition-opacity hover:opacity-70"
                      >
                        {l.title}
                      </HomeLink>
                    ) : (
                      <Link
                        href={l.href}
                        aria-current={pathname === l.href ? "page" : undefined}
                        onClick={() => onClose(false)}
                        className="font-display block text-3xl leading-snug transition-opacity hover:opacity-70 aria-[current=page]:italic"
                      >
                        {l.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noreferrer"
                onClick={() => onClose(false)}
                className="eyebrow border-bone/40 mt-4 inline-block border-b pb-0.5"
              >
                WhatsApp us
              </a>
            </div>
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="eyebrow text-bone-dim">{INFO_GROUP_LABELS[g]}</p>
                <ul className="mt-3 space-y-1.5">
                  {INFO_NAV.filter((p) => p.group === g).map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/${p.slug}`}
                        aria-current={pathname === `/${p.slug}` ? "page" : undefined}
                        onClick={() => onClose(false)}
                        className="font-display block text-2xl leading-snug transition-opacity hover:opacity-70 aria-[current=page]:italic"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
