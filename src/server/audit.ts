import { auditLog } from "@/db/schema";
import type { Executor } from "@/server/db/pool";

/** Who is acting: an admin user (with the request's IP), or the system itself */
export type Actor = { id: string; email: string; ip?: string | null };

/**
 * Writes one audit-log row. Call it inside the same transaction as the change it records, so the
 * log can never claim something that didn't happen (or miss something that did).
 */
export async function audit(
  exec: Executor,
  actor: Actor | null,
  action: string,
  opts: { entity?: string; entityId?: string | number; before?: unknown; after?: unknown } = {},
) {
  await exec.insert(auditLog).values({
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? "system",
    action,
    entity: opts.entity ?? null,
    entityId: opts.entityId === undefined ? null : String(opts.entityId),
    before: opts.before ?? null,
    after: opts.after ?? null,
    ip: actor?.ip ?? null,
  });
}
