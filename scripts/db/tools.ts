/**
 * Starting the project's own tools (node_modules/.bin) from a script, on every system, and the
 * hints the database scripts give when PostgreSQL isn't ready.
 */
import { spawn, type SpawnOptions } from "node:child_process";
import path from "node:path";

const win = process.platform === "win32";

/** A tool's path in node_modules/.bin (Windows runs its .cmd launcher) */
export const bin = (name: string) =>
  path.join(process.cwd(), "node_modules", ".bin", win ? `${name}.cmd` : name);

/** Quotes one word for cmd.exe when it needs it (spaces, quotes or shell characters) */
export const winQuote = (s: string) =>
  /^[\w./:=@\\+,-]+$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`;

/**
 * The command line Windows runs for a tool: its .cmd launcher goes through cmd.exe, so the path
 * (C:\Users\Jane Doe\… has a space) and each argument are quoted into one line.
 */
export const windowsCommandLine = (toolPath: string, args: string[]) =>
  [`"${toolPath}"`, ...args.map(winQuote)].join(" ");

/** Starts a tool from node_modules/.bin with these arguments */
export function startTool(name: string, args: string[], options: SpawnOptions) {
  return win
    ? spawn(windowsCommandLine(bin(name), args), { ...options, shell: true })
    : spawn(bin(name), args, options);
}

/** How to start PostgreSQL on this computer */
export const startPostgresHint = () =>
  win
    ? "Start it: press the Windows key, type Services, open it, find postgresql-x64-16 (or your version) and press Start"
    : process.platform === "darwin"
      ? "Start it: brew services start postgresql@16"
      : "Start it (for example: sudo systemctl start postgresql)";

/** How to create the database named in DATABASE_URL, then what to run: the command on its own line */
export const createDatabaseHint = (name: string, then: string) =>
  win
    ? `Create it: open SQL Shell (psql) from the Start menu, press Enter four times, type your PostgreSQL password, then type:\n    CREATE DATABASE ${name};\n  Then run ${then}.`
    : `Create it:\n    createdb ${name}\n  Then run ${then}.`;
