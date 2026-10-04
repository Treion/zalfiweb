"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useHomeJump, type HomeTarget } from "./home-jump";

/** A link into the home experience that jumps (behind a veil) when already on the home page */
export function HomeLink({
  to,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { to: HomeTarget }) {
  const jump = useHomeJump(to);
  return (
    <Link
      {...props}
      href={to === "top" ? "/" : "/#collection"}
      onClick={(e) => {
        onClick?.(e);
        jump(e);
      }}
    />
  );
}
