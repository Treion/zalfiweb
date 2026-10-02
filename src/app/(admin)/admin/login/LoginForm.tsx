"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";

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
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Try again in a few minutes."
          : error.status === 403
            ? "This account is deactivated."
            : "That email and password don't match.",
      );
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
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
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
