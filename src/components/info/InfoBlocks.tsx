import type { CSSProperties } from "react";
import type { InfoBlock } from "@/content/pages";
import { Accordion } from "./Accordion";
import { Chooser } from "./Chooser";
import { FaqList } from "./FaqList";
import { Pillars } from "./Pillars";
import { Rich } from "./rich";

const enter = (order: number) => ({
  "data-enter": "",
  style: { "--enter": order } as CSSProperties,
});

/**
 * A house page's blocks, in the house style: a large opening line, "in short" facts, then
 * sections that open, a case chooser, a timeline or a split. The interactive pieces are small
 * client components; everything else renders on the server.
 */
export function InfoBlocks({ blocks }: { blocks: InfoBlock[] }) {
  return (
    <div className="mt-12 max-w-[46rem]">
      {blocks.map((b, i) => (
        <Block key={i} block={b} order={Math.min(i + 2, 5)} first={i === 0} />
      ))}
    </div>
  );
}

function Block({ block: b, order, first }: { block: InfoBlock; order: number; first: boolean }) {
  switch (b.kind) {
    case "lead":
      return (
        <p
          className="display-italic text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.15]"
          {...enter(order)}
        >
          {b.text}
        </p>
      );

    case "points":
      return (
        <section aria-label="In short" className="mt-14" {...enter(order)}>
          <p className="eyebrow text-bone-dim">In short</p>
          <dl className="border-bone/15 mt-4 grid border-y sm:grid-cols-3">
            {b.items.map((it, j) => (
              <div
                key={it.title}
                className={`border-bone/15 py-6 sm:px-6 ${j ? "border-t sm:border-t-0 sm:border-l" : "sm:pl-0"}`}
              >
                <dt className="font-display text-3xl leading-tight">{it.title}</dt>
                <dd className="text-bone-dim mt-3 text-sm leading-relaxed">{it.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      );

    case "text":
      return (
        <section className={first ? "" : "mt-14"} {...(first ? enter(order) : {})}>
          {b.heading && <h2 className="display-italic mb-5 text-3xl leading-snug">{b.heading}</h2>}
          <div className="text-bone-dim space-y-4 text-lg leading-relaxed">
            {b.paragraphs.map((p, j) => (
              <p key={j}>
                <Rich text={p} />
              </p>
            ))}
          </div>
        </section>
      );

    case "list":
      return (
        <section className="mt-14">
          {b.heading && <h2 className="display-italic mb-5 text-3xl">{b.heading}</h2>}
          {b.intro && <p className="text-bone-dim mb-4">{b.intro}</p>}
          <ul className="border-bone/15 divide-bone/15 divide-y border-y">
            {b.items.map((it) => (
              <li key={it} className="py-3">
                {it}
              </li>
            ))}
          </ul>
        </section>
      );

    case "faq":
      return <FaqList items={b.items} />;

    case "accordion":
      return <Accordion heading={b.heading} items={b.items} />;

    case "chooser":
      return <Chooser heading={b.heading} intro={b.intro} options={b.options} />;

    case "pillars":
      return <Pillars heading={b.heading} intro={b.intro} items={b.items} />;

    case "timeline":
      return (
        <section className="mt-14">
          {b.heading && <h2 className="display-italic mb-5 text-3xl">{b.heading}</h2>}
          <ol className="border-bone/15 grid border-y sm:grid-cols-3">
            {b.items.map((it, j) => (
              <li
                key={it.mark}
                className={`border-bone/15 py-7 sm:px-6 ${j ? "border-t sm:border-t-0 sm:border-l" : "sm:pl-0"}`}
              >
                <p className="font-display text-[clamp(2.25rem,3.4vw,3.25rem)] leading-none whitespace-nowrap">
                  {it.mark}
                </p>
                <p className="text-bone-dim mt-4 text-sm leading-relaxed">{it.text}</p>
              </li>
            ))}
          </ol>
        </section>
      );

    case "split":
      return (
        <section className="border-bone/15 mt-16 border-t pt-10">
          <h2 className="display-italic text-4xl">{b.heading}</h2>
          {b.intro && <p className="text-bone-dim mt-3 text-lg">{b.intro}</p>}
          <div className="mt-8 flex" aria-hidden>
            {b.parts.map((p, j) => (
              <div
                key={p.label}
                className={`border-bone/40 h-14 border ${j ? "bg-bone/[0.06] border-l-0" : "bg-bone/90"}`}
                style={{ width: `${p.share}%` }}
              />
            ))}
          </div>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            {b.parts.map((p) => (
              <div key={p.label}>
                <dt className="flex items-baseline gap-3">
                  <span className="font-display text-headline leading-none">{`${p.share}%`}</span>
                  <span className="eyebrow">{p.label}</span>
                </dt>
                <dd className="text-bone-dim mt-3 leading-relaxed">{p.text}</dd>
              </div>
            ))}
          </dl>
          {b.after && <p className="text-bone-dim mt-8 leading-relaxed">{b.after}</p>}
        </section>
      );

    case "methods":
      return (
        <section className="mt-14" {...enter(order)}>
          {b.heading && <p className="eyebrow text-bone-dim">{b.heading}</p>}
          <ul className="border-bone/15 mt-4 grid border-t sm:grid-cols-2">
            {b.items.map((m, j) => (
              <li
                key={m.name}
                className={`border-bone/15 border-b py-6 ${j % 2 ? "sm:border-l sm:pl-6" : "sm:pr-6"}`}
              >
                <p className="font-display text-3xl">{m.name}</p>
                <p className="text-bone-dim mt-3 text-sm leading-relaxed">{m.text}</p>
              </li>
            ))}
          </ul>
          {b.notes && (
            <ul className="text-bone-dim mt-5 space-y-2 text-sm">
              {b.notes.map((n) => (
                <li key={n} className="flex gap-3">
                  <span aria-hidden>—</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      );

    case "ledger":
      return (
        <section className="mt-16">
          <h2 className="display-italic text-3xl">{b.heading}</h2>
          <table className="mt-6 w-full border-collapse text-left">
            <thead>
              <tr className="border-bone/15 border-b">
                <th scope="col" className="eyebrow text-bone-dim w-1/2 pb-3 font-normal">
                  What
                </th>
                <th scope="col" className="eyebrow text-bone-dim pb-3 font-normal">
                  Why
                </th>
              </tr>
            </thead>
            <tbody className="divide-bone/15 divide-y">
              {b.rows.map((r) => (
                <tr key={r.what}>
                  <td className="py-5 pr-6 align-top">{r.what}</td>
                  <td className="text-bone-dim py-5 align-top">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );

    case "quote":
      return (
        <p className="font-display text-display border-bone/15 mt-20 border-t pt-12 leading-[0.95]">
          <span className="display-italic">{b.text}</span>
        </p>
      );
  }
}
