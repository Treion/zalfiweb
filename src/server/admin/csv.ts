import { audit, type Actor } from "@/server/audit";
import { poolDb } from "@/server/db/pool";

/** One CSV cell: quoted when needed, and never starting a formula (Excel/Sheets injection) */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s =
    v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** A CSV download response. Every export is audit-logged (it can contain customer data). */
export async function csvResponse(
  name: string,
  header: string[],
  rows: unknown[][],
  actor: Actor,
  details: Record<string, unknown> = {},
) {
  await audit(poolDb(), actor, `export.${name}`, {
    entity: "export",
    entityId: name,
    after: { rows: rows.length, ...details },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens UTF-8 (৳, names in Bangla) correctly
  return new Response("﻿" + toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zalfi-${name}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
