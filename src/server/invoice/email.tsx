import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import type { InvoiceData } from "./data";

/**
 * The e-receipt: the one email ZALFI sends a customer. It renders the same InvoiceData, in the
 * same order, as the PDF invoice (pdf.tsx). Plain white, so it prints well, with the logo and the
 * house's serif for the headline where the mail app has it.
 */
const INK = "#1A1816";
const SMOKE = "#6B655E";
const LINE = "#E4DFD7";
const serif = "'Bodoni Moda', 'Bodoni 72', Didot, Georgia, serif";
const sans = "'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const eyebrow = {
  fontFamily: sans,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase" as const,
  color: SMOKE,
  margin: "0 0 8px",
};
const body = { fontFamily: sans, fontSize: "14px", lineHeight: "22px", color: INK, margin: 0 };

export function ReceiptEmail({ data }: { data: InvoiceData }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Your ZALFI order ${data.number}: ${data.totals.find((t) => t.strong)?.value ?? ""}`}</Preview>
      <Body style={{ backgroundColor: "#FFFFFF", margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "0 24px" }}>
          <Img
            src={`${data.store.url}/brand/zalfi-logo-ink.png`}
            width="120"
            height="74"
            alt="ZALFI"
            style={{ margin: "0 0 40px" }}
          />
          <Text style={eyebrow}>Receipt · {data.number}</Text>
          <Text
            style={{
              fontFamily: serif,
              fontSize: "40px",
              lineHeight: "44px",
              color: INK,
              margin: "0 0 12px",
            }}
          >
            Thank you, {data.customer.name.split(" ")[0]}.
          </Text>
          <Text style={{ ...body, color: SMOKE }}>
            Your order is confirmed. We&rsquo;ll pack it with care.
          </Text>

          <Hr style={{ borderColor: LINE, margin: "32px 0 16px" }} />
          {data.items.map((i, n) => (
            <Row key={n} style={{ padding: "8px 0" }}>
              <Column>
                <Text style={{ ...body, fontFamily: serif, fontSize: "20px", lineHeight: "26px" }}>
                  {i.name}
                </Text>
                <Text style={{ ...body, color: SMOKE, fontSize: "13px" }}>
                  {i.size} · {i.qty} × {i.unit}
                </Text>
              </Column>
              <Column align="right" style={{ verticalAlign: "top" }}>
                <Text style={body}>{i.total}</Text>
              </Column>
            </Row>
          ))}
          <Hr style={{ borderColor: LINE, margin: "16px 0" }} />
          {data.totals.map((t) => (
            <Row key={t.label}>
              <Column>
                <Text
                  style={{
                    ...body,
                    color: t.strong ? INK : SMOKE,
                    fontWeight: t.strong ? 600 : 400,
                    padding: t.strong ? "8px 0 0" : "2px 0",
                  }}
                >
                  {t.label}
                </Text>
              </Column>
              <Column align="right">
                <Text
                  style={{
                    ...body,
                    fontFamily: t.strong ? serif : sans,
                    fontSize: t.strong ? "24px" : "14px",
                    padding: t.strong ? "8px 0 0" : "2px 0",
                  }}
                >
                  {t.value}
                </Text>
              </Column>
            </Row>
          ))}

          <Hr style={{ borderColor: LINE, margin: "24px 0" }} />
          <Row>
            <Column style={{ verticalAlign: "top", width: "50%", paddingRight: "12px" }}>
              <Text style={eyebrow}>Delivering to</Text>
              <Text style={body}>{data.customer.name}</Text>
              {data.address.map((l) => (
                <Text key={l} style={body}>
                  {l}
                </Text>
              ))}
              <Text style={body}>{data.customer.phone}</Text>
            </Column>
            <Column style={{ verticalAlign: "top", width: "50%" }}>
              <Text style={eyebrow}>Payment</Text>
              <Text style={body}>{data.payment.method}</Text>
              <Text style={{ ...body, color: SMOKE }}>{data.payment.status}</Text>
              <Text style={{ ...eyebrow, marginTop: "16px" }}>Date</Text>
              <Text style={body}>{data.date}</Text>
            </Column>
          </Row>
          {data.trackingUrl && (
            <Section style={{ marginTop: "24px" }}>
              <Link
                href={data.trackingUrl}
                style={{ ...body, textDecoration: "underline", textUnderlineOffset: "4px" }}
              >
                Track your delivery
              </Link>
            </Section>
          )}

          <Hr style={{ borderColor: LINE, margin: "32px 0 16px" }} />
          <Text style={{ ...body, fontSize: "12px", lineHeight: "18px", color: SMOKE }}>
            {data.businessName} · {data.businessAddress}
            {data.business.map((b) => ` · ${b.label} ${b.value}`).join("")}
          </Text>
          <Text style={{ ...body, fontSize: "12px", lineHeight: "18px", color: SMOKE }}>
            Questions? {data.store.phone} · {data.store.email}
          </Text>
          {data.footerNote && (
            <Text
              style={{
                ...body,
                fontSize: "12px",
                lineHeight: "18px",
                color: SMOKE,
                marginTop: "12px",
              }}
            >
              {data.footerNote}
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export async function renderReceipt(data: InvoiceData) {
  const el = <ReceiptEmail data={data} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { html, text, subject: `Your ZALFI receipt, ${data.number}` };
}
