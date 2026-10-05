/**
 * Runs a command with the local database ready: `tsx scripts/db/with-db.ts <command> [args…]`.
 *  - checks PostgreSQL is reachable and says plainly if it isn't
 *  - applies migrations the database hasn't had yet (a local database; a remote one gets a warning),
 *    so pulling an update that changes the schema never breaks the site
 *  - starts the local Neon stand-in (scripts/db/neon-local-proxy.ts) when the database is local and it
 *    isn't already running
 *  - runs the command (`npm run dev` is `next dev` through this; extra arguments pass on, e.g.
 *    `npm run dev -- -p 3001`)
 * When the command ends (or Ctrl+C), the stand-in it started stops too.
 */
import "dotenv/config";
import type { ChildProcess } from "node:child_process";
import net from "node:net";
import { readFileSync } from "node:fs";
import pg from "pg";
import { createDatabaseHint, startPostgresHint, startTool } from "./tools";

const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

const url = process.env.DATABASE_URL?.trim() ?? "";
const proxyPort = Number(process.env.NEON_LOCAL_PROXY_PORT || 4444);
const isLocal = (() => {
  try {
    return ["localhost", "127.0.0.1", "db.localtest.me"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
})();

function portInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
}

async function checkDatabase() {
  if (!url) {
    console.log(
      yellow(
        "! DATABASE_URL isn't set (.env): the shop uses its built-in catalogue and the admin can't sign in.",
      ),
    );
    return;
  }
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 4000 });
  try {
    await client.connect();
    await migrateIfBehind(client);
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { errors?: NodeJS.ErrnoException[] };
    const code = err.code ?? err.errors?.[0]?.code;
    const dbName = (() => {
      try {
        return new URL(url).pathname.slice(1) || "zalfi";
      } catch {
        return "zalfi";
      }
    })();
    console.log(
      yellow(
        code === "ECONNREFUSED"
          ? `! PostgreSQL isn't running, so the admin can't sign in. ${startPostgresHint()}, then run npm run dev again.`
          : code === "3D000"
            ? `! The database "${dbName}" doesn't exist yet. ${createDatabaseHint(dbName, "npm run db:migrate, npm run db:seed and npm run dev again")}`
            : code === "28P01"
              ? "! PostgreSQL refused the password in DATABASE_URL (.env)."
              : `! Can't connect to the database: ${err.message}`,
      ),
    );
  } finally {
    await client.end().catch(() => {});
  }
}

/** The migrations in drizzle/ that this database hasn't had: applied now if it's local */
async function migrateIfBehind(client: pg.Client) {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: unknown[];
  };
  const applied = await client
    .query<{ n: string }>("select count(*) as n from drizzle.__drizzle_migrations")
    .then((r) => Number(r.rows[0]?.n ?? 0))
    .catch(() => 0);
  const pending = journal.entries.length - applied;
  if (pending <= 0) return;
  const what = `${pending} new migration${pending === 1 ? "" : "s"}`;
  if (!isLocal) {
    console.log(yellow(`! The database is ${what} behind the code. Run: npm run db:migrate`));
    return;
  }
  console.log(dim(`Updating the database: ${what}…`));
  const code = await new Promise<number | null>((resolve) =>
    startTool("drizzle-kit", ["migrate"], { stdio: ["ignore", "ignore", "inherit"] })
      .on("exit", resolve)
      .on("error", () => resolve(null)),
  );
  console.log(
    code === 0
      ? `Database updated: ${what} applied.`
      : yellow("! The database couldn't be updated. Run npm run db:migrate to see why."),
  );
}

async function main() {
  await checkDatabase();
  const children: ChildProcess[] = [];
  if (isLocal && !(await portInUse(proxyPort))) {
    console.log(dim(`Starting the local database bridge on :${proxyPort}`));
    children.push(startTool("tsx", ["scripts/db/neon-local-proxy.ts"], { stdio: "inherit" }));
    // Give the stand-in a moment to listen before the command connects
    await new Promise((r) => setTimeout(r, 800));
  }
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) throw new Error("Usage: tsx scripts/db/with-db.ts <command> [args…]");
  const next = startTool(cmd, args, { stdio: "inherit" });
  children.push(next);

  const stop = () => children.forEach((c) => c.kill("SIGTERM"));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("error", (e) => {
    console.error(yellow(`! Couldn't start ${cmd}: ${e.message}`));
    stop();
    process.exit(1);
  });
  next.on("exit", (code) => {
    stop();
    process.exit(code ?? 0);
  });
}

void main();
