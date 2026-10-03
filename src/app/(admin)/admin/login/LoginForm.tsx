"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { PasswordInput } from "@/components/admin/ui/password-input";

/** What went wrong, in words that say what to do next */
function signInError(err: { status?: number; message?: string; code?: string } | null) {
  const status = err?.status ?? 0;
  const message = err?.message ?? "";
  if (status === 401) return "That email and password don't match.";
  if (status === 429) return "Too many attempts. Try again in a few minutes.";
  if (status === 403 && /deactivat/i.test(message))
    return "This account is switched off. Ask an owner to turn it back on.";
  if (status === 403 && /origin/i.test(message))
    return `This address isn't allowed to sign in. Open the admin at ${window.location.protocol}//localhost:${window.location.port || "3000"}/admin, or set NEXT_PUBLIC_SITE_URL in .env.`;
  if (status >= 500 || status === 0)
    return "The server couldn't reach the database. Make sure PostgreSQL is running and the site was started with npm run dev, then try again.";
  return message || "Couldn't sign in. Try again.";
}

export function LoginForm({
  next,
  invitedEmail,
  twoFactor,
}: {
  next: string;
  invitedEmail: string | null;
  twoFactor: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "totp">(twoFactor ? "totp" : "password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await authClient.signIn
      .email({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      })
      .catch(() => ({ data: null, error: { status: 0, message: "" } }));
    const { data, error } = res;
    setBusy(false);
    if (error) {
      setError(signInError(error));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setStep("totp");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onTotp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setBusy(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error)
      return setError("That code didn't work. Check your authenticator app and try again.");
    router.replace(next);
    router.refresh();
  }

  if (step === "totp")
    return (
      <form onSubmit={onTotp} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Authenticator code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={8}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Checking…" : "Verify"}
        </Button>
      </form>
    );

  return (
    <form onSubmit={onPassword} className="flex flex-col gap-4">
      {invitedEmail && (
        <p className="bg-muted rounded-md px-3 py-2 text-sm">
          Your account is ready. Sign in with <strong>{invitedEmail}</strong>.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={invitedEmail ?? ""}
          required
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
