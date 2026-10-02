import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth";

// Better Auth's endpoints for the admin (sign-in, sign-out, session, two-factor). Node runtime.
export const dynamic = "force-dynamic";

export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(req);
