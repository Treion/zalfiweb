"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { Textarea } from "@/components/admin/ui/textarea";
import { DHAKA_AREAS, DHAKA_CITY_THANAS } from "@/lib/bd-geo";
import { poishaToTaka, takaToPoisha } from "@/lib/money";
import { SETTINGS_SCHEMAS, type Settings, type SettingsKey } from "@/server/settings/schema";
import { saveSettingsAction, setPaymentGatewayAction } from "./actions";

type All = { [K in SettingsKey]: Settings<K> };

/* ---------------------------------------------------------------------------------------------- */

function useSection<K extends SettingsKey, F extends FieldValues>(
  key: K,
  toForm: (v: Settings<K>) => F,
  fromForm: (f: F) => Settings<K>,
  initial: Settings<K>,
) {
  const form = useForm<F>({ defaultValues: toForm(initial) as never });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit((f) => {
    const value = fromForm(f);
    // The same schema the server enforces: catch mistakes before sending
    const check = SETTINGS_SCHEMAS[key].safeParse(value);
    if (!check.success) {
      const i = check.error.issues[0];
      setError(i ? `${String(i.path[0] ?? "")}: ${i.message}` : "Check the form.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await saveSettingsAction({ key, value: check.data });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Saved");
        form.reset(f);
      }
    });
  });
  return { form, onSubmit, pending, error };
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function SwitchRow({
  form,
  name,
  label,
  hint,
  disabled,
}: {
  form: UseFormReturn<FieldValues>;
  name: string;
  label: string;
  hint?: string;
  disabled: boolean;
}) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-6 py-1">
          <div>
            <Label htmlFor={name}>{label}</Label>
            {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
          </div>
          <Switch
            id={name}
            checked={!!field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}

function SectionCard({
  title,
  description,
  canEdit,
  pending,
  dirty,
  error,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  canEdit: boolean;
  pending: boolean;
  dirty: boolean;
  error: string | null;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset disabled={!canEdit} className="grid gap-5 md:grid-cols-2">
            {children}
          </fieldset>
        </CardContent>
        {canEdit && (
          <CardFooter className="justify-end gap-3 border-t">
            {error && (
              <p role="alert" className="text-destructive mr-auto text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function StoreForm({ v, canEdit }: { v: Settings<"store">; canEdit: boolean }) {
  const s = useSection(
    "store",
    (x) => x,
    (f) => f,
    v,
  );
  return (
    <SectionCard
      title="Store"
      description="Shown on receipts and invoices."
      canEdit={canEdit}
      {...s}
      dirty={s.form.formState.isDirty}
    >
      <Field label="Store name" htmlFor="store-name">
        <Input id="store-name" {...s.form.register("name")} />
      </Field>
      <Field label="Contact phone" htmlFor="store-phone">
        <Input id="store-phone" {...s.form.register("contactPhone")} />
      </Field>
      <Field label="Email" htmlFor="store-email">
        <Input id="store-email" type="email" {...s.form.register("email")} />
      </Field>
      <Field label="Address" htmlFor="store-address">
        <Textarea id="store-address" rows={2} {...s.form.register("address")} />
      </Field>
    </SectionCard>
  );
}

function InvoiceForm({ v, canEdit }: { v: Settings<"invoice">; canEdit: boolean }) {
  const s = useSection(
    "invoice",
    (x) => x,
    (f) => ({ ...f, vatRate: Number(f.vatRate) || 0 }),
    v,
  );
  return (
    <SectionCard
      title="Invoice details"
      description="All optional. Filled-in details appear on receipts and invoice PDFs."
      canEdit={canEdit}
      {...s}
      dirty={s.form.formState.isDirty}
    >
      <Field label="Business name" htmlFor="inv-name">
        <Input id="inv-name" {...s.form.register("businessName")} />
      </Field>
      <Field label="Business address" htmlFor="inv-address">
        <Input id="inv-address" {...s.form.register("address")} />
      </Field>
      <Field label="Trade licence number" htmlFor="inv-tl">
        <Input id="inv-tl" {...s.form.register("tradeLicence")} />
      </Field>
      <Field label="BIN" htmlFor="inv-bin">
        <Input id="inv-bin" {...s.form.register("bin")} />
      </Field>
      <div className="md:col-span-2">
        <SwitchRow
          form={s.form as never}
          name="vatEnabled"
          label="Show VAT"
          hint="Prices include VAT; the receipt shows the VAT portion."
          disabled={!canEdit}
        />
      </div>
      <Field label="VAT rate (%)" htmlFor="inv-vat">
        <Input
          id="inv-vat"
          type="number"
          step="0.01"
          min={0}
          max={100}
          {...s.form.register("vatRate")}
        />
      </Field>
      <Field label="Footer note" htmlFor="inv-footer">
        <Textarea id="inv-footer" rows={2} {...s.form.register("footerNote")} />
      </Field>
    </SectionCard>
  );
}

type ShippingForm = {
  insideDhakaFee: string;
  outsideDhakaFee: string;
  freeShippingThreshold: string;
  defaultCourier: Settings<"shipping">["defaultCourier"];
  insideDhakaAreas: string[];
};

function ShippingSection({ v, canEdit }: { v: Settings<"shipping">; canEdit: boolean }) {
  const s = useSection<"shipping", ShippingForm>(
    "shipping",
    (x) => ({
      insideDhakaFee: String(poishaToTaka(x.insideDhakaFee)),
      outsideDhakaFee: String(poishaToTaka(x.outsideDhakaFee)),
      freeShippingThreshold:
        x.freeShippingThreshold === null ? "" : String(poishaToTaka(x.freeShippingThreshold)),
      defaultCourier: x.defaultCourier,
      insideDhakaAreas: x.insideDhakaAreas,
    }),
    (f) => ({
      insideDhakaFee: takaToPoisha(Number(f.insideDhakaFee)),
      outsideDhakaFee: takaToPoisha(Number(f.outsideDhakaFee)),
      freeShippingThreshold:
        f.freeShippingThreshold.trim() === ""
          ? null
          : takaToPoisha(Number(f.freeShippingThreshold)),
      defaultCourier: f.defaultCourier,
      insideDhakaAreas: f.insideDhakaAreas,
    }),
    v,
  );
  const areas = s.form.watch("insideDhakaAreas");
  return (
    <SectionCard
      title="Shipping"
      description="Fees are worked out on the server from the delivery address."
      canEdit={canEdit}
      {...s}
      dirty={s.form.formState.isDirty}
    >
      <Field label="Inside Dhaka fee (৳)" htmlFor="ship-in">
        <Input id="ship-in" type="number" min={0} step="1" {...s.form.register("insideDhakaFee")} />
      </Field>
      <Field label="Outside Dhaka fee (৳)" htmlFor="ship-out">
        <Input
          id="ship-out"
          type="number"
          min={0}
          step="1"
          {...s.form.register("outsideDhakaFee")}
        />
      </Field>
      <Field
        label="Free shipping from (৳)"
        htmlFor="ship-free"
        hint="Leave empty to turn free shipping off."
      >
        <Input
          id="ship-free"
          type="number"
          min={0}
          step="1"
          placeholder="Off"
          {...s.form.register("freeShippingThreshold")}
        />
      </Field>
      <Field
        label="Default courier"
        htmlFor="ship-courier"
        hint="Pathao and Steadfast work once their keys are added (Go-live guide)."
      >
        <Controller
          control={s.form.control}
          name="defaultCourier"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={!canEdit}>
              <SelectTrigger id="ship-courier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">Test courier (no real deliveries)</SelectItem>
                <SelectItem value="pathao">Pathao</SelectItem>
                <SelectItem value="steadfast">Steadfast</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <div className="md:col-span-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label>Inside Dhaka areas</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Dhaka district areas that pay the inside-Dhaka fee. {areas.length} selected.
            </p>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                s.form.setValue("insideDhakaAreas", [...DHAKA_CITY_THANAS], { shouldDirty: true })
              }
            >
              Reset to Dhaka city
            </Button>
          )}
        </div>
        <Controller
          control={s.form.control}
          name="insideDhakaAreas"
          render={({ field }) => (
            <div className="grid max-h-72 grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-3 lg:grid-cols-4">
              {DHAKA_AREAS.map((a) => {
                const checked = field.value.includes(a);
                return (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      disabled={!canEdit}
                      onCheckedChange={(c) =>
                        field.onChange(
                          c ? [...field.value, a] : field.value.filter((x: string) => x !== a),
                        )
                      }
                    />
                    {a}
                  </label>
                );
              })}
            </div>
          )}
        />
      </div>
    </SectionCard>
  );
}

function PaymentsForm({ v, canEdit }: { v: Settings<"payments">; canEdit: boolean }) {
  const s = useSection(
    "payments",
    (x) => x,
    (f) => ({ ...f, unpaidExpiryMinutes: Number(f.unpaidExpiryMinutes) }),
    v,
  );
  const ssl = s.form.watch("sslcommerzEnabled");
  const cod = s.form.watch("codEnabled");
  return (
    <SectionCard
      title="Payment methods"
      description="What customers can choose at checkout."
      canEdit={canEdit}
      {...s}
      dirty={s.form.formState.isDirty}
    >
      <div className="flex flex-col gap-3 md:col-span-2">
        <SwitchRow
          form={s.form as never}
          name="sslcommerzEnabled"
          label="Online payment (SSLCommerz)"
          hint="Cards, bKash, Nagad, Rocket and more."
          disabled={!canEdit}
        />
        <SwitchRow
          form={s.form as never}
          name="codEnabled"
          label="Cash on Delivery"
          hint="Off by default. The courier collects the payment."
          disabled={!canEdit}
        />
        {!ssl && !cod && (
          <p className="rounded-md bg-[var(--tone-warning-bg)] px-3 py-2 text-sm text-[var(--tone-warning-fg)]">
            With both off, checkout can&rsquo;t take orders.
          </p>
        )}
      </div>
      <Field
        label="Unpaid order expiry (minutes)"
        htmlFor="pay-expiry"
        hint="An unpaid online order releases its bottles after this long."
      >
        <Input
          id="pay-expiry"
          type="number"
          min={5}
          max={1440}
          {...s.form.register("unpaidExpiryMinutes")}
        />
      </Field>
    </SectionCard>
  );
}

function InventoryForm({ v, canEdit }: { v: Settings<"inventory">; canEdit: boolean }) {
  const s = useSection(
    "inventory",
    (x) => x,
    (f) => ({ lowStockThreshold: Number(f.lowStockThreshold) }),
    v,
  );
  return (
    <SectionCard
      title="Inventory"
      description="When a size counts as low on stock."
      canEdit={canEdit}
      {...s}
      dirty={s.form.formState.isDirty}
    >
      <Field
        label="Default low-stock threshold"
        htmlFor="inv-low"
        hint="Each size can override this in Inventory."
      >
        <Input id="inv-low" type="number" min={0} {...s.form.register("lowStockThreshold")} />
      </Field>
    </SectionCard>
  );
}

function PermissionsForm({ v }: { v: Settings<"permissions"> }) {
  const s = useSection(
    "permissions",
    (x) => x,
    (f) => f,
    v,
  );
  return (
    <SectionCard
      title="What managers can do"
      description="Owners can always do everything."
      canEdit
      {...s}
      dirty={s.form.formState.isDirty}
    >
      <div className="flex flex-col gap-3 md:col-span-2">
        <SwitchRow
          form={s.form as never}
          name="managersCanRefund"
          label="Managers can issue refunds"
          hint="Off by default."
          disabled={false}
        />
        <SwitchRow
          form={s.form as never}
          name="managersSeeRevenue"
          label="Managers can see revenue figures"
          hint="On by default. Off hides revenue on the overview and in reports."
          disabled={false}
        />
      </div>
    </SectionCard>
  );
}

export type GatewayInfo = {
  selected: "mock" | "sslcommerz";
  note: string;
  /** Whether SSLCommerz keys are set, and which mode they are for */
  sslcommerz: "sandbox" | "live" | null;
  mockAllowed: boolean;
  canChange: boolean;
};

/** Which gateway takes online payments. Only the owner changes it; keys stay in the environment. */
function GatewayCard({ g }: { g: GatewayInfo }) {
  const [selected, setSelected] = useState(g.selected);
  const [note, setNote] = useState(g.note);
  const [pending, start] = useTransition();
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Payment gateway</CardTitle>
        <CardDescription>Where &ldquo;Pay online&rdquo; takes the customer.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field label="Gateway" htmlFor="gateway">
          <Select
            value={selected}
            disabled={!g.canChange || pending}
            onValueChange={(v) => {
              const next = v as GatewayInfo["selected"];
              setSelected(next);
              start(async () => {
                const r = await setPaymentGatewayAction({ payments: next });
                if (!r.ok) {
                  setSelected(g.selected);
                  return void toast.error(r.error);
                }
                setNote(r.data);
                toast.success("Saved");
              });
            }}
          >
            <SelectTrigger id="gateway" className="w-full">
              <SelectValue>{selected === "mock" ? "Test gateway" : "SSLCommerz"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">Test gateway</SelectItem>
              <SelectItem value="sslcommerz">SSLCommerz</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex flex-col gap-2 text-sm">
          <p>{note}</p>
          <p className="text-muted-foreground text-xs">
            {g.sslcommerz
              ? `SSLCommerz keys are set (${g.sslcommerz}).`
              : "SSLCommerz keys aren't set yet (SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD)."}
            {!g.mockAllowed && " The test gateway is off on the live site."}
            {!g.canChange && " Only the owner can change this."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsTabs({
  settings,
  canEdit,
  isOwner,
  gateway,
}: {
  settings: All;
  canEdit: boolean;
  isOwner: boolean;
  gateway: GatewayInfo;
}) {
  return (
    <Tabs defaultValue="store">
      <TabsList className="flex-wrap">
        <TabsTrigger value="store">Store</TabsTrigger>
        <TabsTrigger value="invoice">Invoice</TabsTrigger>
        <TabsTrigger value="shipping">Shipping</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        {isOwner && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
      </TabsList>
      <TabsContent value="store">
        <StoreForm v={settings.store} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="invoice">
        <InvoiceForm v={settings.invoice} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="shipping">
        <ShippingSection v={settings.shipping} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="payments">
        <PaymentsForm v={settings.payments} canEdit={canEdit} />
        <GatewayCard g={gateway} />
      </TabsContent>
      <TabsContent value="inventory">
        <InventoryForm v={settings.inventory} canEdit={canEdit} />
      </TabsContent>
      {isOwner && (
        <TabsContent value="permissions">
          <PermissionsForm v={settings.permissions} />
        </TabsContent>
      )}
    </Tabs>
  );
}
