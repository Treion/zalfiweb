import { after } from "next/server";

/**
 * Work that shouldn't hold up the response (the e-receipt): run after it is sent. Inside a request,
 * `after()` keeps a serverless function (Vercel, Netlify) alive until the task ends, where a bare
 * promise could be frozen half-way and never finish. Outside a request (scripts, tests) it simply
 * starts. A failure is logged under `label`, never thrown.
 */
export function inBackground(label: string, task: () => Promise<unknown>) {
  const run = () => task().catch((e: Error) => console.error(`[${label}]`, e.message));
  try {
    after(run);
  } catch {
    void run();
  }
}
