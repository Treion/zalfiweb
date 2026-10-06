import path from "node:path";
import {
  Document,
  Font,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { LOGO_PARTS, LOGO_VIEWBOX } from "@/components/brand/logo-paths";
import type { InvoiceData } from "./data";

/**
 * The invoice PDF (A4, plain white for printing). Same InvoiceData, same order, as the e-receipt
 * (email.tsx). Text falls back to Noto Sans Bengali for the ৳ sign and for addresses written in
 * Bangla.
 */
const fonts = path.join(process.cwd(), "assets/fonts");
let registered = false;
export function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Hanken",
    fonts: [
      { src: path.join(fonts, "HankenGrotesk-Regular.woff"), fontWeight: 400 },
      { src: path.join(fonts, "HankenGrotesk-SemiBold.woff"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "NotoBengali",
    fonts: [
      { src: path.join(fonts, "NotoSansBengali-Regular.woff"), fontWeight: 400 },
      { src: path.join(fonts, "NotoSansBengali-SemiBold.woff"), fontWeight: 600 },
      // Bangla has no italic: inside italic serif text (a gift note) it stays upright
      {
        src: path.join(fonts, "NotoSansBengali-Regular.woff"),
        fontWeight: 400,
        fontStyle: "italic",
      },
    ],
  });
  Font.register({
    family: "Bodoni",
    fonts: [
      { src: path.join(fonts, "BodoniModa-Regular.ttf") },
      { src: path.join(fonts, "BodoniModa-Italic.ttf"), fontStyle: "italic" },
    ],
  });
  // Words are never hyphenated
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const INK = "#1A1816";
export const SMOKE = "#6B655E";
export const LINE = "#E4DFD7";
export const TEXT = ["Hanken", "NotoBengali"];
export const DISPLAY = ["Bodoni", "NotoBengali"];

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: TEXT, fontSize: 10, color: INK, lineHeight: 1.5 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.6, textTransform: "uppercase", color: SMOKE },
  title: { fontFamily: DISPLAY, fontSize: 30, lineHeight: 1.3, marginTop: 2, marginBottom: 2 },
  rule: { borderBottomWidth: 0.6, borderBottomColor: LINE, marginVertical: 14 },
  cols: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
  tableHead: { flexDirection: "row", paddingBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 0.6, borderTopColor: LINE },
  cName: { flex: 1 },
  cQty: { width: 40, textAlign: "right" },
  cUnit: { width: 80, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  totals: { marginLeft: "auto", width: 240, marginTop: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  muted: { color: SMOKE },
  small: { fontSize: 8, color: SMOKE, lineHeight: 1.5 },
});

export function Logo({ width }: { width: number }) {
  const [, , w, h] = LOGO_VIEWBOX.split(" ").map(Number);
  return (
    <Svg viewBox={LOGO_VIEWBOX} style={{ width, height: (width * h!) / w! }}>
      {LOGO_PARTS.map((p) => (
        <Path key={p.id} d={p.d} fill={INK} />
      ))}
    </Svg>
  );
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document title={`ZALFI invoice ${data.number}`} author={data.businessName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Logo width={92} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.eyebrow}>Invoice</Text>
            <Text style={s.title}>{data.number}</Text>
            <Text style={s.muted}>{data.date}</Text>
          </View>
        </View>

        <View style={s.rule} />
        <View style={s.cols}>
          <View style={s.col}>
            <Text style={s.eyebrow}>Billed and delivered to</Text>
            <Text>{data.customer.name}</Text>
            {data.address.map((l) => (
              <Text key={l}>{l}</Text>
            ))}
            <Text>{data.customer.phone}</Text>
            <Text>{data.customer.email}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.eyebrow}>Payment</Text>
            <Text>{data.payment.method}</Text>
            <Text style={s.muted}>{data.payment.status}</Text>
            {data.giftMessage ? (
              <>
                <Text style={[s.eyebrow, { marginTop: 8 }]}>Gift</Text>
                <Text>Note card included</Text>
              </>
            ) : null}
          </View>
          <View style={s.col}>
            <Text style={s.eyebrow}>From</Text>
            <Text>{data.businessName}</Text>
            <Text>{data.businessAddress}</Text>
            {data.business.map((b) => (
              <Text key={b.label}>{`${b.label}: ${b.value}`}</Text>
            ))}
          </View>
        </View>

        <View style={[s.rule, { marginBottom: 8 }]} />
        <View style={s.tableHead}>
          <Text style={[s.eyebrow, s.cName]}>Item</Text>
          <Text style={[s.eyebrow, s.cQty]}>Qty</Text>
          <Text style={[s.eyebrow, s.cUnit]}>Price</Text>
          <Text style={[s.eyebrow, s.cTotal]}>Amount</Text>
        </View>
        {data.items.map((i, n) => (
          <View key={n} style={s.row} wrap={false}>
            <Text style={s.cName}>
              <Text style={{ fontFamily: DISPLAY, fontSize: 12 }}>{i.name}</Text>
              <Text style={s.muted}>{`  ${i.size}`}</Text>
            </Text>
            <Text style={s.cQty}>{i.qty}</Text>
            <Text style={s.cUnit}>{i.unit}</Text>
            <Text style={s.cTotal}>{i.total}</Text>
          </View>
        ))}
        <View style={[s.rule, { marginTop: 0 }]} />
        <View style={s.totals}>
          {data.totals.map((t) => (
            <View key={t.label} style={[s.totalRow, t.strong ? { marginTop: 4 } : {}]}>
              <Text style={t.strong ? { fontWeight: 600 } : s.muted}>{t.label}</Text>
              <Text style={t.strong ? { fontFamily: DISPLAY, fontSize: 16 } : {}}>{t.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: "auto" }}>
          <View style={s.rule} />
          {data.footerNote ? (
            <Text style={[s.small, { marginBottom: 4 }]}>{data.footerNote}</Text>
          ) : null}
          <Text style={s.small}>
            {`${data.store.name} · ${data.store.phone} · ${data.store.email} · ${data.store.url.replace(/^https?:\/\//, "")}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoiceData) {
  registerFonts();
  return renderToBuffer(<InvoiceDocument data={data} />);
}
