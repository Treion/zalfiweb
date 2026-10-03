/**
 * Runs a command with the local database ready: `tsx scripts/with-db.ts <command> [args…]`.
 *  - checks PostgreSQL is reachable and says plainly if it isn't
 *  - starts the local Neon stand-in (scripts/neon-local-proxy.ts) when the database is local and it
 *    isn't already running
 *  - runs the command (`npm run dev` is `next dev` through this; extra arguments pass on, e.g.
 *    `npm run dev -- -p 3001`)
 * When the command ends (or Ctrl+C), the stand-in it started stops too.
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import pg from "pg";

const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bin = (name: string) =>
  path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${name}.cmd` : name,
  );

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
    await client.query("select 1 from admin_users limit 1").catch(() => {
      console.log(yellow("! The database has no admin tables yet. Run: npm run db:migrate"));
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { errors?: NodeJS.ErrnoException[] };
    const code = err.code ?? err.errors?.[0]?.code;
    console.log(
      yellow(
        code === "ECONNREFUSED"
          ? "! PostgreSQL isn't running, so the admin can't sign in. Start it (for example: sudo systemctl start postgresql) and run npm run dev again."
          : `! Can't connect to the database: ${err.message}`,
      ),
    );
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  await checkDatabase();
  const children: ChildProcess[] = [];
  if (isLocal && !(await portInUse(proxyPort))) {
    console.log(dim(`Starting the local database bridge on :${proxyPort}`));
    children.push(
      spawn(bin("tsx"), ["scripts/neon-local-proxy.ts"], {
        stdio: "inherit",
        shell: process.platform === "win32",
      }),
    );
    // Give the stand-in a moment to listen before the command connects
    await new Promise((r) => setTimeout(r, 800));
  }
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) throw new Error("Usage: tsx scripts/with-db.ts <command> [args…]");
  const next = spawn(bin(cmd), args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.push(next);

  const stop = () => children.forEach((c) => c.kill("SIGTERM"));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", (code) => {
    stop();
    process.exit(code ?? 0);
  });
}

void main();
