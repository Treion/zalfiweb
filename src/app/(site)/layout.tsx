import type { Metadata, Viewport } from "next";
import { bodoni, hanken } from "@/app/fonts";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/ui/Cursor";
import { Grain } from "@/components/ui/Grain";
import { SkipLink } from "@/components/ui/SkipLink";
import { StageLoader } from "@/components/stage/StageLoader";
import { CartProvider } from "@/components/cart/cart-store";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/sections/Footer";
import { getDiscoverySets, getFragrances } from "@/db/queries";
import { getShopTerms } from "@/server/checkout/terms";
import "./globals.css";
import { countWord, listNames } from "@/lib/words";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const fragrances = await getFragrances();
  return {
    ...metadata,
    description: `ZALFI is a niche perfume house. ${countWord(fragrances.length, true)} eaux de parfum in smoked glass: ${listNames(fragrances.map((f) => f.name))}.`,
  };
}

const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ZALFI | Eau de Parfum",
    template: "%s | ZALFI",
  },
  description:
    "ZALFI is a niche perfume house. Six eaux de parfum in smoked glass: Reva, Riven, Maree, Solea, Bond and Oudor.",
  openGraph: {
    type: "website",
    siteName: "ZALFI",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0e0d0c",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [fragrances, sets, terms] = await Promise.all([
    getFragrances(),
    getDiscoverySets(),
    getShopTerms(),
  ]);
  // Every sku on sale, bottles and discovery sets: a saved bag keeps only these
  const catalogue = Object.fromEntries([
    ...fragrances.flatMap((f) => f.variants.map((v) => [v.sku, v.pricePoisha] as const)),
    ...sets.flatMap((s) => (s.variant ? [[s.variant.sku, s.variant.pricePoisha] as const] : [])),
  ]);
  const discovery = sets.length > 0;
  const stageFragrances = fragrances.map(({ slug, name, palette, capFinish, bottle }) => ({
    slug,
    name,
    palette,
    capFinish,
    bottle,
  }));
  return (
    <html lang="en" className={`${bodoni.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        {/* Marks JS before first paint so pre-motion states never flash (see globals.css) */}
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
      </head>
      <body>
        <SkipLink />
        <SmoothScroll>
          <CartProvider catalogue={catalogue}>
            <Nav discovery={discovery} />
            {children}
            <Footer fragrances={fragrances} discovery={discovery} />
            <CartDrawer worldCount={fragrances.length} discovery={discovery} terms={terms} />
          </CartProvider>
        </SmoothScroll>
        <StageLoader fragrances={stageFragrances} />
        <Cursor />
        <Grain />
      </body>
    </html>
  );
}
