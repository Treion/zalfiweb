import { eq } from "drizzle-orm";
import { integrations } from "@/db/schema";
import { env } from "@/lib/env";
import { audit, type Actor } from "@/server/audit";
import { poolDb, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { testProvidersAllowed } from "@/server/test-mode";
import {
  CATALOG,
  INTEGRATIONS,
  type IntegrationDef,
  type IntegrationName,
  type Mode,
} from "./catalog";
import { mask, newToken, open, seal, VaultError } from "./vault";

export * from "./catalog";

/**
 * The providers' set-up, as the rest of the server reads it. Keys entered in the admin come first;
 * a provider never set up there falls back to its environment variables, so a site configured the
 * old way keeps working untouched.
 *
 * Two different questions, kept apart:
 *  - configured: every required value is present. Payments and parcels already under way keep
 *    settling and updating through it.
 *  - enabled: it also takes new payments, parcels or messages. The owner's switch.
 */
export type LastCheck = { ok: boolean; at: string; message: string; source: "test" | "live" };

export type Resolved = {
  name: IntegrationName;
  def: IntegrationDef;
  configured: boolean;
  enabled: boolean;
  mode: Mode;
  values: Record<string, string>;
  webhookToken: string | null;
  /** Where the values come from: saved in the admin, the environment, or nowhere yet */
  source: "admin" | "env" | null;
  lastCheck: LastCheck | null;
  /** Keys were saved but can't be read any more (the server's secret changed) */
  unreadable: boolean;
};

type Row = typeof integrations.$inferSelect;

const envValues = (def: IntegrationDef) =>
  Object.fromEntries(def.fields.flatMap((f) => (env(f.env) ? [[f.key, env(f.env)!]] : [])));

function savedValues(row: Row | undefined): {
  values: Record<string, string>;
  unreadable: boolean;
} {
  if (!row) return { values: {}, unreadable: false };
  let secrets: Record<string, string> = {};
  let unreadable = false;
  if (row.secrets)
    try {
      secrets = open<Record<string, string>>(row.secrets);
    } catch (e) {
      if (!(e instanceof VaultError)) throw e;
      unreadable = true;
    }
  const values = Object.fromEntries(
    Object.entries({ ...row.config, ...secrets }).filter(([, v]) => typeof v === "string" && v),
  );
  return { values, unreadable };
}

function openToken(row: Row | undefined): string | null {
  if (!row?.webhookToken) return null;
  try {
    return open<string>(row.webhookToken);
  } catch {
    return null;
  }
}

export function resolve(def: IntegrationDef, row: Row | undefined): Resolved {
  const saved = savedValues(row);
  const fromEnv = envValues(def);
  const admin = Object.keys(saved.values).length > 0 || saved.unreadable;
  const values = admin ? saved.values : fromEnv;
  const source = admin ? "admin" : Object.keys(fromEnv).length ? "env" : null;
  const configured = def.testOnly
    ? testProvidersAllowed()
    : def.fields.every((f) => !f.required || !!values[f.key]);
  // Not chosen in the admin yet: on when the environment sets it up (or, for a test provider,
  // wherever test providers may run)
  const chosen = row?.enabled ?? (def.testOnly ? true : source === "env");
  const envMode: Mode = def.modeEnv && env(def.modeEnv) === "true" ? "live" : "sandbox";
  const mode: Mode =
    def.modes.length === 0
      ? "live"
      : ((row?.mode as Mode | null) ?? (source === "env" ? envMode : "sandbox"));
  return {
    name: def.name,
    def,
    configured,
    enabled: configured && chosen,
    mode,
    values,
    webhookToken:
      openToken(row) ?? (def.webhook?.tokenEnv ? (env(def.webhook.tokenEnv) ?? null) : null),
    source,
    lastCheck: row?.lastCheck ?? null,
    unreadable: saved.unreadable,
  };
}

/*
 * A short in-process cache, so a checkout or a burst of webhooks doesn't read the table on every
 * call. Saving clears it here at once; other server instances see a change within CACHE_MS.
 */
const CACHE_MS = 15_000;
const cache = new Map<IntegrationName, { at: number; value: Resolved }>();
const caching = () => !process.env.VITEST;

export function clearIntegrationCache() {
  cache.clear();
}

export async function getIntegration(
  name: IntegrationName,
  exec: Executor = poolDb(),
): Promise<Resolved> {
  const hit = cache.get(name);
  if (caching() && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const [row] = await exec
    .select()
    .from(integrations)
    .where(eq(integrations.provider, name))
    .limit(1);
  const value = resolve(CATALOG[name], row);
  if (caching()) cache.set(name, { at: Date.now(), value });
  return value;
}

export async function getIntegrations(exec: Executor = poolDb()): Promise<Resolved[]> {
  const rows = await exec.select().from(integrations);
  const byName = new Map(rows.map((r) => [r.provider, r]));
  return INTEGRATIONS.map((n) => resolve(CATALOG[n], byName.get(n)));
}

/** What the admin may see of a provider's values: plain settings in full, secrets masked */
export function shownValues(r: Resolved) {
  return Object.fromEntries(
    r.def.fields.map((f) => {
      const v = r.values[f.key];
      return [f.key, { set: !!v, display: v ? (f.secret ? mask(v) : v) : null }];
    }),
  ) as Record<string, { set: boolean; display: string | null }>;
}

export type IntegrationChange = {
  /** A value sets the field, null clears it; a field left out (or blank) keeps what is saved */
  values?: Record<string, string | null>;
  mode?: Mode;
  enabled?: boolean;
};

/**
 * Saves a provider's set-up. The first save copies whatever the environment held into the admin,
 * so keys entered one at a time never leave a provider half set up. Secrets are sealed; the audit
 * log records which fields changed, never their values.
 */
export async function saveIntegration(
  name: IntegrationName,
  change: IntegrationChange,
  actor: Actor,
  exec: Executor = poolDb(),
): Promise<Resolved> {
  const def = CATALOG[name];
  const [row] = await exec
    .select()
    .from(integrations)
    .where(eq(integrations.provider, name))
    .limit(1);
  const current = resolve(def, row);
  const base = current.source === "admin" ? { ...current.values } : envValues(def);
  const changed: string[] = [];
  for (const [key, v] of Object.entries(change.values ?? {})) {
    const field = def.fields.find((f) => f.key === key);
    if (!field) throw new UserFacingError(`${def.label} has no field "${key}".`);
    if (v === null) {
      if (base[key]) changed.push(key);
      delete base[key];
    } else if (v.trim()) {
      const next = v.trim();
      if (next.length > 2000) throw new UserFacingError(`${field.label} is too long.`);
      if (base[key] !== next) changed.push(key);
      base[key] = next;
    }
  }
  if (change.mode && !def.modes.includes(change.mode))
    throw new UserFacingError(`${def.label} has no ${change.mode} mode.`);

  const secrets: Record<string, string> = {};
  const config: Record<string, string> = {};
  for (const f of def.fields) {
    const v = base[f.key];
    if (v) (f.secret ? secrets : config)[f.key] = v;
  }
  const mode = change.mode ?? (def.modes.length ? current.mode : null);
  const fresh = changed.length > 0 || (!!change.mode && change.mode !== current.mode);
  const set = {
    enabled: change.enabled ?? row?.enabled ?? (current.source === "env" ? current.enabled : null),
    mode,
    secrets: Object.keys(secrets).length ? seal(secrets) : null,
    config,
    // A new key deserves a new test: the old result no longer says anything
    lastCheck: fresh ? null : (row?.lastCheck ?? null),
    updatedBy: actor.id,
    updatedAt: new Date(),
  };
  const next = resolve(def, { provider: name, webhookToken: row?.webhookToken ?? null, ...set });
  if (change.enabled && !next.configured) {
    const missing = def.fields.filter((f) => f.required && !base[f.key]).map((f) => f.label);
    throw new UserFacingError(
      def.testOnly
        ? `${def.label} can't run on the live site.`
        : `Fill in ${missing.join(", ")} first.`,
    );
  }

  await exec
    .insert(integrations)
    .values({ provider: name, ...set })
    .onConflictDoUpdate({ target: integrations.provider, set });
  await audit(exec, actor, `integration.${name}.update`, {
    entity: "integration",
    entityId: name,
    before: { enabled: current.enabled, mode: current.mode, source: current.source },
    after: { enabled: next.enabled, mode: next.mode, fieldsChanged: changed },
  });
  clearIntegrationCache();
  return getIntegration(name, exec);
}

/** A provider's webhook token: kept if there is one, made (and saved) if not, or replaced */
export async function webhookToken(
  name: IntegrationName,
  actor: Actor,
  opts: { rotate?: boolean } = {},
  exec: Executor = poolDb(),
): Promise<string | null> {
  const def = CATALOG[name];
  if (!def.webhook?.tokenEnv) return null;
  const current = await getIntegration(name, exec);
  if (current.webhookToken && !opts.rotate) return current.webhookToken;
  const token = newToken();
  await exec
    .insert(integrations)
    .values({ provider: name, webhookToken: seal(token), updatedBy: actor.id })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: { webhookToken: seal(token), updatedBy: actor.id, updatedAt: new Date() },
    });
  await audit(exec, actor, `integration.${name}.webhook-${opts.rotate ? "rotate" : "create"}`, {
    entity: "integration",
    entityId: name,
  });
  clearIntegrationCache();
  return token;
}

/**
 * Records how a provider answered: a Test connection from the admin, or a real call that was
 * refused (keys changed in the provider's panel). A real call that succeeds clears a refusal.
 */
export async function recordCheck(
  name: IntegrationName,
  check: Omit<LastCheck, "at">,
  exec: Executor = poolDb(),
) {
  const lastCheck: LastCheck = {
    ...check,
    message: check.message.slice(0, 300),
    at: new Date().toISOString(),
  };
  await exec
    .insert(integrations)
    .values({ provider: name, lastCheck })
    .onConflictDoUpdate({ target: integrations.provider, set: { lastCheck } });
  clearIntegrationCache();
}

/** A real call failed (keys refused, provider down): flag it for the owner (Overview → Needs attention) */
export async function noteFailure(name: IntegrationName, message: string) {
  await recordCheck(name, { ok: false, message, source: "live" }).catch((e) =>
    console.error(`[integrations] couldn't record ${name}'s failure`, e),
  );
}

/** A real call went through: clear an earlier refusal, if one is showing */
export async function noteWorking(r: Resolved) {
  if (r.lastCheck && !r.lastCheck.ok)
    await recordCheck(r.name, { ok: true, message: "Working again.", source: "live" }).catch(
      () => {},
    );
}
