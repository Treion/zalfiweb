"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Set once the first (server-rendered) page has hydrated: later mounts are client navigations */
let hydrated = false;

/**
 * Unlike the layout, a template mounts afresh on every navigation. A page reached by a client
 * navigation fades in and its text blocks ([data-enter]) rise into place, while the stage carries
 * the bottle across from the page before. The first page never animates, so hydration matches.
 */
export default function Template({ children }: { children: ReactNode }) {
  const [enter] = useState(() => hydrated);
  useEffect(() => {
    hydrated = true;
  }, []);
  return <div data-page-enter={enter ? "" : undefined}>{children}</div>;
}
