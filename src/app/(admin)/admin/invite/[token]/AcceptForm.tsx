"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { acceptInvitationAction } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirm")) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    const res = await acceptInvitationAction({
      token,
      name: String(form.get("name") ?? ""),
      password,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace(`/admin/login?invited=${encodeURIComponent(res.email)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required autoFocus />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-muted-foreground text-xs">At least 10 characters.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Repeat password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
