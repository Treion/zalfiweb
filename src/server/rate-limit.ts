import { sql } from "drizzle-orm";
import { poolDb, type Executor } from "@/server/db/pool";

export type RateResult = { ok: boolean; count: number; retryAfter: number };

/**
 * A fixed-window rate limiter in Postgres (no extra paid service): `limit` hits per `windowSeconds`
 * per key. One atomic statement, so concurrent requests can't slip past it.
 *
 *   const r = await hit(`otp-send:ip:${ip}`, 10, 3600);
 *   if (!r.ok) return tooMany(r.retryAfter);
 */
export async function hit(
  key: string,
  limit: number,
  windowSeconds: number,
  exec: Executor = poolDb(),
): Promise<RateResult> {
  const res = await exec.execute<{ count: number; retry: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
                   then now() else rate_limits.window_start end
    returning count,
      greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => ${windowSeconds}) - now()))))::int as retry`);
  const row = res.rows[0];
  const count = Number(row?.count ?? 1);
  return { ok: count <= limit, count, retryAfter: Number(row?.retry ?? windowSeconds) };
}

/** Clears a key (for example after a successful login) */
export async function resetLimit(key: string, exec: Executor = poolDb()) {
  await exec.execute(sql`delete from rate_limits where key = ${key}`);
}
