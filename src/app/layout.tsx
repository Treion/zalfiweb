import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Cursor } from "@/components/ui/Cursor";
import { Grain } from "@/components/ui/Grain";
import { SkipLink } from "@/components/ui/SkipLink";
import { StageLoader } from "@/components/stage/StageLoader";
import { CartProvider } from "@/components/cart/cart-store";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Nav } from "@/components/ui/Nav";
import { getFragrances } from "@/db/queries";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ZALFI | Maison de Parfum",
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
  const fragrances = await getFragrances();
  const stageFragrances = fragrances.map(({ slug, name, palette, capFinish }) => ({
    slug,
    name,
    palette,
    capFinish,
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
          <CartProvider>
            <Nav />
            {children}
            <CartDrawer />
          </CartProvider>
        </SmoothScroll>
        <StageLoader fragrances={stageFragrances} />
        <Cursor />
        <Grain />
      </body>
    </html>
  );
}
