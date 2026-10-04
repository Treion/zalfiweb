/**
 * Every provider the admin can set up (Admin → Integrations): what it needs, where each value is
 * found in that provider's own panel, and which environment variables it falls back to. The pages,
 * the save action and each provider's config all read from here, so a field is described once.
 */
/** SMS gateways and email services, in the order they are tried until the owner changes it */
export const SMS_PROVIDERS = ["bulksmsbd", "sslwireless", "alphasms", "mimsms"] as const;
export const EMAIL_PROVIDERS = ["resend", "brevo", "postmark", "smtp"] as const;
export type SmsName = (typeof SMS_PROVIDERS)[number];
export type EmailName = (typeof EMAIL_PROVIDERS)[number];

/** A saved order, made whole: repeats dropped, providers missing from it added at the end */
export function inOrder<T extends string>(saved: readonly T[], all: readonly T[]): T[] {
  const kept = [...new Set(saved)].filter((n) => all.includes(n));
  return [...kept, ...all.filter((n) => !kept.includes(n))];
}

export const INTEGRATIONS = [
  "sslcommerz",
  "aamarpay",
  "test-gateway",
  "pathao",
  "steadfast",
  "redx",
  "carrybee",
  "test-courier",
  ...SMS_PROVIDERS,
  ...EMAIL_PROVIDERS,
] as const;
export type IntegrationName = (typeof INTEGRATIONS)[number];

export type Mode = "sandbox" | "live";

export type Field = {
  key: string;
  label: string;
  /** Sealed in the database, never shown again (only its last four characters) */
  secret?: boolean;
  /** Needed before the provider can be switched on */
  required?: boolean;
  /** Where to find it, in the provider's own words where possible */
  help: string;
  placeholder?: string;
  /** The environment variable it falls back to (none for providers added after the admin) */
  env?: string;
  /** Picked from a list the connection test fetches (Pathao and RedX stores) */
  pick?: "stores";
};

export type IntegrationDef = {
  name: IntegrationName;
  label: string;
  group: "payments" | "couriers" | "sms" | "email";
  /** One line on the card */
  blurb: string;
  /** Empty: live only (the provider has no sandbox) */
  modes: Mode[];
  /** "true" in this variable means live, for set-ups that still come from the environment */
  modeEnv?: string;
  fields: Field[];
  /**
   * Where the provider posts its updates. `token` is a secret we generate (or the environment
   * gives): `inUrl` puts it in the address, otherwise the provider sends it in a header.
   */
  webhook?: { path: string; tokenEnv?: string; inUrl?: boolean; tokenLabel?: string; how: string };
  /** Set-up, step by step */
  steps: string[];
  /** The provider's public sandbox account, from its own docs */
  sandboxValues?: Record<string, string>;
  /** Test providers exist only on a computer or a preview, never on the live site */
  testOnly?: boolean;
};

export const CATALOG: Record<IntegrationName, IntegrationDef> = {
  sslcommerz: {
    name: "sslcommerz",
    label: "SSLCommerz",
    group: "payments",
    blurb: "Cards, bKash, Nagad, Rocket and internet banking.",
    modes: ["sandbox", "live"],
    modeEnv: "SSLCOMMERZ_IS_LIVE",
    fields: [
      {
        key: "storeId",
        label: "Store ID",
        required: true,
        env: "SSLCOMMERZ_STORE_ID",
        help: "In the email SSLCommerz sent when your store was approved, or the merchant panel → My Stores. A sandbox store comes from developer.sslcommerz.com/registration.",
        placeholder: "zalfi6512a…",
      },
      {
        key: "storePassword",
        label: "Store password",
        secret: true,
        required: true,
        env: "SSLCOMMERZ_STORE_PASSWORD",
        help: "The API password (store_passwd) in the same email. It is not your panel login password.",
      },
    ],
    webhook: {
      path: "/api/payments/ipn/sslcommerz",
      how: "The site sends this address with every payment. Paste it in the panel too (My Stores → IPN Settings), so a payment is confirmed even if the customer closes the page.",
    },
    steps: [
      "Choose Sandbox to try it with test cards, or Live for real payments.",
      "Enter the Store ID and Store password from SSLCommerz.",
      "Press Test connection. It opens a payment page and closes it: no money moves.",
      "Paste the IPN address into your SSLCommerz panel.",
      "Switch it on.",
    ],
  },
  aamarpay: {
    name: "aamarpay",
    label: "aamarPay",
    group: "payments",
    blurb: "Cards, bKash, Nagad, Rocket, Upay and internet banking.",
    modes: ["sandbox", "live"],
    modeEnv: "AAMARPAY_IS_LIVE",
    fields: [
      {
        key: "storeId",
        label: "Store ID",
        required: true,
        env: "AAMARPAY_STORE_ID",
        help: "Sent by aamarPay when your merchant account is approved (merchant.aamarpay.com). The sandbox store is aamarpaytest.",
      },
      {
        key: "signatureKey",
        label: "Signature key",
        secret: true,
        required: true,
        env: "AAMARPAY_SIGNATURE_KEY",
        help: "Sent with your Store ID. aamarPay's public sandbox key is in their docs, and the button below fills it in.",
      },
    ],
    webhook: {
      path: "/api/payments/ipn/aamarpay",
      how: "Optional: ask aamarPay to set this as your IPN address. Payments are confirmed either way, because the site checks each one with aamarPay before marking it paid.",
    },
    steps: [
      "Choose Sandbox to try it, or Live for real payments.",
      "Enter the Store ID and Signature key from aamarPay (or use the public sandbox store).",
      "Press Test connection. It opens a payment page and closes it: no money moves.",
      "Switch it on.",
      "aamarPay has no refund API: refunds are made in the aamarPay merchant panel, then recorded here.",
    ],
    sandboxValues: { storeId: "aamarpaytest", signatureKey: "dbb74894e82415a2f7ff0ec3a97e4183" },
  },
  "test-gateway": {
    name: "test-gateway",
    label: "Test gateway",
    group: "payments",
    blurb: "Pretend payments for trying the shop. Never runs on the live site.",
    modes: [],
    fields: [],
    steps: ["Nothing to set up. It is used only when no real gateway is on (or both fail)."],
    testOnly: true,
  },
  pathao: {
    name: "pathao",
    label: "Pathao",
    group: "couriers",
    blurb: "Pickups and delivery across all 64 districts.",
    modes: ["sandbox", "live"],
    modeEnv: "PATHAO_IS_LIVE",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        required: true,
        env: "PATHAO_CLIENT_ID",
        help: "Pathao merchant panel → Developer's API → Merchant API Credentials.",
      },
      {
        key: "clientSecret",
        label: "Client secret",
        secret: true,
        required: true,
        env: "PATHAO_CLIENT_SECRET",
        help: "On the same page as the Client ID.",
      },
      {
        key: "username",
        label: "Login email",
        required: true,
        env: "PATHAO_USERNAME",
        help: "The email you sign in to the Pathao merchant panel with.",
      },
      {
        key: "password",
        label: "Login password",
        secret: true,
        required: true,
        env: "PATHAO_PASSWORD",
        help: "Your Pathao merchant panel password. If someone changes it there, change it here too.",
      },
      {
        key: "storeId",
        label: "Pickup store",
        required: true,
        env: "PATHAO_STORE_ID",
        pick: "stores",
        help: "Where Pathao collects parcels. Press Test connection to choose from your stores.",
      },
      {
        key: "integrationSecret",
        label: "Webhook integration secret",
        secret: true,
        env: "PATHAO_WEBHOOK_INTEGRATION_SECRET",
        help: "Pathao shows it when you add the webhook (Developer's API → Webhook). The site sends it back, which is how Pathao knows the address is yours.",
      },
    ],
    webhook: {
      path: "/api/couriers/webhook/pathao",
      tokenEnv: "PATHAO_WEBHOOK_SECRET",
      tokenLabel: "Webhook secret",
      how: "In Pathao's panel → Developer's API → Webhook: paste the address as the Callback URL and the secret as the Webhook Secret, and tick the order events. Then copy Pathao's integration secret into the field above.",
    },
    steps: [
      "Choose Sandbox to try it, or Live for real parcels.",
      "Enter the Client ID and secret, and your Pathao login email and password.",
      "Press Test connection, then choose your pickup store.",
      "Add the webhook in Pathao's panel with the address and secret below.",
      "Switch it on.",
    ],
    // Pathao's public sandbox account (courier-api-sandbox.pathao.com), from its developer docs
    sandboxValues: {
      clientId: "7N1aMJQbWm",
      clientSecret: "wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39",
      username: "test@pathao.com",
      password: "lovePathao",
    },
  },
  steadfast: {
    name: "steadfast",
    label: "Steadfast",
    group: "couriers",
    blurb: "Pickups and delivery nationwide. No sandbox: every parcel is real.",
    modes: [],
    fields: [
      {
        key: "apiKey",
        label: "API key",
        required: true,
        env: "STEADFAST_API_KEY",
        help: "Steadfast panel (portal.packzy.com) → API → API Key.",
      },
      {
        key: "secretKey",
        label: "Secret key",
        secret: true,
        required: true,
        env: "STEADFAST_SECRET_KEY",
        help: "On the same page as the API key.",
      },
    ],
    webhook: {
      path: "/api/couriers/webhook/steadfast",
      tokenEnv: "STEADFAST_WEBHOOK_TOKEN",
      tokenLabel: "Auth token (Bearer)",
      how: "In Steadfast's panel → API → Webhook: paste the address as the Callback URL and the token as the Auth Token.",
    },
    steps: [
      "Enter the API key and Secret key from Steadfast.",
      "Press Test connection: it reads your Steadfast balance.",
      "Add the webhook in Steadfast's panel with the address and token below.",
      "Switch it on.",
    ],
  },
  redx: {
    name: "redx",
    label: "RedX",
    group: "couriers",
    blurb: "Pickups and delivery nationwide, with cash collection.",
    modes: ["sandbox", "live"],
    modeEnv: "REDX_IS_LIVE",
    fields: [
      {
        key: "accessToken",
        label: "API access token",
        secret: true,
        required: true,
        env: "REDX_ACCESS_TOKEN",
        help: "RedX merchant panel → Developer API → generate the token. A sandbox token comes from RedX support.",
      },
      {
        key: "pickupStoreId",
        label: "Pickup store",
        required: true,
        env: "REDX_PICKUP_STORE_ID",
        pick: "stores",
        help: "Where RedX collects parcels. Press Test connection to choose from your pickup stores.",
      },
    ],
    webhook: {
      path: "/api/couriers/webhook/redx",
      tokenEnv: "REDX_WEBHOOK_TOKEN",
      inUrl: true,
      how: "In RedX's panel → Developer API, paste this whole address as the Callback URL (or send it to RedX support). The token in it is how the site knows the update is from RedX.",
    },
    steps: [
      "Choose Sandbox to try it, or Live for real parcels.",
      "Enter the API access token from RedX.",
      "Press Test connection, then choose your pickup store.",
      "Give RedX the callback address below.",
      "Switch it on.",
    ],
  },
  carrybee: {
    name: "carrybee",
    label: "CarryBee",
    group: "couriers",
    blurb: "Pickups and delivery across all 64 districts, with cash collection.",
    modes: ["sandbox", "live"],
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        required: true,
        help: "CarryBee merchant panel → API Credentials. Sandbox and Production each have their own.",
      },
      {
        key: "clientSecret",
        label: "Client secret",
        secret: true,
        required: true,
        help: "On the same page as the Client ID.",
      },
      {
        key: "clientContext",
        label: "Client context",
        required: true,
        help: "The third value on the API Credentials page.",
      },
      {
        key: "storeId",
        label: "Pickup store",
        required: true,
        pick: "stores",
        help: "Where CarryBee collects parcels. Press Test connection to choose from your stores.",
      },
      {
        key: "webhookSecret",
        label: "Webhook integration secret",
        secret: true,
        help: "CarryBee shows it on the Webhook Integration page. If it asks you for one, use a long random phrase, and enter the same here.",
      },
    ],
    webhook: {
      path: "/api/couriers/webhook/carrybee",
      how: "On CarryBee's Webhook Integration page, paste this address and copy the secret into the field above. The site answers CarryBee's check with that secret.",
    },
    steps: [
      "Choose Sandbox to try it, or Live for real parcels. Each has its own keys.",
      "Enter the Client ID, Client secret and Client context from CarryBee's API Credentials page.",
      "Press Test connection, then choose your pickup store.",
      "Add the webhook on CarryBee's Webhook Integration page, and save its secret here.",
      "Switch it on.",
    ],
  },
  "test-courier": {
    name: "test-courier",
    label: "Test courier",
    group: "couriers",
    blurb:
      "Pretend parcels: you play the courier from the order page. Never runs on the live site.",
    modes: [],
    fields: [],
    steps: ["Nothing to set up."],
    testOnly: true,
  },
  bulksmsbd: {
    name: "bulksmsbd",
    label: "BulkSMSBD",
    group: "sms",
    blurb: "Bangladeshi SMS gateway. API key and sender ID.",
    modes: [],
    fields: [
      {
        key: "apiKey",
        label: "API key",
        secret: true,
        required: true,
        env: "BULKSMSBD_API_KEY",
        help: "bulksmsbd.net → Dashboard → API key.",
      },
      {
        key: "senderId",
        label: "Sender ID",
        required: true,
        env: "BULKSMSBD_SENDER_ID",
        help: "Your approved sender ID in BulkSMSBD (the number or name the SMS comes from).",
      },
    ],
    steps: [
      "Enter the API key and Sender ID from BulkSMSBD.",
      "Press Test connection and send yourself a test SMS.",
      "Switch it on.",
    ],
  },
  sslwireless: {
    name: "sslwireless",
    label: "SSL Wireless",
    group: "sms",
    blurb: "The largest SMS gateway in Bangladesh (ISMS Plus). API token and SID.",
    modes: [],
    fields: [
      {
        key: "apiToken",
        label: "API token",
        secret: true,
        required: true,
        help: "The ISMS Plus API token SSL Wireless gave you with your SMS account.",
      },
      {
        key: "sid",
        label: "SID",
        required: true,
        help: "Your SID from SSL Wireless, sent with the API token. It sets the sender name or number.",
      },
    ],
    steps: [
      "Enter the API token and SID from SSL Wireless.",
      "Press Test connection and send yourself a test SMS.",
      "Switch it on.",
    ],
  },
  alphasms: {
    name: "alphasms",
    label: "Alpha SMS",
    group: "sms",
    blurb: "Bangladeshi SMS gateway (sms.net.bd). One API key.",
    modes: [],
    fields: [
      {
        key: "apiKey",
        label: "API key",
        secret: true,
        required: true,
        help: "In your Alpha SMS panel (sms.net.bd), under API.",
      },
      {
        key: "senderId",
        label: "Sender ID",
        help: "Your approved sender ID. Leave it empty to use Alpha SMS's default.",
      },
    ],
    steps: [
      "Enter the API key from Alpha SMS (and your sender ID, if you have one).",
      "Press Test connection and send yourself a test SMS. It shows your balance too.",
      "Switch it on.",
    ],
  },
  mimsms: {
    name: "mimsms",
    label: "MiMSMS",
    group: "sms",
    blurb: "Bangladeshi SMS gateway. Login email, API key and sender name.",
    modes: [],
    fields: [
      {
        key: "username",
        label: "Login email",
        required: true,
        help: "The email you sign in to the MiMSMS panel (sms.mimsms.com) with.",
      },
      {
        key: "apiKey",
        label: "API key",
        secret: true,
        required: true,
        help: "MiMSMS panel → API. It must be activated there before it works.",
      },
      {
        key: "senderName",
        label: "Sender name",
        required: true,
        help: "Your approved sender ID in MiMSMS.",
      },
    ],
    steps: [
      "Enter your MiMSMS login email, API key and sender name.",
      "Press Test connection and send yourself a test SMS. It shows your balance too.",
      "Switch it on.",
    ],
  },
  resend: {
    name: "resend",
    label: "Resend",
    group: "email",
    blurb: "Email API for developers. API key and a verified domain.",
    modes: [],
    fields: [
      {
        key: "apiKey",
        label: "API key",
        secret: true,
        required: true,
        env: "RESEND_API_KEY",
        help: "resend.com → API Keys → Create API key (sending access).",
      },
      {
        key: "from",
        label: "Send from",
        required: true,
        env: "EMAIL_FROM",
        placeholder: "ZALFI <receipts@zalfi.com>",
        help: "The sender customers see. Its domain must be verified in Resend → Domains.",
      },
    ],
    steps: [
      "Verify your domain in Resend → Domains.",
      "Enter the API key and the address to send from.",
      "Press Test connection: it sends a test email to you.",
      "Switch it on.",
    ],
  },
  brevo: {
    name: "brevo",
    label: "Brevo",
    group: "email",
    blurb: "Free for 300 emails a day. API key and a verified sender.",
    modes: [],
    fields: [
      {
        key: "apiKey",
        label: "API key",
        secret: true,
        required: true,
        help: "Brevo → SMTP & API → API keys → Generate a new API key.",
      },
      {
        key: "from",
        label: "Send from",
        required: true,
        placeholder: "ZALFI <receipts@zalfi.com>",
        help: "The sender customers see. Add and verify it (or its domain) in Brevo → Senders, domains & dedicated IPs.",
      },
    ],
    steps: [
      "Verify your sender or domain in Brevo.",
      "Enter the API key and the address to send from.",
      "Press Test connection: it sends a test email to you.",
      "Switch it on.",
    ],
  },
  postmark: {
    name: "postmark",
    label: "Postmark",
    group: "email",
    blurb: "Known for the best inbox delivery of receipts. Server token and a verified sender.",
    modes: [],
    fields: [
      {
        key: "serverToken",
        label: "Server API token",
        secret: true,
        required: true,
        help: "Postmark → your server → API Tokens → Server API token.",
      },
      {
        key: "from",
        label: "Send from",
        required: true,
        placeholder: "ZALFI <receipts@zalfi.com>",
        help: "The sender customers see. Verify the address or its domain in Postmark → Sender signatures.",
      },
    ],
    steps: [
      "Verify your sender or domain in Postmark.",
      "Enter the server API token and the address to send from.",
      "Press Test connection: it sends a test email to you.",
      "Switch it on.",
    ],
  },
  smtp: {
    name: "smtp",
    label: "Your mailbox (SMTP)",
    group: "email",
    blurb: "Google Workspace, Gmail, Zoho Mail or your web host's email. No new account.",
    modes: [],
    fields: [
      {
        key: "host",
        label: "SMTP server",
        required: true,
        placeholder: "smtp.gmail.com",
        help: "Gmail and Google Workspace: smtp.gmail.com. Zoho Mail: smtp.zoho.com. A web host: usually mail.yourdomain.com.",
      },
      {
        key: "port",
        label: "Port",
        required: true,
        placeholder: "465",
        help: "465 (SSL) or 587 (STARTTLS). Your mail provider's help page says which.",
      },
      {
        key: "username",
        label: "Username",
        required: true,
        help: "Usually the full email address.",
      },
      {
        key: "password",
        label: "Password",
        secret: true,
        required: true,
        help: "For Gmail or Google Workspace, an app password (Google Account → Security → App passwords), not your normal password.",
      },
      {
        key: "from",
        label: "Send from",
        required: true,
        placeholder: "ZALFI <receipts@zalfi.com>",
        help: "The sender customers see. Use the mailbox's own address, or one it may send as.",
      },
    ],
    steps: [
      "Enter the SMTP server, port, username and password from your mail provider.",
      "Enter the address to send from.",
      "Press Test connection: it signs in, then sends a test email to you.",
      "Switch it on.",
    ],
  },
};

export const isIntegration = (n: string): n is IntegrationName =>
  (INTEGRATIONS as readonly string[]).includes(n);
