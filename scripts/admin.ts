/**
 * Admin accounts from the terminal. Just run:
 *
 *   npm run admin
 *
 * and answer the questions. It can create an admin (owner or manager), list them, reset a
 * password, or switch someone off/on. It talks to PostgreSQL directly, so only the database needs to
 * be running (not `npm run db:proxy` or the website).
 *
 * One-liners, for when you know what you want:
 *   npm run admin -- create you@example.com "Your Name"            owner, password generated
 *   npm run admin -- create rafi@example.com "Rafi" manager        a manager
 *   npm run admin -- list
 *   npm run admin -- reset-password you@example.com                 prints a new password
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { createDatabaseHint, startPostgresHint } from "./db/tools";

const MIN_PASSWORD = 10;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

class Stop extends Error {}

/* ---------------------------------------------------------------------------------------------- */
/* Terminal input                                                                                  */

const interactive = process.stdin.isTTY;
let rl: ReturnType<typeof createInterface> | null = null;
const lineReader = () => (rl ??= createInterface({ input: process.stdin, output: process.stdout }));

async function ask(question: string, fallback = ""): Promise<string> {
  const hint = fallback ? dim(` [${fallback}]`) : "";
  const answer = (await lineReader().question(`${question}${hint}: `)).trim();
  return answer || fallback;
}

/** Reads a password showing * for each character (plain line input when not a terminal) */
async function askSecret(question: string): Promise<string> {
  if (!interactive) return ask(question);
  rl?.close();
  rl = null;
  process.stdout.write(`${question}: `);
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = (fn: () => void) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      fn();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(() => resolve(value));
        if (ch === "\u0003") return done(() => reject(new Stop("Cancelled.")));
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          process.stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

/** A strong password that's easy to read out and type: four groups, no look-alike characters */
function generatePassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const s = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ---------------------------------------------------------------------------------------------- */
/* Database                                                                                        */

async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Stop("DATABASE_URL isn't set. Copy .env.example to .env first.");
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { errors?: NodeJS.ErrnoException[] };
    const code = err.code ?? err.errors?.[0]?.code;
    if (code === "ECONNREFUSED") throw new Stop(`Can't reach PostgreSQL. ${startPostgresHint()}.`);
    if (code === "3D000")
      throw new Stop(
        `The database doesn't exist yet. ${createDatabaseHint(new URL(url).pathname.slice(1) || "zalfi", "npm run db:migrate and npm run db:seed, then npm run admin again")}`,
      );
    if (code === "28P01") throw new Stop("PostgreSQL refused the password in DATABASE_URL (.env).");
    throw new Stop(`Can't connect to the database: ${err.message}`);
  }
  try {
    await client.query("select 1 from admin_users limit 1");
  } catch {
    await client.end();
    throw new Stop("The admin tables don't exist yet. Run: npm run db:migrate");
  }
  return client;
}

async function log(db: pg.Client, action: string, entityId: string, after: unknown) {
  await db.query(
    `insert into audit_log (actor_email, action, entity, entity_id, after) values ('terminal', $1, 'user', $2, $3)`,
    [action, entityId, JSON.stringify(after)],
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Commands                                                                                        */

async function create(db: pg.Client, preset: { email?: string; name?: string; role?: string }) {
  console.log(bold("\nCreate an admin\n"));
  let email = (preset.email ?? "").trim().toLowerCase();
  while (!validEmail(email)) {
    if (email) console.log(red("  That email doesn't look right."));
    email = (await ask("Email")).toLowerCase();
  }
  const exists = await db.query("select 1 from admin_users where email = $1", [email]);
  if (exists.rowCount)
    throw new Stop(`${email} already has an account. Use "Reset a password" instead.`);

  let name = (preset.name ?? "").trim();
  while (!name) name = await ask("Name", email.split("@")[0]);

  let role = (preset.role ?? "").trim().toLowerCase();
  if (!role) {
    const owners = await db.query("select 1 from admin_users where role = 'owner' and active");
    role = await ask("Role: owner or manager", owners.rowCount ? "manager" : "owner");
  }
  if (role !== "owner" && role !== "manager")
    throw new Stop('The role must be "owner" or "manager".');

  let password = "";
  let generated = false;
  if (interactive && !preset.email) {
    console.log(dim("  Press Enter to have a strong password made for you, or type your own."));
    password = await askSecret("Password");
    if (password) {
      if (password.length < MIN_PASSWORD)
        throw new Stop(`Passwords need at least ${MIN_PASSWORD} characters.`);
      if ((await askSecret("Type it again")) !== password)
        throw new Stop("The two passwords don't match.");
    }
  }
  if (!password) {
    password = generatePassword();
    generated = true;
  }

  const id = randomUUID();
  const hash = await hashPassword(password);
  await db.query("begin");
  try {
    await db.query(
      `insert into admin_users (id, name, email, email_verified, role, active) values ($1, $2, $3, true, $4, true)`,
      [id, name, email, role],
    );
    await db.query(
      `insert into admin_accounts (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), id, hash],
    );
    await log(db, "team.create", id, { email, role });
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }

  console.log(green(`\n✓ ${name} can now sign in as ${role}.`));
  console.log(`  Email:     ${bold(email)}`);
  if (generated)
    console.log(`  Password:  ${bold(password)}   ${dim("(write it down: it isn't shown again)")}`);
  console.log(`  Sign in:   ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin`);
  console.log(dim("  (start the site first with: npm run dev)\n"));
}

async function list(db: pg.Client) {
  const { rows } = await db.query<{
    name: string;
    email: string;
    role: string;
    active: boolean;
    last_login_at: Date | null;
  }>("select name, email, role, active, last_login_at from admin_users order by created_at");
  if (!rows.length)
    return console.log('\nNo admins yet. Run "npm run admin" and choose "Create an admin".\n');
  console.log(bold("\nAdmins\n"));
  for (const r of rows)
    console.log(
      `  ${r.active ? green("●") : red("○")} ${r.name.padEnd(22)} ${r.email.padEnd(32)} ${r.role.padEnd(8)} ${dim(
        r.last_login_at
          ? `last in ${r.last_login_at.toISOString().slice(0, 16).replace("T", " ")} UTC`
          : "never signed in",
      )}`,
    );
  console.log();
}

async function findUser(db: pg.Client, presetEmail?: string) {
  const email = (presetEmail ?? (await ask("Email of the admin"))).trim().toLowerCase();
  const { rows } = await db.query<{ id: string; name: string; role: string; active: boolean }>(
    "select id, name, role, active from admin_users where email = $1",
    [email],
  );
  if (!rows[0])
    throw new Stop(`No admin with the email ${email}. Choose "List admins" to see them.`);
  return { ...rows[0], email };
}

async function resetPassword(db: pg.Client, presetEmail?: string) {
  console.log(bold("\nReset a password\n"));
  const u = await findUser(db, presetEmail);
  let password = "";
  if (interactive && !presetEmail) {
    console.log(dim("  Press Enter to have a strong password made for you, or type your own."));
    password = await askSecret("New password");
    if (password && password.length < MIN_PASSWORD)
      throw new Stop(`Passwords need at least ${MIN_PASSWORD} characters.`);
    if (password && (await askSecret("Type it again")) !== password)
      throw new Stop("The two passwords don't match.");
  }
  const generated = !password;
  if (generated) password = generatePassword();
  const hash = await hashPassword(password);
  const res = await db.query(
    "update admin_accounts set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'",
    [hash, u.id],
  );
  if (!res.rowCount)
    await db.query(
      `insert into admin_accounts (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), u.id, hash],
    );
  // Signed out everywhere, so the old password can't linger in an open session
  await db.query("delete from admin_sessions where user_id = $1", [u.id]);
  await log(db, "team.password.reset", u.id, { email: u.email });
  console.log(green(`\n✓ New password set for ${u.name}. They were signed out everywhere.`));
  if (generated)
    console.log(`  Password:  ${bold(password)}   ${dim("(write it down: it isn't shown again)")}`);
  console.log();
}

async function toggleActive(db: pg.Client) {
  console.log(bold("\nSwitch an admin off or on\n"));
  const u = await findUser(db);
  if (u.active && u.role === "owner") {
    const owners = await db.query("select 1 from admin_users where role = 'owner' and active");
    if ((owners.rowCount ?? 0) <= 1)
      throw new Stop("That's the only active owner. Create another owner first.");
  }
  const next = !u.active;
  await db.query("update admin_users set active = $1, updated_at = now() where id = $2", [
    next,
    u.id,
  ]);
  if (!next) await db.query("delete from admin_sessions where user_id = $1", [u.id]);
  await log(db, next ? "team.reactivate" : "team.deactivate", u.id, { email: u.email });
  console.log(
    green(`\n✓ ${u.name} is ${next ? "active again" : "switched off and signed out"}.\n`),
  );
}

/* ---------------------------------------------------------------------------------------------- */

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const db = await connect();
  try {
    if (cmd === "create") return await create(db, { email: rest[0], name: rest[1], role: rest[2] });
    if (cmd === "list") return await list(db);
    if (cmd === "reset-password") return await resetPassword(db, rest[0]);
    if (cmd) throw new Stop(`Unknown command "${cmd}". Try: npm run admin`);

    if (!interactive)
      throw new Stop(
        'Run "npm run admin" in a terminal, or use: npm run admin -- create EMAIL "NAME"',
      );
    console.log(bold("\nZALFI admin accounts\n"));
    console.log("  1  Create an admin");
    console.log("  2  List admins");
    console.log("  3  Reset a password");
    console.log("  4  Switch an admin off or on\n");
    const choice = await ask("Choose", "1");
    if (choice === "1") await create(db, {});
    else if (choice === "2") await list(db);
    else if (choice === "3") await resetPassword(db);
    else if (choice === "4") await toggleActive(db);
    else throw new Stop("Choose 1, 2, 3 or 4.");
  } finally {
    rl?.close();
    await db.end();
  }
}

main().catch((err) => {
  rl?.close();
  console.error(err instanceof Stop ? red(`\n✗ ${err.message}\n`) : err);
  process.exit(1);
});
