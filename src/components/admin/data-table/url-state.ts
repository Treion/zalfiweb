/**
 * List pages keep their state in the URL (search, filters, sort, page), so a filtered view can be
 * bookmarked, shared and reloaded, and the server renders exactly that page.
 */
export type ListParams = {
  q: string;
  page: number;
  pageSize: number;
  sort: string | null;
  dir: "asc" | "desc";
  filters: Record<string, string>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Reads list params from a page's searchParams. `filterKeys` are the filters this page supports. */
export function readListParams(
  sp: Record<string, string | string[] | undefined>,
  opts: {
    filterKeys?: string[];
    pageSize?: number;
    sortKeys?: string[];
    defaultSort?: string;
  } = {},
): ListParams {
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const sort = one(sp.sort);
  const filters: Record<string, string> = {};
  for (const k of opts.filterKeys ?? []) {
    const v = one(sp[k]).trim();
    if (v) filters[k] = v.slice(0, 100);
  }
  return {
    q: one(sp.q).trim().slice(0, 100),
    page,
    pageSize: opts.pageSize ?? 25,
    sort: sort && (opts.sortKeys ?? []).includes(sort) ? sort : (opts.defaultSort ?? null),
    dir: one(sp.dir) === "asc" ? "asc" : "desc",
    filters,
  };
}
