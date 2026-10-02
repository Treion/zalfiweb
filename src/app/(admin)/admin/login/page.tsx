import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { getAdmin } from "@/server/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

/** Only /admin paths are allowed as a return address (no open redirects) */
const safeNext = (next: unknown) =>
  typeof next === "string" && /^\/admin(\/[\w\-/?=&%.]*)?$/.test(next) ? next : "/admin";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getAdmin()) redirect(next);
  const invited = typeof sp.invited === "string" ? sp.invited : null;
  return (
    <main id="main" className="grid min-h-svh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Logo variant="full" title="ZALFI" className="h-16 w-auto" />
          <p className="eyebrow">Admin</p>
        </div>
        <LoginForm next={next} invitedEmail={invited} twoFactor={sp.step === "2fa"} />
      </div>
    </main>
  );
}
