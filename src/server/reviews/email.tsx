import { Body, Container, Head, Hr, Html, Img, Link, Preview, Text } from "@react-email/components";
import { render } from "@react-email/render";

/**
 * "It's with you": the one email after delivery, with the link to review the order. Same paper,
 * ink and type as the e-receipt (invoice/email.tsx).
 */
const INK = "#1A1816";
const SMOKE = "#6B655E";
const LINE = "#E4DFD7";
const serif = "'Bodoni Moda', 'Bodoni 72', Didot, Georgia, serif";
const sans = "'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const body = { fontFamily: sans, fontSize: "14px", lineHeight: "22px", color: INK, margin: 0 };

export type AskData = {
  number: string;
  firstName: string;
  /** What was in the box ("Reva and Oudor") */
  items: string;
  reviewUrl: string;
  siteUrl: string;
  store: { phone: string; email: string };
};

export function ReviewAskEmail({ data }: { data: AskData }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${data.items}, delivered. How does it wear?`}</Preview>
      <Body style={{ backgroundColor: "#FFFFFF", margin: 0, padding: "32px 0" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "0 24px" }}>
          <Img
            src={`${data.siteUrl}/brand/zalfi-logo-ink.png`}
            width="120"
            height="74"
            alt="ZALFI"
            style={{ margin: "0 0 40px" }}
          />
          <Text
            style={{
              fontFamily: sans,
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: SMOKE,
              margin: "0 0 8px",
            }}
          >
            Delivered · {data.number}
          </Text>
          <Text
            style={{
              fontFamily: serif,
              fontSize: "40px",
              lineHeight: "44px",
              color: INK,
              margin: "0 0 16px",
            }}
          >
            {`It’s with you, ${data.firstName}.`}
          </Text>
          <Text style={{ ...body, color: SMOKE }}>
            {`Wear ${data.items} for a few days. Then tell us how it sits on you. A few words help someone else choose.`}
          </Text>
          <Link
            href={data.reviewUrl}
            style={{
              display: "inline-block",
              marginTop: "28px",
              padding: "16px 28px",
              backgroundColor: INK,
              color: "#FFFFFF",
              fontFamily: sans,
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Write a review
          </Link>
          <Hr style={{ borderColor: LINE, margin: "40px 0 16px" }} />
          <Text style={{ ...body, fontSize: "12px", lineHeight: "18px", color: SMOKE }}>
            Something not right? {data.store.phone} · {data.store.email}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderReviewAsk(data: AskData) {
  const el = <ReviewAskEmail data={data} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { html, text, subject: `Delivered: how does it wear?` };
}
