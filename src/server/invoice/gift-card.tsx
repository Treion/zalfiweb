import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { DISPLAY, INK, LINE, Logo, SMOKE, TEXT, registerFonts } from "./pdf";

/**
 * The free gift note, printed on an A6 card that goes in the box: the logo, the customer's words
 * in the house's serif italic (Bangla stays upright), and nothing about price.
 */
const s = StyleSheet.create({
  page: { padding: 36, fontFamily: TEXT, color: INK, flexDirection: "column" },
  eyebrow: { fontSize: 6.5, letterSpacing: 1.6, textTransform: "uppercase", color: SMOKE },
});

/** Shorter notes are set larger, so every card fills the same calm space */
export function giftNoteSize(message: string) {
  const n = message.length;
  return n <= 60 ? 20 : n <= 120 ? 16 : 13;
}

export function GiftCard({ message, number }: { message: string; number: string }) {
  const size = giftNoteSize(message);
  return (
    <Document title={`Gift note ${number}`}>
      <Page size="A6" style={s.page}>
        <Logo width={58} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text
            style={{
              fontFamily: DISPLAY,
              fontStyle: "italic",
              fontSize: size,
              lineHeight: 1.4,
            }}
          >
            {message}
          </Text>
        </View>
        <View style={{ borderBottomWidth: 0.6, borderBottomColor: LINE, marginBottom: 8 }} />
        <Text style={s.eyebrow}>Chosen for you</Text>
      </Page>
    </Document>
  );
}

export async function renderGiftCard(message: string, number: string) {
  registerFonts();
  return renderToBuffer(<GiftCard message={message} number={number} />);
}
