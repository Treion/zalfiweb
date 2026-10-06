import { asc, desc, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import {
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { orderItems, orders, shipments } from "@/db/schema";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";
import { poolDb } from "@/server/db/pool";
import { DISPLAY, INK, LINE, Logo, SMOKE, TEXT, registerFonts } from "@/server/invoice/pdf";
import { getSettings } from "@/server/settings";
import { CANCELLED_HERE, COURIER_LABELS } from "./types";

/**
 * ZALFI's own shipping label: 4 × 6 inches, one per page, for a thermal or ordinary printer. It
 * carries the order number, the recipient, the cash to collect (or "paid"), the courier's
 * consignment ID and a QR code of the tracking code. Several orders print as one PDF.
 */
export type LabelData = {
  number: string;
  date: string;
  courier: string;
  consignmentId: string;
  trackingCode: string;
  cod: number;
  name: string;
  phone: string;
  address: string[];
  zone: string;
  items: string;
  bottles: number;
  /** A gift: the note card goes in the box */
  gift: boolean;
  from: { phone: string; address: string };
};

export async function loadLabels(orderIds: number[]): Promise<LabelData[]> {
  if (!orderIds.length) return [];
  const db = poolDb();
  const [os, ss, items, store] = await Promise.all([
    db.select().from(orders).where(inArray(orders.id, orderIds)),
    db
      .select()
      .from(shipments)
      .where(inArray(shipments.orderId, orderIds))
      .orderBy(desc(shipments.id)),
    db
      .select({ orderId: orderItems.orderId, name: orderItems.name, qty: orderItems.qty })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(asc(orderItems.id)),
    getSettings("store"),
  ]);
  return orderIds.flatMap((id) => {
    const o = os.find((x) => x.id === id);
    const s = ss.find((x) => x.orderId === id && x.consignmentId && x.status !== CANCELLED_HERE);
    if (!o || !s) return [];
    const mine = items.filter((i) => i.orderId === id);
    return [
      {
        number: o.number,
        date: formatDate(s.createdAt),
        courier: COURIER_LABELS[s.courier],
        consignmentId: s.consignmentId!,
        trackingCode: s.trackingCode ?? s.consignmentId!,
        cod: s.codAmount,
        name: o.customerName,
        phone: formatPhone(o.customerPhone),
        address: [o.addressStreet, `${o.addressArea}, ${o.addressDistrict}`],
        zone: o.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka",
        items: mine.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", "),
        bottles: mine.reduce((n, i) => n + i.qty, 0),
        gift: !!o.giftMessage,
        from: { phone: store.contactPhone, address: store.address },
      },
    ];
  });
}

/**
 * A QR code as one path, in module units: a rectangle per run of dark modules in a row, each a
 * touch taller than its row so neighbouring rows overlap and print without hairline seams.
 */
function Qr({ text, size }: { text: string; size: number }) {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = q.modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!q.modules.get(y, x)) {
        x++;
        continue;
      }
      const start = x;
      while (x < n && q.modules.get(y, x)) x++;
      d += `M${start + 1} ${y + 1}h${x - start}v1.06h${start - x}z`;
    }
  }
  return (
    <Svg viewBox={`0 0 ${n + 2} ${n + 2}`} style={{ width: size, height: size }}>
      <Path d={d} fill={INK} />
    </Svg>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, fontFamily: TEXT, fontSize: 9, color: INK, lineHeight: 1.35 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontSize: 6.5, letterSpacing: 1.4, textTransform: "uppercase", color: SMOKE },
  rule: { borderBottomWidth: 0.8, borderBottomColor: INK, marginVertical: 8 },
  hair: { borderBottomWidth: 0.6, borderBottomColor: LINE, marginVertical: 7 },
});

function Label({ d }: { d: LabelData }) {
  return (
    <Page size={[288, 432]} style={s.page}>
      <View style={s.row}>
        <Logo width={54} />
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.eyebrow}>{d.courier}</Text>
          <Text style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{d.consignmentId}</Text>
          <Text style={{ color: SMOKE, fontSize: 7.5 }}>{d.date}</Text>
        </View>
      </View>
      <View style={s.rule} />
      <View style={s.row}>
        <View>
          <Text style={s.eyebrow}>Order</Text>
          <Text style={{ fontFamily: DISPLAY, fontSize: 20, lineHeight: 1.15 }}>{d.number}</Text>
          {d.gift ? (
            <Text
              style={{
                alignSelf: "flex-start",
                borderWidth: 0.8,
                borderColor: INK,
                paddingHorizontal: 5,
                paddingTop: 1.5,
                marginTop: 3,
                fontSize: 7.5,
                fontWeight: 600,
                letterSpacing: 1.4,
              }}
            >
              GIFT · NOTE CARD INSIDE
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.eyebrow}>{d.cod ? "Collect in cash" : "Paid online"}</Text>
          <Text
            style={{
              fontSize: d.cod ? 20 : 13,
              fontWeight: 600,
              lineHeight: 1.15,
              marginTop: d.cod ? 0 : 4,
            }}
          >
            {d.cod ? formatPrice(d.cod) : "Collect nothing"}
          </Text>
        </View>
      </View>
      <View style={s.rule} />
      <Text style={s.eyebrow}>Deliver to</Text>
      <Text style={{ fontSize: 14, fontWeight: 600, marginTop: 3, lineHeight: 1.25 }}>
        {d.name}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: 600, marginTop: 2, marginBottom: 2 }}>
        {d.phone}
      </Text>
      {d.address.map((l) => (
        <Text key={l} style={{ fontSize: 10.5 }}>
          {l}
        </Text>
      ))}
      <Text style={{ color: SMOKE, marginTop: 2 }}>{d.zone}</Text>
      <View style={s.hair} />
      <View style={[s.row, { marginTop: "auto" }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={s.eyebrow}>Contents</Text>
          <Text>{`${d.bottles} ${d.bottles === 1 ? "bottle" : "bottles"}: ${d.items}`}</Text>
          <Text style={{ fontWeight: 600, marginTop: 4 }}>Fragile: glass. Keep upright.</Text>
          <View style={s.hair} />
          <Text style={s.eyebrow}>If undelivered, return to</Text>
          <Text>{d.from.phone}</Text>
          <Text style={{ color: SMOKE, fontSize: 7.5 }}>{d.from.address}</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Qr text={d.trackingCode} size={104} />
          <Text style={{ fontSize: 7.5, marginTop: 2 }}>{d.trackingCode}</Text>
        </View>
      </View>
    </Page>
  );
}

export async function renderLabels(data: LabelData[]) {
  registerFonts();
  return renderToBuffer(
    <Document title={data.length === 1 ? `Label ${data[0]!.number}` : `${data.length} labels`}>
      {data.map((d) => (
        <Label key={d.number} d={d} />
      ))}
    </Document>,
  );
}
