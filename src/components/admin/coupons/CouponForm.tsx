"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { poishaToTaka, takaToPoisha } from "@/lib/money";
import { fromDhakaInput, toDhakaInput } from "@/lib/time";
import { couponSchema, type CouponInput } from "@/server/coupons/schema";
import type { CouponTarget } from "@/server/coupons";
import { sizeLabel } from "@/lib/size";
import { saveCouponAction } from "@/app/(admin)/admin/(app)/coupons/actions";

/** What the form holds: money in taka and dates in Dhaka time, as typed */
type Draft = {
  code: string;
  description: string;
  active: boolean;
  kind: "percent" | "amount" | "none";
  percent: string;
  cap: string;
  amount: string;
  freeShipping: boolean;
  minSubtotal: string;
  firstOrderOnly: boolean;
  usageLimit: string;
  perCustomerLimit: string;
  startsAt: string;
  endsAt: string;
  restrict: boolean;
  fragranceIds: number[];
  variantIds: number[];
};

export type CouponInitial = {
  code: string;
  description: string;
  active: boolean;
  percentOff: number | null;
  maxDiscount: number | null;
  amountOff: number | null;
  freeShipping: boolean;
  minSubtotal: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  fragranceIds: number[];
  variantIds: number[];
};

const num = (v: number | null) => (v === null ? "" : String(v));
const taka = (v: number | null) => (v === null ? "" : String(poishaToTaka(v)));

function toDraft(c: CouponInitial | null): Draft {
  return {
    code: c?.code ?? "",
    description: c?.description ?? "",
    active: c?.active ?? true,
    kind:
      c?.percentOff !== null && c?.percentOff !== undefined
        ? "percent"
        : c?.amountOff
          ? "amount"
          : c
            ? "none"
            : "percent",
    percent: num(c?.percentOff ?? null),
    cap: taka(c?.maxDiscount ?? null),
    amount: taka(c?.amountOff ?? null),
    freeShipping: c?.freeShipping ?? false,
    minSubtotal: taka(c?.minSubtotal ?? null),
    firstOrderOnly: c?.firstOrderOnly ?? false,
    usageLimit: num(c?.usageLimit ?? null),
    perCustomerLimit: num(c?.perCustomerLimit ?? null),
    startsAt: toDhakaInput(c?.startsAt ?? null),
    endsAt: toDhakaInput(c?.endsAt ?? null),
    restrict: !!c && (c.fragranceIds.length > 0 || c.variantIds.length > 0),
    fragranceIds: c?.fragranceIds ?? [],
    variantIds: c?.variantIds ?? [],
  };
}

const intOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const takaOrNull = (s: string) => (s.trim() === "" ? null : takaToPoisha(Number(s)));

function toInput(d: Draft): CouponInput {
  return {
    code: d.code,
    description: d.description,
    active: d.active,
    percentOff: d.kind === "percent" ? intOrNull(d.percent) : null,
    maxDiscount: d.kind === "percent" ? takaOrNull(d.cap) : null,
    amountOff: d.kind === "amount" ? takaOrNull(d.amount) : null,
    freeShipping: d.freeShipping,
    minSubtotal: takaOrNull(d.minSubtotal),
    firstOrderOnly: d.firstOrderOnly,
    usageLimit: intOrNull(d.usageLimit),
    perCustomerLimit: intOrNull(d.perCustomerLimit),
    startsAt: d.startsAt ? fromDhakaInput(d.startsAt) : null,
    endsAt: d.endsAt ? fromDhakaInput(d.endsAt) : null,
    fragranceIds: d.restrict ? d.fragranceIds : [],
    variantIds: d.restrict ? d.variantIds : [],
  };
}

const LABELS: Record<string, string> = {
  code: "Code",
  percentOff: "Percentage",
  maxDiscount: "Cap",
  amountOff: "Amount",
  minSubtotal: "Minimum order",
  usageLimit: "Total uses",
  perCustomerLimit: "Uses per customer",
  endsAt: "Ends",
  startsAt: "Starts",
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function CouponForm({
  id,
  initial,
  targets,
}: {
  id: number | null;
  initial: CouponInitial | null;
  targets: CouponTarget[];
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setError(null);
  };

  function save() {
    const check = couponSchema.safeParse(toInput(d));
    if (!check.success) {
      const i = check.error.issues[0];
      const where = i ? LABELS[String(i.path[0])] : null;
      return setError(i ? `${where ? `${where}: ` : ""}${i.message}` : "Check the form.");
    }
    start(async () => {
      const r = await saveCouponAction({ id, values: toInput(d) });
      if (!r.ok) {
        setError(r.error);
        return void toast.error(r.error);
      }
      toast.success(id ? "Coupon saved" : `${check.data.code} created`);
      if (!id) router.push(`/admin/coupons/${r.data.id}`);
      else router.refresh();
    });
  }

  const toggleIn = (k: "fragranceIds" | "variantIds", v: number, on: boolean) =>
    set(k, on ? [...new Set([...d[k], v])] : d[k].filter((x) => x !== v));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Code and discount</CardTitle>
          <CardDescription>
            Customers type the code at checkout. One code per order.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="c-code" label="Code" hint="Letters and numbers; not case-sensitive">
            <Input
              id="c-code"
              value={d.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              maxLength={30}
              className="font-mono uppercase"
              autoComplete="off"
            />
          </Field>
          <Field id="c-desc" label="Note for the team" hint="Not shown to customers">
            <Input
              id="c-desc"
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={200}
            />
          </Field>
          <Field id="c-kind" label="Discount">
            <Select value={d.kind} onValueChange={(v) => set("kind", v as Draft["kind"])}>
              <SelectTrigger id="c-kind" className="w-full">
                <SelectValue>
                  {
                    {
                      percent: "A percentage off",
                      amount: "A fixed amount off",
                      none: "No discount",
                    }[d.kind]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">A percentage off</SelectItem>
                <SelectItem value="amount">A fixed amount off</SelectItem>
                <SelectItem value="none">No discount</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {d.kind === "percent" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field id="c-pct" label="Percent">
                <Input
                  id="c-pct"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={d.percent}
                  onChange={(e) => set("percent", e.target.value)}
                />
              </Field>
              <Field id="c-cap" label="Cap (৳, optional)">
                <Input
                  id="c-cap"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={d.cap}
                  onChange={(e) => set("cap", e.target.value)}
                />
              </Field>
            </div>
          ) : d.kind === "amount" ? (
            <Field id="c-amt" label="Amount (৳)">
              <Input
                id="c-amt"
                type="number"
                inputMode="numeric"
                min={1}
                value={d.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>
          ) : (
            <div />
          )}
          <div className="md:col-span-2">
            <Toggle
              id="c-ship"
              label="Free shipping"
              hint="The order ships free, inside or outside Dhaka."
              checked={d.freeShipping}
              onChange={(v) => set("freeShipping", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>Leave a field empty for no limit. Times are Dhaka time.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field id="c-min" label="Minimum order (৳)">
            <Input
              id="c-min"
              type="number"
              inputMode="numeric"
              min={0}
              value={d.minSubtotal}
              onChange={(e) => set("minSubtotal", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="c-uses" label="Total uses">
              <Input
                id="c-uses"
                type="number"
                inputMode="numeric"
                min={1}
                value={d.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value)}
              />
            </Field>
            <Field id="c-per" label="Per customer">
              <Input
                id="c-per"
                type="number"
                inputMode="numeric"
                min={1}
                value={d.perCustomerLimit}
                onChange={(e) => set("perCustomerLimit", e.target.value)}
              />
            </Field>
          </div>
          <Field id="c-start" label="Starts">
            <Input
              id="c-start"
              type="datetime-local"
              value={d.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </Field>
          <Field id="c-end" label="Ends">
            <Input
              id="c-end"
              type="datetime-local"
              value={d.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <Toggle
              id="c-first"
              label="First order only"
              hint="Checked against the customer's verified phone number."
              checked={d.firstOrderOnly}
              onChange={(v) => set("firstOrderOnly", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applies to</CardTitle>
          <CardDescription>
            The discount counts only the bottles it applies to. Free shipping applies to the order.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Toggle
            id="c-restrict"
            label="Only some fragrances or sets"
            hint="Off: every fragrance, size and discovery set. A fragrance doesn't include the sets that hold it."
            checked={d.restrict}
            onChange={(v) => set("restrict", v)}
          />
          {d.restrict && (
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {targets.map((f) =>
                f.kind === "set" ? (
                  <label
                    key={`set-${f.id}`}
                    className="flex items-center gap-2 self-start text-sm font-medium"
                  >
                    <Checkbox
                      checked={d.variantIds.includes(f.sizes[0]!.id)}
                      onCheckedChange={(v) => toggleIn("variantIds", f.sizes[0]!.id, !!v)}
                    />
                    {f.name}
                    <span className="text-muted-foreground text-xs font-normal">
                      Discovery set{!f.published && ", hidden"}
                    </span>
                  </label>
                ) : (
                  <div key={f.id} className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={d.fragranceIds.includes(f.id)}
                        onCheckedChange={(v) => toggleIn("fragranceIds", f.id, !!v)}
                      />
                      {f.name}
                      {!f.published && (
                        <span className="text-muted-foreground text-xs">(hidden)</span>
                      )}
                    </label>
                    {f.sizes.length > 1 &&
                      !d.fragranceIds.includes(f.id) &&
                      f.sizes.map((s) => (
                        <label key={s.id} className="ml-6 flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={d.variantIds.includes(s.id)}
                            onCheckedChange={(v) => toggleIn("variantIds", s.id, !!v)}
                          />
                          {sizeLabel(s.sizeMl, s.pieces)} only
                        </label>
                      ))}
                  </div>
                ),
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={d.active}
              onCheckedChange={(v) => set("active", v)}
              aria-label="Active"
            />
            {d.active ? "On: customers can use it" : "Off: nobody can use it"}
          </label>
          <div className="flex items-center gap-3">
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {id ? "Save coupon" : "Create coupon"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
