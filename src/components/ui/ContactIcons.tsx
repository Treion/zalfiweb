import type { ReactNode } from "react";
import { CONTACT, MAPS_URL } from "@/lib/contact";

/**
 * Facebook, Instagram, phone, email and address as a row of hairline marks, drawn here in the
 * site's own thin line (no icon set). Each is a real link with an accessible name.
 */
export function ContactIcons({ className }: { className?: string }) {
  return (
    <ul className={className ?? "flex items-center gap-3"}>
      <Item href={CONTACT.facebook} label="ZALFI on Facebook" external>
        <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21" />
      </Item>
      <Item href={CONTACT.instagram} label="ZALFI on Instagram" external>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
      </Item>
      <Item href={`tel:${CONTACT.phone}`} label={`Call ZALFI: ${CONTACT.phoneDisplay}`}>
        <path d="M6.6 3.5h2.6l1.4 4.3-2 1.4a12 12 0 0 0 6.2 6.2l1.4-2 4.3 1.4v2.6c0 1-.8 1.8-1.8 1.8C10.5 19.2 4.8 13.5 4.8 5.3c0-1 .8-1.8 1.8-1.8Z" />
      </Item>
      <Item href={`mailto:${CONTACT.email}`} label={`Email ZALFI: ${CONTACT.email}`}>
        <rect x="3" y="5.5" width="18" height="13" />
        <path d="m3.5 6.5 8.5 7 8.5-7" />
      </Item>
      <Item href={MAPS_URL} label="Find ZALFI on the map" external>
        <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
        <circle cx="12" cy="10" r="2.3" />
      </Item>
    </ul>
  );
}

function Item({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        aria-label={label}
        title={label}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="grid size-11 place-items-center border border-current/20 transition-colors duration-500 hover:border-current"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden
          className="size-[1.15rem]"
        >
          {children}
        </svg>
      </a>
    </li>
  );
}
