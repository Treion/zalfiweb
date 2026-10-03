import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ContactIcons } from "@/components/ui/ContactIcons";
import { InfoBlocks } from "@/components/info/InfoBlocks";
import { INFO_PAGES, infoPage } from "@/content/pages";
import { CONTACT, MAPS_URL } from "@/lib/contact";

// Only the pages listed in content/pages.ts exist; anything else is a 404
export const dynamicParams = false;

export function generateStaticParams() {
  return INFO_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const page = infoPage((await params).slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
  };
}

const enter = (order: number) => ({
  "data-enter": "",
  style: { "--enter": order } as CSSProperties,
});

/** The house's information pages: About, FAQ, Contact, policies and terms. Readable, and a little interactive. */
export default async function InfoPageView({ params }: PageProps<"/[slug]">) {
  const page = infoPage((await params).slug);
  if (!page) notFound();
  const contact = page.slug === "contact";

  return (
    <main id="main" className="bg-noir text-bone px-gutter min-h-svh pt-36 pb-28 md:pt-44">
      <div className="grid grid-cols-12 gap-x-4 gap-y-14">
        <nav
          aria-label="Information"
          className="col-span-12 md:col-span-3 md:row-span-2"
          {...enter(0)}
        >
          <ul className="flex flex-wrap gap-x-5 gap-y-3 md:flex-col">
            {INFO_PAGES.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/${p.slug}`}
                  aria-current={p.slug === page.slug ? "page" : undefined}
                  className={clsx(
                    "eyebrow transition-colors duration-500",
                    p.slug === page.slug
                      ? "border-b border-current pb-1"
                      : "text-bone-dim hover:text-bone",
                  )}
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-span-12 md:col-span-7 md:col-start-5">
          <h1 className="font-display text-display" {...enter(1)}>
            {page.title}
          </h1>

          {contact ? (
            <ContactDetails />
          ) : page.blocks.length ? (
            <InfoBlocks blocks={page.blocks} />
          ) : (
            <div className="mt-14 max-w-[36rem]" {...enter(2)}>
              <p className="display-italic text-2xl leading-snug">This page is being written.</p>
              <p className="text-bone-dim mt-5 leading-relaxed">
                In the meantime, write to us at{" "}
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="text-bone border-b border-current/40"
                >
                  {CONTACT.email}
                </a>{" "}
                or call{" "}
                <a href={`tel:${CONTACT.phone}`} className="text-bone border-b border-current/40">
                  {CONTACT.phoneDisplay}
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ContactDetails() {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Phone",
      value: <a href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>,
    },
    {
      label: "Email",
      value: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>,
    },
    {
      label: "Visit",
      value: (
        <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
          {CONTACT.address.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </a>
      ),
    },
    {
      label: "Follow",
      value: (
        <span className="flex flex-col">
          <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer">
            Facebook
          </a>
        </span>
      ),
    },
  ];
  return (
    <div className="mt-14 max-w-[40rem]" {...enter(2)}>
      <dl className="divide-bone/15 border-bone/15 divide-y border-y">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[5rem_1fr] gap-4 py-6 sm:grid-cols-[7rem_1fr]"
          >
            <dt className="eyebrow text-bone-dim pt-1.5">{r.label}</dt>
            <dd className="font-display min-w-0 text-xl leading-snug break-words sm:text-2xl [&_a]:transition-opacity [&_a:hover]:opacity-70">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <ContactIcons className="mt-10 flex items-center gap-3" />
    </div>
  );
}
