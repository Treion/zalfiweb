"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/admin/ui/alert-dialog";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { PasswordInput } from "@/components/admin/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/admin/ui/sheet";
import { Switch } from "@/components/admin/ui/switch";
import { formatDateTime } from "@/lib/time";
import type { Mode } from "@/server/integrations/catalog";
import {
  copyFromEnvAction,
  rotateWebhookAction,
  saveIntegrationAction,
  saveManualPaymentAction,
  setGatewayOrderAction,
  setManualCourierAction,
  setSendOrderAction,
  testIntegrationAction,
} from "./actions";
import type { IntegrationsData, ProviderView } from "./view-model";

type Tone = "success" | "info" | "neutral" | "danger" | "warning";

function status(p: ProviderView): [string, Tone] {
  if (p.unreadable) return ["Keys unreadable", "danger"];
  if (!p.configured) return [p.testOnly ? "Off on the live site" : "Not set up", "neutral"];
  if (p.lastCheck && !p.lastCheck.ok) return ["Needs attention", "danger"];
  if (!p.enabled) return ["Off", "neutral"];
  if (p.testOnly) return ["Test", "info"];
  return p.mode === "live" ? ["Live", "success"] : ["Sandbox", "info"];
}

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Copy ${label}`}
      onClick={() =>
        navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? <CheckIcon /> : <CopyIcon />}
      {done ? "Copied" : "Copy"}
    </Button>
  );
}

function CheckLine({ p }: { p: ProviderView }) {
  if (!p.lastCheck) return null;
  const c = p.lastCheck;
  return (
    <p
      className={`text-xs ${c.ok ? "text-muted-foreground" : "text-[var(--tone-danger-fg)]"}`}
      role={c.ok ? undefined : "alert"}
    >
      {c.source === "test" ? "Tested" : c.ok ? "Working" : "Failed"} {formatDateTime(c.at)}:{" "}
      {c.message}
    </p>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* One provider: its card, and the sheet where it is set up                                        */

function ProviderCard({ p, canManage }: { p: ProviderView; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, tone] = status(p);
  const toggle = (enabled: boolean) =>
    start(async () => {
      const r = await saveIntegrationAction({ name: p.name, enabled });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${p.label} ${enabled ? "on" : "off"}`);
      router.refresh();
    });
  return (
    <Card className="gap-3 py-4" data-provider={p.name}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{p.label}</span>
          <Badge variant={tone}>{label}</Badge>
        </CardTitle>
        <CardDescription>{p.blurb}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <CheckLine p={p} />
        {p.source === "env" && (
          <p className="text-muted-foreground text-xs">
            Using the keys in the hosting settings (environment variables).
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={p.enabled}
              disabled={!canManage || pending || !p.configured}
              onCheckedChange={toggle}
              aria-label={`${p.label} on or off`}
            />
            {p.enabled ? "On" : "Off"}
          </label>
          {!p.testOnly && <SetupSheet p={p} canManage={canManage} />}
        </div>
      </CardContent>
    </Card>
  );
}

function SetupSheet({ p, canManage }: { p: ProviderView; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>(p.mode);
  const plain = Object.fromEntries(p.fields.map((f) => [f.key, f.secret ? "" : (f.display ?? "")]));
  const [values, setValues] = useState<Record<string, string>>(plain);
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [stores, setStores] = useState<{ id: string; name: string; address: string }[]>([]);
  const [smsTo, setSmsTo] = useState("");
  const [token, setToken] = useState(p.webhook?.token ?? null);

  const reset = () => {
    setValues(plain);
    setReplacing({});
    setMode(p.mode);
    setResult(null);
  };

  const changes = () => {
    const out: Record<string, string | null> = {};
    for (const f of p.fields) {
      const v = values[f.key]?.trim() ?? "";
      if (f.secret) {
        if ((replacing[f.key] || !f.set) && v) out[f.key] = v;
      } else if (v !== (f.display ?? "")) out[f.key] = v || null;
    }
    return out;
  };
  const dirty = Object.keys(changes()).length > 0 || mode !== p.mode;

  const save = () =>
    start(async () => {
      const r = await saveIntegrationAction({
        name: p.name,
        values: changes(),
        ...(p.modes.length && mode !== p.mode ? { mode } : {}),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${p.label} saved`);
      setReplacing({});
      setResult(null);
      router.refresh();
    });

  const test = () =>
    start(async () => {
      const r = await testIntegrationAction({
        name: p.name,
        ...(p.group === "sms" ? { to: smsTo } : {}),
      });
      if (!r.ok) return void toast.error(r.error);
      setResult(r.data);
      setStores(r.data.stores ?? []);
      router.refresh();
    });

  const pickStore = (key: string, id: string) =>
    start(async () => {
      const r = await saveIntegrationAction({ name: p.name, values: { [key]: id } });
      if (!r.ok) return void toast.error(r.error);
      setValues((v) => ({ ...v, [key]: id }));
      toast.success("Pickup store saved");
      router.refresh();
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {canManage ? (p.configured ? "Set up" : "Set it up") : "Details"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <div className="flex flex-col gap-6 p-6">
          <div>
            <SheetTitle className="font-display text-2xl">{p.label}</SheetTitle>
            <p className="text-muted-foreground mt-1 text-sm">{p.blurb}</p>
          </div>

          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            {p.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>

          {p.unreadable && (
            <p className="rounded-md bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-fg)]">
              The saved keys can&rsquo;t be read any more (the server&rsquo;s secret changed). Enter
              them again.
            </p>
          )}
          {p.source === "env" && canManage && (
            <div className="rounded-md border px-3 py-3 text-sm">
              <p>
                These keys come from the hosting settings (environment variables). Saving any change
                here moves all of them into the admin, encrypted, so you can change them here from
                now on.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await copyFromEnvAction({ name: p.name });
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Moved into the admin");
                    router.refresh();
                  })
                }
              >
                Move them into the admin
              </Button>
            </div>
          )}

          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <fieldset disabled={!canManage || pending} className="flex flex-col gap-5">
              {p.modes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label>Mode</Label>
                  <div className="flex gap-2" role="radiogroup" aria-label="Mode">
                    {p.modes.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={mode === m}
                        variant={mode === m ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMode(m)}
                      >
                        {m === "live" ? "Live: real money and parcels" : "Sandbox: test only"}
                      </Button>
                    ))}
                  </div>
                  {p.sandboxValues && mode === "sandbox" && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="w-fit px-0"
                      onClick={() => {
                        setValues((v) => ({ ...v, ...p.sandboxValues }));
                        setReplacing(
                          Object.fromEntries(Object.keys(p.sandboxValues!).map((k) => [k, true])),
                        );
                      }}
                    >
                      Fill in {p.label}&rsquo;s public sandbox account
                    </Button>
                  )}
                </div>
              )}

              {p.fields.map((f) => {
                const id = `${p.name}-${f.key}`;
                const showSaved = f.secret && f.set && !replacing[f.key];
                return (
                  <div key={f.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={id}>
                      {f.label}
                      {!f.required && (
                        <span className="text-muted-foreground font-normal"> (optional)</span>
                      )}
                    </Label>
                    {showSaved ? (
                      <div className="flex items-center gap-2">
                        <code className="bg-muted rounded px-2 py-1 font-mono text-sm">
                          {f.display}
                        </code>
                        {canManage && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setReplacing((r) => ({ ...r, [f.key]: true }))}
                          >
                            Replace
                          </Button>
                        )}
                      </div>
                    ) : f.secret ? (
                      <PasswordInput
                        id={id}
                        autoComplete="off"
                        value={values[f.key] ?? ""}
                        placeholder={f.set ? "Type the new value" : (f.placeholder ?? "")}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    ) : f.pick && stores.length > 0 ? (
                      <Select
                        value={values[f.key] ?? ""}
                        onValueChange={(v) => pickStore(f.key, v)}
                      >
                        <SelectTrigger id={id} className="w-full">
                          <SelectValue placeholder="Choose a store" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                              {s.address ? ` · ${s.address}` : ""} ({s.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        autoComplete="off"
                        value={values[f.key] ?? ""}
                        placeholder={
                          f.pick ? "Press Test connection to choose" : (f.placeholder ?? "")
                        }
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    )}
                    <p className="text-muted-foreground text-xs">{f.help}</p>
                  </div>
                );
              })}
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!dirty}>
                    Save
                  </Button>
                  {dirty && (
                    <Button type="button" variant="ghost" onClick={reset}>
                      Undo changes
                    </Button>
                  )}
                </div>
              )}
            </fieldset>
          </form>

          {canManage && (
            <section className="flex flex-col gap-3 border-t pt-5">
              <h3 className="font-medium">Test connection</h3>
              {p.group === "sms" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sms-to">Send a test SMS to</Label>
                  <Input
                    id="sms-to"
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Button type="button" variant="outline" disabled={pending || dirty} onClick={test}>
                  Test connection
                </Button>
                {dirty && (
                  <span className="text-muted-foreground ml-3 text-xs">Save first, then test.</span>
                )}
              </div>
              {result && (
                <p
                  role="status"
                  className={`rounded-md px-3 py-2 text-sm ${
                    result.ok
                      ? "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]"
                      : "bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)]"
                  }`}
                >
                  {result.message}
                </p>
              )}
              {!result && <CheckLine p={p} />}
            </section>
          )}

          {p.webhook && (
            <section className="flex flex-col gap-3 border-t pt-5">
              <h3 className="font-medium">
                {p.group === "payments" ? "Notification address (IPN)" : "Webhook"}
              </h3>
              <p className="text-muted-foreground text-sm">{p.webhook.how}</p>
              <div className="flex flex-col gap-1.5">
                <Label>Address</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded px-2 py-1.5 font-mono text-xs whitespace-nowrap">
                    {p.webhook.inUrl && token
                      ? p.webhook.url.replace(/token=[^&]*/, `token=${token}`)
                      : p.webhook.url}
                  </code>
                  <Copy
                    label="address"
                    value={
                      p.webhook.inUrl && token
                        ? p.webhook.url.replace(/token=[^&]*/, `token=${token}`)
                        : p.webhook.url
                    }
                  />
                </div>
              </div>
              {token && !p.webhook.inUrl && (
                <div className="flex flex-col gap-1.5">
                  <Label>{p.webhook.tokenLabel ?? "Secret"}</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded px-2 py-1.5 font-mono text-xs">
                      {token}
                    </code>
                    <Copy label={p.webhook.tokenLabel ?? "secret"} value={token} />
                  </div>
                </div>
              )}
              {canManage && (p.webhook.token || p.webhook.inUrl) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="w-fit">
                      <RefreshCwIcon /> Make a new secret
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Make a new webhook secret?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {p.label}&rsquo;s updates stop arriving until you paste the new{" "}
                        {p.webhook.inUrl ? "address" : "secret"} into its panel.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep the current one</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          start(async () => {
                            const r = await rotateWebhookAction({ name: p.name });
                            if (!r.ok) return void toast.error(r.error);
                            setToken(r.data);
                            toast.success("New secret made: paste it into the panel now");
                            router.refresh();
                          })
                        }
                      >
                        Make a new one
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* The fallbacks that need no keys                                                                 */

type Wallet = IntegrationsData["payments"]["manual"]["bkash"];

function ManualPaymentCard({
  manual,
  canManage,
}: {
  manual: IntegrationsData["payments"]["manual"];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(manual);
  const dirty = JSON.stringify(m) !== JSON.stringify(manual);
  const on = manual.enabled;
  const wallet = (key: "bkash" | "nagad", label: string) => {
    const w = m[key];
    const set = (patch: Partial<Wallet>) => setM((x) => ({ ...x, [key]: { ...x[key], ...patch } }));
    return (
      <div className="flex flex-col gap-3 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={w.enabled} onCheckedChange={(c) => set({ enabled: c })} />
          {label}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${key}-number`}>{label} number</Label>
            <Input
              id={`${key}-number`}
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={w.number}
              onChange={(e) => set({ number: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${key}-type`}>Account</Label>
            <Select
              value={w.accountType}
              onValueChange={(v) => set({ accountType: v as Wallet["accountType"] })}
            >
              <SelectTrigger id={`${key}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal (customers use Send Money)</SelectItem>
                <SelectItem value="merchant">Merchant (customers use Payment)</SelectItem>
                <SelectItem value="agent">Agent (customers use Cash In)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };
  return (
    <Card className="gap-3 py-4" data-provider="manual-payment">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>bKash and Nagad (by hand)</span>
          <Badge variant={on ? "success" : "neutral"}>{on ? "On" : "Off"}</Badge>
        </CardTitle>
        <CardDescription>
          Customers send the money to your number and type the transaction ID. You check it in your
          app, then confirm it on the order. Works even when the gateways are down.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveManualPaymentAction(m);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Saved");
              router.refresh();
            });
          }}
        >
          <fieldset disabled={!canManage || pending} className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={m.enabled}
                onCheckedChange={(c) => setM((x) => ({ ...x, enabled: c }))}
              />
              Offer it at checkout
            </label>
            {wallet("bkash", "bKash")}
            {wallet("nagad", "Nagad")}
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="manual-hold">Hold the bottles for (hours)</Label>
              <Input
                id="manual-hold"
                type="number"
                min={1}
                max={72}
                value={m.holdHours}
                onChange={(e) => setM((x) => ({ ...x, holdHours: Number(e.target.value) }))}
              />
              <p className="text-muted-foreground text-xs">
                An order with no transaction ID by then lapses, and its bottles go back on sale. One
                with a transaction ID waits for you.
              </p>
            </div>
            {canManage && (
              <div>
                <Button type="submit" disabled={!dirty}>
                  Save
                </Button>
              </div>
            )}
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function OtherCourierCard({ enabled, canManage }: { enabled: boolean; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card className="gap-3 py-4" data-provider="manual-courier">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>Other courier or own rider</span>
          <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
        </CardTitle>
        <CardDescription>
          Send with any courier (Sundarban, Paperfly…) or your own rider. Type its tracking number
          and link; move the parcel along from the order page. Needs no keys.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={enabled}
            disabled={!canManage || pending}
            onCheckedChange={(c) =>
              start(async () => {
                const r = await setManualCourierAction({ enabled: c });
                if (!r.ok) return void toast.error(r.error);
                router.refresh();
              })
            }
            aria-label="Other courier on or off"
          />
          {enabled ? "On" : "Off"}
        </label>
      </CardContent>
    </Card>
  );
}

function GatewayOrder({
  first,
  canManage,
}: {
  first: "sslcommerz" | "aamarpay";
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-sm">
      <Label htmlFor="gateway-first">Checkout tries first</Label>
      <Select
        value={first}
        disabled={!canManage || pending}
        onValueChange={(v) =>
          start(async () => {
            const r = await setGatewayOrderAction({ first: v });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Saved");
            router.refresh();
          })
        }
      >
        <SelectTrigger id="gateway-first" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sslcommerz">SSLCommerz</SelectItem>
          <SelectItem value="aamarpay">aamarPay</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">
        If it can&rsquo;t open a payment page, the other one (when on) takes over by itself.
      </span>
    </div>
  );
}

/**
 * The order SMS gateways (or email services) are tried in. Only the ones switched on are listed;
 * the rest keep their place for when they are switched on.
 */
function SendOrder({
  kind,
  order,
  providers,
  canManage,
  testAllowed,
}: {
  kind: "sms" | "email";
  order: ProviderView["name"][];
  providers: ProviderView[];
  canManage: boolean;
  testAllowed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const on = order
    .map((n) => providers.find((p) => p.name === n))
    .filter((p): p is ProviderView => !!p?.enabled);
  const what = kind === "sms" ? "codes" : "receipts";
  if (on.length === 0)
    return (
      <p className="rounded-md bg-[var(--tone-warning-bg)] px-4 py-3 text-sm text-[var(--tone-warning-fg)]">
        {kind === "sms"
          ? testAllowed
            ? "No SMS gateway is on: checkout codes print in the server's console instead."
            : "No SMS gateway is on: customers can't get their checkout code. Switch one on below."
          : testAllowed
            ? "No email service is on: emails are saved to the Dev outbox instead."
            : "No email service is on: receipts and invitations aren't sent. Switch one on below."}
      </p>
    );
  if (on.length === 1)
    return (
      <p className="rounded-md border px-4 py-3 text-sm">
        {`Sends ${what} with ${on[0]!.label}. Switch on a second one as a backup.`}
      </p>
    );

  const move = (i: number, by: -1 | 1) =>
    start(async () => {
      const names = on.map((p) => p.name);
      [names[i], names[i + by]] = [names[i + by]!, names[i]!];
      // The ones switched off keep their places after these
      const next = [...names, ...order.filter((n) => !names.includes(n))];
      const r = await setSendOrderAction({ kind, order: next });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved");
      router.refresh();
    });

  return (
    <div className="rounded-md border px-4 py-3 text-sm">
      <p className="mb-2">
        {`Sends ${what} with the first one. If it fails, the next takes over by itself.`}
      </p>
      <ol className="flex flex-col divide-y">
        {on.map((p, i) => (
          <li key={p.name} className="flex items-center gap-3 py-1.5">
            <span className="text-muted-foreground w-5 tabular-nums">{i + 1}.</span>
            <span className="flex-1">{p.label}</span>
            {canManage && (
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={pending || i === 0}
                  aria-label={`Move ${p.label} up`}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={pending || i === on.length - 1}
                  aria-label={`Move ${p.label} down`}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{description}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

const grid = "grid gap-4 md:grid-cols-2 xl:grid-cols-3";

export function IntegrationsView({ data }: { data: IntegrationsData }) {
  const by = (g: ProviderView["group"]) => data.providers.filter((p) => p.group === g);
  const cards = (g: ProviderView["group"]) =>
    by(g).map((p) => <ProviderCard key={p.name} p={p} canManage={data.canManage} />);
  const cod = data.payments.codEnabled;
  return (
    <>
      <Section
        title="Payments"
        description="Online gateways, and the ways to be paid when they're down."
      >
        <GatewayOrder first={data.gatewayFirst} canManage={data.canManage} />
        <div className={grid}>
          {cards("payments")}
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>Cash on delivery</span>
                <Badge variant={cod ? "success" : "neutral"}>{cod ? "On" : "Off"}</Badge>
              </CardTitle>
              <CardDescription>The courier collects the cash. Needs no keys.</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/settings">Change in Settings → Payments</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <ManualPaymentCard manual={data.payments.manual} canManage={data.canManage} />
      </Section>
      <Section
        title="Couriers"
        description="Who takes your parcels. A courier switched off keeps updating the parcels it already has."
      >
        <div className={grid}>
          {cards("couriers")}
          <OtherCourierCard enabled={data.manualCourierEnabled} canManage={data.canManage} />
        </div>
      </Section>
      <Section
        title="SMS"
        description="Sends the checkout's verification code. Without one, customers can't check out."
      >
        <SendOrder
          kind="sms"
          order={data.smsOrder}
          providers={by("sms")}
          canManage={data.canManage}
          testAllowed={data.testAllowed}
        />
        <div className={grid}>{cards("sms")}</div>
      </Section>
      <Section
        title="Email"
        description="Sends the e-receipt with its PDF invoice, and team invitations."
      >
        <SendOrder
          kind="email"
          order={data.emailOrder}
          providers={by("email")}
          canManage={data.canManage}
          testAllowed={data.testAllowed}
        />
        <div className={grid}>{cards("email")}</div>
      </Section>
    </>
  );
}
