"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { DISTRICTS } from "@/lib/bd-geo";
import {
  PAYMENT_LABELS,
  addressSchema,
  contactSchema,
  type PaymentMethod,
  type Quote,
} from "@/lib/checkout";
import { formatPrice } from "@/lib/money";
import { formatPhone, normalisePhone } from "@/lib/phone";
import { useCart } from "./cart-store";
import { sizeLabel } from "@/lib/size";

/**
 * The checkout: contact (with phone verification by SMS code), delivery address, payment, and a
 * summary priced by the server. The browser only shows what /api/checkout/quote returns; placing
 * the order sends the total the customer saw, and the server refuses if it no longer matches.
 */

type Fields = {
  name: string;
  phone: string;
  email: string;
  district: string;
  area: string;
  street: string;
};
type Errors = Partial<Record<keyof Fields | "code" | "coupon" | "form", string>>;

const DRAFT_KEY = "zalfi.checkout.v1";
const FIELD_ORDER: (keyof Fields)[] = ["name", "phone", "email", "district", "area", "street"];

async function post<T>(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

function readDraft(verifiedPhone: string | null): Fields {
  const empty: Fields = { name: "", phone: "", email: "", district: "", area: "", street: "" };
  let draft: Partial<Fields> = {};
  try {
    if (typeof window !== "undefined") draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  } catch {
    /* storage blocked or corrupt */
  }
  const f = { ...empty };
  for (const k of FIELD_ORDER) if (typeof draft[k] === "string") f[k] = draft[k];
  if (verifiedPhone) f.phone = formatPhone(verifiedPhone);
  return f;
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}xxxxxxxx`;
}

export function CheckoutFlow({
  verifiedPhone,
  dhakaAreas,
}: {
  verifiedPhone: string | null;
  dhakaAreas: string[];
}) {
  const cart = useCart();
  const router = useRouter();
  const uid = useId();
  // The form appears only after the bag is read from this device, so the saved draft can be read
  // here without a hydration mismatch
  const [f, setF] = useState<Fields>(() => readDraft(verifiedPhone));
  const [errors, setErrors] = useState<Errors>({});
  const [verified, setVerified] = useState<string | null>(verifiedPhone);
  const [otp, setOtp] = useState<{ sentTo: string; devCode: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<"send" | "verify" | "place" | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    idempotencyKey.current = newKey();
  }, []);
  // Keep a draft of the details on this device, so a reload doesn't lose them
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    } catch {
      /* ignore */
    }
  }, [f]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const phone = normalisePhone(f.phone);
  const phoneVerified = !!phone && phone === verified;
  const isDhaka = f.district === "Dhaka";
  const items = useMemo(() => cart.lines.map((l) => ({ sku: l.sku, qty: l.qty })), [cart.lines]);

  // The server's price for the bag, address and coupon as they stand
  useEffect(() => {
    if (!cart.hydrated || !items.length) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            ...(f.district ? { district: f.district } : {}),
            ...(f.area.trim().length >= 2 ? { area: f.area } : {}),
            ...(coupon ? { coupon } : {}),
          }),
          signal: ctrl.signal,
        });
        const data = (await res.json()) as Quote & { error?: string };
        if (!res.ok) {
          setQuoteError(data.error ?? "We couldn't price your bag.");
          if (coupon) setErrors((e) => ({ ...e, coupon: data.error }));
          return;
        }
        setQuote(data);
        setQuoteError(null);
        setMethod((m) => (m && data.methods.includes(m) ? m : (data.methods[0] ?? null)));
        if (data.coupon && !data.coupon.ok)
          setErrors((e) => ({ ...e, coupon: (data.coupon as { message: string }).message }));
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setQuoteError("We couldn't reach checkout. Check your connection.");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cart.hydrated, items, f.district, f.area, coupon, verified, refresh]);

  const set = (k: keyof Fields) => (v: string) => {
    setF((p) => ({ ...p, [k]: v, ...(k === "district" ? { area: "" } : {}) }));
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  const sendCode = useCallback(async () => {
    const p = normalisePhone(f.phone);
    if (!p)
      return setErrors((e) => ({ ...e, phone: "Enter a Bangladeshi mobile number, 01XXXXXXXXX." }));
    setBusy("send");
    const r = await post<{ error?: string; devCode?: string | null; retryAfter?: number }>(
      "/api/checkout/otp",
      { action: "send", phone: p },
    ).catch(() => null);
    setBusy(null);
    if (!r) return setErrors((e) => ({ ...e, phone: "We couldn't send the code. Try again." }));
    if (!r.ok) {
      if (r.data.retryAfter) setCooldown(Math.min(r.data.retryAfter, 3600));
      return setErrors((e) => ({ ...e, phone: r.data.error }));
    }
    setOtp({ sentTo: p, devCode: r.data.devCode ?? null });
    setCode("");
    setCooldown(60);
    setErrors((e) => ({ ...e, phone: undefined, code: undefined }));
  }, [f.phone]);

  async function checkCode(value: string) {
    if (!otp || !/^\d{6}$/.test(value)) return;
    setBusy("verify");
    const r = await post<{ error?: string }>("/api/checkout/otp", {
      action: "verify",
      phone: otp.sentTo,
      code: value,
    }).catch(() => null);
    setBusy(null);
    if (!r || !r.ok) {
      setCode("");
      return setErrors((e) => ({ ...e, code: r?.data.error ?? "We couldn't check the code." }));
    }
    setVerified(otp.sentTo);
    setOtp(null);
    setErrors((e) => ({ ...e, code: undefined }));
  }

  function applyCoupon() {
    const c = couponInput.trim().toUpperCase();
    setErrors((e) => ({ ...e, coupon: undefined }));
    setCoupon(c || undefined);
  }

  async function place() {
    setNotice(null);
    const contact = contactSchema.safeParse(f);
    const address = addressSchema.safeParse(f);
    const next: Errors = {};
    for (const issue of [...(contact.error?.issues ?? []), ...(address.error?.issues ?? [])]) {
      const k = issue.path[0] as keyof Fields;
      next[k] ??= issue.message;
    }
    if (!next.phone && !phoneVerified) next.phone = "Verify your number with the code we text you.";
    if (!method) next.form = "No payment method is open right now.";
    if (Object.keys(next).length) {
      setErrors(next);
      const first = FIELD_ORDER.find((k) => next[k]);
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    if (!quote || quote.unavailable.length || quote.lines.some((l) => l.qty > l.available)) {
      return setErrors({ form: "Adjust your bag first: something has sold out." });
    }
    setBusy("place");
    const r = await post<{ error?: string; total?: number; next?: string }>("/api/checkout/place", {
      name: f.name,
      phone: phone,
      email: f.email,
      district: f.district,
      area: f.area,
      street: f.street,
      items,
      ...(coupon && quote.coupon?.ok ? { coupon } : {}),
      paymentMethod: method,
      expectedTotal: quote.total,
      idempotencyKey: idempotencyKey.current,
    }).catch(() => null);
    if (!r) {
      setBusy(null);
      return setErrors({
        form: "We couldn't reach checkout. Your order wasn't placed. Try again.",
      });
    }
    if (r.ok && r.data.next) {
      cart.clear();
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      // Online payment leaves for the provider's page; everything else stays on the site
      if (/^https?:\/\//.test(r.data.next)) window.location.assign(r.data.next);
      else router.push(r.data.next);
      return;
    }
    setBusy(null);
    if (r.status === 409 && typeof r.data.total === "number") {
      setQuote((q) => (q ? { ...q, total: r.data.total! } : q));
      setNotice(r.data.error ?? "Your total has changed.");
      setRefresh((n) => n + 1);
      idempotencyKey.current = newKey();
      return;
    }
    setErrors({ form: r.data.error ?? "Your order wasn't placed. Try again." });
  }

  if (!cart.hydrated) return <div className="min-h-[60svh]" aria-busy="true" />;
  if (!cart.lines.length)
    return (
      <div className="border-noir/15 col-span-12 border-t pt-8 md:col-span-6 md:col-start-7">
        <p className="font-display text-3xl">Your bag is empty.</p>
        <Link href="/#collection" className="eyebrow border-noir mt-6 inline-block border-b pb-1">
          Discover the collection
        </Link>
      </div>
    );

  const lineState = (sku: string) => quote?.lines.find((l) => l.sku === sku);
  const closed = quote && !quote.methods.length;

  return (
    <>
      <form
        noValidate
        className="col-span-12 md:col-span-6"
        onSubmit={(e) => {
          e.preventDefault();
          void place();
        }}
        aria-describedby={errors.form ? `${uid}-form` : undefined}
      >
        <Section n="01" title="Contact">
          <Field id={`${uid}-name`} label="Full name" error={errors.name}>
            <input
              id={`${uid}-name`}
              autoComplete="name"
              value={f.name}
              onChange={(e) => set("name")(e.target.value)}
              className={inputCls}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? `${uid}-name-err` : undefined}
            />
          </Field>
          <Field
            id={`${uid}-phone`}
            label="Mobile number"
            error={errors.phone}
            hint={phoneVerified ? undefined : "We text a 6-digit code to confirm it."}
            aside={
              phoneVerified ? (
                <span className="eyebrow pb-4" aria-live="polite">
                  Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy === "send" || cooldown > 0}
                  className="eyebrow shrink-0 pb-4 disabled:opacity-40"
                >
                  {busy === "send"
                    ? "Sending"
                    : cooldown > 0 && otp
                      ? `Resend in ${cooldown}s`
                      : otp
                        ? "Resend"
                        : "Send code"}
                </button>
              )
            }
          >
            <input
              id={`${uid}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="01XXXXXXXXX"
              value={f.phone}
              onChange={(e) => {
                set("phone")(e.target.value);
                setOtp(null);
              }}
              className={inputCls}
              aria-invalid={!!errors.phone}
              aria-describedby={`${uid}-phone-hint${errors.phone ? ` ${uid}-phone-err` : ""}`}
            />
          </Field>
          {otp && !phoneVerified && (
            <Field
              id={`${uid}-code`}
              label={`Code sent to ${formatPhone(otp.sentTo)}`}
              error={errors.code}
              hint={
                otp.devCode ? `Development: the code is ${otp.devCode}` : "It expires in 5 minutes."
              }
            >
              <input
                id={`${uid}-code`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                disabled={busy === "verify"}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  setErrors((er) => ({ ...er, code: undefined }));
                  if (v.length === 6) void checkCode(v);
                }}
                className={`${inputCls} font-display tracking-[0.4em]`}
                aria-invalid={!!errors.code}
                aria-describedby={`${uid}-code-hint${errors.code ? ` ${uid}-code-err` : ""}`}
              />
            </Field>
          )}
          <Field id={`${uid}-email`} label="Email, for your receipt" error={errors.email}>
            <input
              id={`${uid}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => set("email")(e.target.value)}
              className={inputCls}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? `${uid}-email-err` : undefined}
            />
          </Field>
        </Section>

        <Section n="02" title="Delivery">
          <Field id={`${uid}-district`} label="District" error={errors.district} select>
            <select
              id={`${uid}-district`}
              autoComplete="address-level1"
              value={f.district}
              onChange={(e) => set("district")(e.target.value)}
              className={selectCls}
              aria-invalid={!!errors.district}
              aria-describedby={errors.district ? `${uid}-district-err` : undefined}
            >
              <option value="">Choose a district</option>
              {[...DISTRICTS].sort().map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field id={`${uid}-area`} label="Area or thana" error={errors.area} select={isDhaka}>
            {isDhaka ? (
              <select
                id={`${uid}-area`}
                autoComplete="address-level2"
                value={f.area}
                onChange={(e) => set("area")(e.target.value)}
                className={selectCls}
                aria-invalid={!!errors.area}
                aria-describedby={errors.area ? `${uid}-area-err` : undefined}
              >
                <option value="">Choose an area</option>
                {dhakaAreas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            ) : (
              <input
                id={`${uid}-area`}
                autoComplete="address-level2"
                value={f.area}
                onChange={(e) => set("area")(e.target.value)}
                className={inputCls}
                aria-invalid={!!errors.area}
                aria-describedby={errors.area ? `${uid}-area-err` : undefined}
              />
            )}
          </Field>
          <Field id={`${uid}-street`} label="House, road and street" error={errors.street}>
            <textarea
              id={`${uid}-street`}
              rows={2}
              autoComplete="street-address"
              value={f.street}
              onChange={(e) => set("street")(e.target.value)}
              className={`${inputCls} resize-none`}
              aria-invalid={!!errors.street}
              aria-describedby={errors.street ? `${uid}-street-err` : undefined}
            />
          </Field>
        </Section>

        <Section n="03" title="Payment">
          {closed ? (
            <p className="text-smoke">Checkout is closed for a moment. Your bag is saved.</p>
          ) : (
            <fieldset>
              <legend className="sr-only">Payment method</legend>
              <div className="divide-noir/10 border-noir/15 divide-y border-y">
                {(quote?.methods ?? []).map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-4 py-5">
                    <input
                      type="radio"
                      name={`${uid}-method`}
                      value={m}
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="border-noir/40 checked:border-noir checked:bg-noir size-4 shrink-0 appearance-none rounded-full border checked:shadow-[inset_0_0_0_3px_var(--color-bone)]"
                    />
                    <span className="flex flex-1 flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                      <span className="font-display text-2xl">{PAYMENT_LABELS[m]}</span>
                      <span className="text-smoke text-sm">
                        {m === "cod"
                          ? "Pay the courier in cash"
                          : m === "manual"
                            ? "Send it yourself, then give us the transaction ID"
                            : "Card, bKash, Nagad, Rocket"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </Section>
      </form>

      <aside
        aria-labelledby={`${uid}-summary`}
        className="col-span-12 md:sticky md:top-28 md:col-span-5 md:col-start-8 md:self-start"
      >
        <div className="border-noir/15 border-t pt-8">
          <h2 id={`${uid}-summary`} className="eyebrow text-smoke">
            Order summary
          </h2>
          <ul className="divide-noir/10 mt-6 divide-y">
            {cart.lines.map((l) => {
              const q = lineState(l.sku);
              const soldOut = quote?.unavailable.includes(l.sku);
              const short = q && !soldOut && q.qty > q.available;
              return (
                <li key={l.sku} className="grid grid-cols-[4rem_1fr_auto] items-center gap-5 py-5">
                  <div className="relative aspect-square">
                    <Image
                      src={l.bottleImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-display text-2xl leading-none">{l.name}</p>
                    <p className="text-smoke mt-1 text-sm">
                      {sizeLabel(l.sizeMl, l.pieces)} × {l.qty}
                    </p>
                    {(soldOut || short) && (
                      <p className="text-alert mt-2 text-sm">
                        {soldOut ? "Sold out. " : `Only ${q!.available} left. `}
                        <button
                          type="button"
                          className="underline underline-offset-4"
                          onClick={() =>
                            soldOut ? cart.remove(l.sku) : cart.setQty(l.sku, q!.available)
                          }
                        >
                          {soldOut ? "Remove" : `Take ${q!.available}`}
                        </button>
                      </p>
                    )}
                  </div>
                  <p className="tabular-nums">
                    {formatPrice(q?.lineTotal ?? l.pricePoisha * l.qty)}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="border-noir/15 mt-2 border-t pt-6">
            <label htmlFor={`${uid}-coupon`} className="eyebrow text-smoke">
              Gift or promo code
            </label>
            <div className="border-noir/20 focus-within:border-noir mt-2 flex items-end gap-4 border-b">
              <input
                id={`${uid}-coupon`}
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value);
                  setErrors((er) => ({ ...er, coupon: undefined }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                autoCapitalize="characters"
                spellCheck={false}
                className={`${inputCls} uppercase`}
                aria-invalid={!!errors.coupon}
                aria-describedby={`${uid}-coupon-msg`}
              />
              <button type="button" onClick={applyCoupon} className="eyebrow shrink-0 pb-4">
                Apply
              </button>
            </div>
            <p id={`${uid}-coupon-msg`} aria-live="polite" className="mt-2 min-h-5 text-sm">
              {errors.coupon ? (
                <span className="text-alert">{errors.coupon}</span>
              ) : quote?.coupon?.ok ? (
                <span className="text-smoke">
                  {quote.coupon.code} applied.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    onClick={() => {
                      setCoupon(undefined);
                      setCouponInput("");
                    }}
                  >
                    Remove
                  </button>
                </span>
              ) : (
                ""
              )}
            </p>
          </div>

          <dl className="mt-4 space-y-2 text-sm" aria-live="polite">
            <Row label="Subtotal" value={quote ? formatPrice(quote.subtotal) : "…"} />
            {!!quote?.discount && <Row label="Discount" value={formatPrice(-quote.discount)} />}
            <Row
              label={
                quote?.zone === "inside_dhaka"
                  ? "Shipping, inside Dhaka"
                  : quote?.zone === "outside_dhaka"
                    ? "Shipping, outside Dhaka"
                    : "Shipping"
              }
              value={
                !quote?.zone
                  ? "Add your address"
                  : quote.shippingFee
                    ? formatPrice(quote.shippingFee)
                    : "Free"
              }
            />
          </dl>
          <div className="border-noir/15 mt-6 flex items-baseline justify-between border-t pt-6">
            <span className="eyebrow">Total</span>
            <span className="font-display text-4xl tabular-nums">
              {quote ? formatPrice(quote.total) : "…"}
            </span>
          </div>
          {quoteError && <p className="text-alert mt-3 text-sm">{quoteError}</p>}

          <div className="mt-8">
            <PlaceButton
              busy={busy === "place"}
              total={quote?.total}
              disabled={!!closed}
              onClick={() => void place()}
            />
            <p id={`${uid}-form`} role="alert" className="text-alert mt-4 min-h-5 text-sm">
              {errors.form ?? notice ?? ""}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

const inputCls = "w-full bg-transparent py-3 text-lg placeholder:text-noir/25 focus:outline-none";
const selectCls = "w-full appearance-none bg-transparent py-3 pr-8 text-lg focus:outline-none";

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="border-noir/15 mt-14 border-t pt-8 first:mt-0">
      <h2 className="flex items-baseline gap-4">
        <span className="eyebrow text-smoke">{n}</span>
        <span className="display-italic text-4xl">{title}</span>
      </h2>
      <div className="mt-8 space-y-8">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  aside,
  select,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  aside?: ReactNode;
  select?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow text-smoke">
        {label}
      </label>
      <div
        className={`mt-2 flex items-end gap-4 border-b ${error ? "border-alert" : "border-noir/20 focus-within:border-noir"} relative`}
      >
        {children}
        {select && (
          <svg
            aria-hidden
            viewBox="0 0 12 8"
            className="pointer-events-none absolute right-1 bottom-5 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path d="M1 1.5l5 5 5-5" />
          </svg>
        )}
        {aside}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-smoke mt-2 text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-alert mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-smoke">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function PlaceButton({
  busy,
  total,
  disabled,
  onClick,
}: {
  busy: boolean;
  total?: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={busy || disabled}
      data-cursor="Place"
      className="eyebrow bg-noir text-bone w-full py-5 transition-opacity disabled:opacity-60"
    >
      {busy
        ? "Placing your order"
        : total !== undefined
          ? `Place order · ${formatPrice(total)}`
          : "Place order"}
    </button>
  );
}
