import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockNotice, mockProvider } from "@/server/payments/mock";
import { mockAllowed, resolveGateway } from "@/server/payments/providers";
import { refundable, statusAfterRefunds } from "@/server/payments/refunds";
import {
  mismatch,
  parseNotice,
  parseRefund,
  parseSession,
  parseValidation,
  sessionForm,
  sslcommerz,
  verifySign,
} from "@/server/payments/sslcommerz";
import { fromTaka, toTaka, type SessionInput } from "@/server/payments/types";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const PW = "zalfi68f1a2b3c@ssl";
const cfg = { storeId: "zalfi68f1a2b3c", storePassword: PW, live: false };

/** A validation API answer, as SSLCommerz documents it (sandbox, a bKash payment) */
const VALIDATION = {
  status: "VALID",
  tran_date: "2026-10-04 12:10:45",
  tran_id: "ZLF-001046-7KQ2M",
  val_id: "2610041210451IoIKtgeBNtUWbE",
  amount: "4570.00",
  store_amount: "4455.75",
  currency: "BDT",
  bank_tran_id: "261004121045VlAl9kNzx8xIxOM",
  card_type: "BKASH-BKash",
  card_no: "",
  card_issuer: "BKash Mobile Banking",
  card_brand: "MOBILEBANKING",
  card_issuer_country: "Bangladesh",
  card_issuer_country_code: "BD",
  currency_type: "BDT",
  currency_amount: "4570.00",
  currency_rate: "1.0000",
  base_fair: "0.00",
  value_a: "ZLF-001046",
  risk_title: "Safe",
  risk_level: "0",
  APIConnect: "DONE",
  validated_on: "2026-10-04 12:11:02",
  gw_version: "",
};

const SESSION: SessionInput = {
  tranId: "ZLF-001046-7KQ2M",
  amount: 457_000,
  orderNumber: "ZLF-001046",
  customer: {
    name: "Nusrat Jahan",
    email: "nusrat@example.com",
    phone: "01712345678",
    address: "House 12, Road 5, Dhanmondi",
    district: "Dhaka",
  },
  items: [
    { name: "Reva", qty: 1 },
    { name: "Oudor", qty: 2 },
  ],
  urls: {
    success: "https://zalfi.com/api/payments/return/sslcommerz?outcome=success",
    fail: "https://zalfi.com/api/payments/return/sslcommerz?outcome=fail",
    cancel: "https://zalfi.com/api/payments/return/sslcommerz?outcome=cancel",
    ipn: "https://zalfi.com/api/payments/ipn/sslcommerz",
  },
};

describe("amounts", () => {
  it("converts poisha to the provider's taka and back", () => {
    expect(toTaka(457_000)).toBe("4570.00");
    expect(toTaka(12_550)).toBe("125.50");
    expect(fromTaka("4570.00")).toBe(457_000);
    expect(fromTaka("125.5")).toBe(12_550);
    expect(Number.isNaN(fromTaka("abc"))).toBe(true);
  });
});

describe("SSLCommerz session", () => {
  it("sends the order in BDT with every required field", () => {
    const f = sessionForm(cfg, SESSION);
    expect(f).toMatchObject({
      store_id: cfg.storeId,
      total_amount: "4570.00",
      currency: "BDT",
      tran_id: "ZLF-001046-7KQ2M",
      cus_name: "Nusrat Jahan",
      cus_phone: "01712345678",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      num_of_item: "3",
      product_name: "Reva, Oudor x2",
      product_profile: "physical-goods",
      ipn_url: SESSION.urls.ipn,
      value_a: "ZLF-001046",
    });
  });

  it("reads the payment page URL, or the reason it failed", () => {
    expect(
      parseSession({
        status: "SUCCESS",
        sessionkey: "F650E87F5B6F2B4D4A0E6A",
        GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/testcde650e87f5b6f2b4d4a0e6a",
      }),
    ).toEqual({
      ok: true,
      url: "https://sandbox.sslcommerz.com/EasyCheckOut/testcde650e87f5b6f2b4d4a0e6a",
    });
    expect(
      parseSession({
        status: "FAILED",
        failedreason: "Store Credential Error Or Store is De-active",
      }),
    ).toEqual({ ok: false, error: "Store Credential Error Or Store is De-active" });
  });

  it("posts the form to the sandbox and never keeps the password", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        status: "SUCCESS",
        GatewayPageURL: "https://sandbox.sslcommerz.com/x",
        store_passwd: PW,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const s = await sslcommerz(cfg).createSession(SESSION);
    expect(s.url).toBe("https://sandbox.sslcommerz.com/x");
    expect(JSON.stringify(s.raw)).not.toContain(PW);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox.sslcommerz.com/gwprocess/v4/api.php");
    expect((init.body as URLSearchParams).get("total_amount")).toBe("4570.00");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SSLCommerz notices", () => {
  const ipn = {
    tran_id: "ZLF-001046-7KQ2M",
    val_id: VALIDATION.val_id,
    amount: "4570.00",
    status: "VALID",
    currency: "BDT",
    store_id: cfg.storeId,
    verify_key: "amount,currency,status,store_id,tran_id,val_id,value_b",
  };
  // The documented algorithm, written out by hand: the listed fields that are present, plus
  // md5(store password), sorted by name, joined k=v&k=v, then md5
  const expected = md5(
    `amount=4570.00&currency=BDT&status=VALID&store_id=${cfg.storeId}&store_passwd=${md5(PW)}&tran_id=ZLF-001046-7KQ2M&val_id=${VALIDATION.val_id}`,
  );
  const signed = { ...ipn, verify_sign: expected };

  it("checks the signature", () => {
    expect(verifySign(signed, PW)).toBe(true);
    expect(verifySign({ ...signed, amount: "1.00" }, PW)).toBe(false);
    expect(verifySign(signed, "wrong-password")).toBe(false);
    expect(verifySign(ipn, PW)).toBe(false);
  });

  it("reads the status and IDs", () => {
    expect(parseNotice(signed, PW)).toEqual({
      tranId: "ZLF-001046-7KQ2M",
      valId: VALIDATION.val_id,
      status: "valid",
      authentic: true,
    });
    expect(parseNotice({ tran_id: "x", status: "CANCELLED" }, PW)).toMatchObject({
      status: "cancelled",
      authentic: false,
      valId: null,
    });
    expect(parseNotice({ tran_id: "x", status: "UNATTEMPTED" }, PW).status).toBe("unattempted");
  });
});

describe("SSLCommerz validation", () => {
  const expected = { tranId: "ZLF-001046-7KQ2M", amount: 457_000 };

  it("accepts a payment only when status, transaction, currency and amount all match", () => {
    const v = parseValidation(VALIDATION);
    expect(v).toMatchObject({
      valid: true,
      amount: 457_000,
      currency: "BDT",
      method: "BKASH-BKash",
      bankTranId: VALIDATION.bank_tran_id,
      risky: false,
    });
    expect(mismatch(v, expected)).toBeNull();
    // A repeat validation says VALIDATED: still a real payment
    expect(mismatch(parseValidation({ ...VALIDATION, status: "VALIDATED" }), expected)).toBeNull();
  });

  it("names what doesn't match", () => {
    expect(
      mismatch(parseValidation({ ...VALIDATION, status: "INVALID_TRANSACTION" }), expected),
    ).toMatch(/INVALID_TRANSACTION/);
    expect(
      mismatch(
        parseValidation({ ...VALIDATION, amount: "10.00", currency_amount: "10.00" }),
        expected,
      ),
    ).toBe("amount 10.00 isn't 4570.00");
    expect(
      mismatch(
        parseValidation({ ...VALIDATION, currency_type: "USD", currency_amount: "38.50" }),
        expected,
      ),
    ).toMatch(/currency USD/);
    expect(
      mismatch(parseValidation({ ...VALIDATION, tran_id: "ZLF-009999-AAAAA" }), expected),
    ).toMatch(/transaction/);
    expect(mismatch(parseValidation({}), expected)).toMatch(/no such payment/);
  });

  it("flags risky payments", () => {
    const v = parseValidation({ ...VALIDATION, risk_level: "1", risk_title: "Risky" });
    expect(v).toMatchObject({ risky: true, riskTitle: "Risky" });
  });
});

describe("SSLCommerz refunds", () => {
  it("maps the refund answers", () => {
    expect(
      parseRefund({
        APIConnect: "DONE",
        bank_tran_id: VALIDATION.bank_tran_id,
        trans_id: "ZLF-001046-7KQ2M",
        refund_ref_id: "5f2c1e7b9a3d4",
        status: "success",
        errorReason: "",
      }),
    ).toMatchObject({ status: "pending", providerRef: "5f2c1e7b9a3d4", error: null });
    expect(parseRefund({ APIConnect: "DONE", status: "refunded", refund_ref_id: "r" }).status).toBe(
      "completed",
    );
    expect(parseRefund({ APIConnect: "DONE", status: "processing" }).status).toBe("pending");
    expect(
      parseRefund({ APIConnect: "DONE", status: "failed", errorReason: "Refund amount exceeds" }),
    ).toMatchObject({ status: "failed", error: "Refund amount exceeds" });
    expect(parseRefund({ APIConnect: "INVALID_REQUEST" })).toMatchObject({
      status: "failed",
      error: "SSLCommerz: INVALID_REQUEST",
    });
  });

  it("asks with the bank transaction and the amount in taka", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ APIConnect: "DONE", status: "success", refund_ref_id: "r1" }),
    );
    vi.stubGlobal("fetch", fetch);
    const r = await sslcommerz(cfg).refund({
      tranId: "ZLF-001046-7KQ2M",
      bankTranId: VALIDATION.bank_tran_id,
      amount: 228_500,
      reason: "Damaged in transit",
      refundKey: "R7-ZLF-001046",
    });
    expect(r.status).toBe("pending");
    const url = new URL(String((fetch.mock.calls[0] as unknown as [string])[0]));
    expect(url.pathname).toBe("/validator/api/merchantTransIDvalidationAPI.php");
    expect(url.searchParams.get("refund_amount")).toBe("2285.00");
    expect(url.searchParams.get("bank_tran_id")).toBe(VALIDATION.bank_tran_id);
    expect(url.searchParams.get("refe_id")).toBe("R7-ZLF-001046");
  });
});

describe("test gateway", () => {
  it("signs its notices, and refuses forged ones", () => {
    const n = mockNotice("ZLF-001046-7KQ2M", 457_000, "success");
    expect(mockProvider.handleIpn(n)).toMatchObject({ status: "valid", authentic: true });
    expect(mockProvider.handleIpn({ ...n, status: "FAILED" }).authentic).toBe(false);
    expect(mockProvider.handleIpn(mockNotice("t", 1, "cancel"))).toMatchObject({
      status: "cancelled",
      authentic: true,
    });
  });

  it("validates only what it signed, at the amount it signed", async () => {
    const ok = await mockProvider.validate(mockNotice("T-1", 457_000, "success").val_id);
    expect(ok).toMatchObject({ valid: true, tranId: "T-1", amount: 457_000, currency: "BDT" });
    const wrong = await mockProvider.validate(mockNotice("T-1", 457_000, "wrong-amount").val_id);
    expect(mismatch(wrong, { tranId: "T-1", amount: 457_000 })).toMatch(/amount/);
    const forged = await mockProvider.validate("mock.T-1.1.deadbeef");
    expect(forged.valid).toBe(false);
  });
});

describe("choosing the gateway", () => {
  it("never uses the test gateway on the live site", () => {
    expect(mockAllowed()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(mockAllowed()).toBe(false);
    expect(resolveGateway("mock").provider).toBeNull();
  });

  it("uses SSLCommerz only with its keys, sandbox unless told live", () => {
    vi.stubEnv("SSLCOMMERZ_STORE_ID", "");
    vi.stubEnv("SSLCOMMERZ_STORE_PASSWORD", "");
    expect(resolveGateway("sslcommerz").provider?.name).toBe("mock");
    vi.stubEnv("SSLCOMMERZ_STORE_ID", "store");
    vi.stubEnv("SSLCOMMERZ_STORE_PASSWORD", "secret");
    expect(resolveGateway("sslcommerz").provider).toMatchObject({
      name: "sslcommerz",
      mode: "sandbox",
    });
    vi.stubEnv("SSLCOMMERZ_IS_LIVE", "true");
    expect(resolveGateway("sslcommerz").provider?.mode).toBe("live");
  });
});

describe("refund amounts", () => {
  const online = { paymentMethod: "sslcommerz", paymentStatus: "paid", total: 457_000 };
  it("counts what was paid, refunded and processing", () => {
    expect(
      refundable(
        online,
        [
          { amount: 457_000, status: "paid", provider: "sslcommerz" },
          { amount: 457_000, status: "failed", provider: "sslcommerz" },
        ],
        [
          { amount: 100_000, status: "completed" },
          { amount: 50_000, status: "pending" },
          { amount: 20_000, status: "failed" },
        ],
      ),
    ).toEqual({ paid: 457_000, completed: 100_000, pending: 50_000, left: 307_000 });
  });

  it("counts cash on delivery once it was collected", () => {
    expect(
      refundable({ ...online, paymentMethod: "cod", paymentStatus: "unpaid" }, [], []).paid,
    ).toBe(0);
    expect(refundable({ ...online, paymentMethod: "cod" }, [], []).paid).toBe(457_000);
  });

  it("sets the payment status from completed refunds", () => {
    expect(statusAfterRefunds(457_000, 0)).toBe("paid");
    expect(statusAfterRefunds(457_000, 1)).toBe("partially_refunded");
    expect(statusAfterRefunds(457_000, 457_000)).toBe("refunded");
    expect(statusAfterRefunds(0, 0)).toBeNull();
  });
});
