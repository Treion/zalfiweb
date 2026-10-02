/**
 * Creates the first owner account for the admin (/admin). Run once:
 *
 *   npm run admin:create-owner -- --email owner@example.com --name "Owner Name"
 *
 * It asks for the password (hidden). For automation, set ADMIN_OWNER_PASSWORD instead.
 * Further team members are invited from the admin (Team).
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createAdminUser, MIN_PASSWORD, TeamError } from "@/server/admin/team";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as {
      _writeToOutput: (s: string) => void;
      output: NodeJS.WriteStream;
    };
    let asked = false;
    out._writeToOutput = (s: string) => {
      if (!asked) {
        out.output.write(s);
        asked = true;
      } else if (s.includes("\n")) out.output.write("\n");
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" } },
  });
  if (!values.email || !values.name) {
    console.error(
      'Usage: npm run admin:create-owner -- --email you@example.com --name "Your Name"',
    );
    process.exit(1);
  }
  let password = process.env.ADMIN_OWNER_PASSWORD ?? "";
  if (!password) {
    password = await askHidden(`Password (at least ${MIN_PASSWORD} characters): `);
    const again = await askHidden("Repeat the password: ");
    if (password !== again) throw new TeamError("The passwords don't match.");
  }
  const user = await createAdminUser({
    email: values.email,
    name: values.name,
    password,
    role: "owner",
  });
  console.log(`Owner created: ${user.email}. Sign in at /admin/login.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof TeamError ? err.message : err);
  process.exit(1);
});
