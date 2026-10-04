"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/components/admin/lib/utils";
import type { SearchGroup } from "@/server/search";

/**
 * The top bar's search: suggestions as you type (orders, customers, fragrances), arrow keys to
 * move, Enter to open, Escape to close. Enter with nothing chosen opens the full results page.
 * "/" or Ctrl/⌘ K jumps here from anywhere in the admin.
 */
export function SearchBox() {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // The query the suggestions on screen are for (they lag the typing by a moment)
  const [answered, setAnswered] = useState("");

  // Suggestions, a moment after typing stops; a newer query cancels the older one
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { groups: [] }))
        .then((d: { groups: SearchGroup[] }) => {
          setGroups(d.groups);
          setAnswered(term);
          setActive(-1);
        })
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim();
  const shown = term.length >= 2 ? groups : [];
  const options = [
    ...shown.flatMap((g) => g.hits.map((h) => ({ ...h, group: g.kind }))),
    ...(term.length >= 2
      ? [
          {
            title: `See all results for “${term}”`,
            detail: "",
            href: `/admin/search?q=${encodeURIComponent(term)}`,
            group: "all",
          },
        ]
      : []),
  ];
  const expanded = open && term.length >= 2;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  let index = -1;
  return (
    <form
      role="search"
      action="/admin/search"
      className="relative max-w-md flex-1"
      onSubmit={(e) => {
        if (active >= 0 && options[active]) {
          e.preventDefault();
          go(options[active].href);
        } else setOpen(false);
      }}
    >
      <SearchIcon
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        ref={input}
        name="q"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Escape") {
            if (expanded) e.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
        placeholder="Search orders, phones, products"
        aria-label="Search orders, customers and fragrances"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        className="bg-muted/60 placeholder:text-muted-foreground focus-visible:ring-ring/50 h-9 w-full rounded-md border border-transparent pr-12 pl-9 text-sm outline-none focus-visible:ring-[3px]"
      />
      <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 text-[0.65rem] sm:block">
        /
      </kbd>
      <div
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!expanded}
        aria-busy={answered !== term}
        className={cn(
          "bg-popover text-popover-foreground absolute top-11 right-0 left-0 z-50 max-h-[70vh] overflow-y-auto rounded-lg border p-1 shadow-md",
          // Older suggestions stay while newer ones load, dimmed
          answered !== term && shown.length > 0 && "[&_[role=group]]:opacity-50",
        )}
      >
        {shown.length === 0 && (
          <p className="text-muted-foreground px-3 py-2 text-sm">
            {answered === term
              ? "No quick matches. Press Enter to search everything."
              : "Searching…"}
          </p>
        )}
        {shown.map((g) => (
          <div key={g.kind} role="group" aria-label={g.label} className="py-1">
            <p className="text-muted-foreground px-3 pt-1 pb-1 text-xs font-medium">
              {g.label}
              {g.total > g.hits.length ? ` · ${g.total}` : ""}
            </p>
            {g.hits.map((h) => {
              index++;
              const i = index;
              return (
                <div
                  key={h.href}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h.href)}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm",
                    active === i && "bg-accent",
                  )}
                >
                  <span className="block font-medium">{h.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">{h.detail}</span>
                </div>
              );
            })}
          </div>
        ))}
        {term.length >= 2 &&
          (() => {
            const i = options.length - 1;
            return (
              <div
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(options[i]!.href)}
                className={cn(
                  "text-muted-foreground mt-1 cursor-pointer rounded-md border-t px-3 py-2 text-sm",
                  active === i && "bg-accent text-foreground",
                )}
              >
                {options[i]!.title}
              </div>
            );
          })()}
      </div>
    </form>
  );
}
