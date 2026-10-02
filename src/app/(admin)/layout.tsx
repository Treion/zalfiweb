import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "@/components/admin/ui/sonner";
import { TooltipProvider } from "@/components/admin/ui/tooltip";
import { ThemeProvider } from "@/components/admin/theme";
import "./admin.css";

// The admin's own root layout: no stage, no Lenis, no GSAP, no cursor. Light and dark themes.

const bodoni = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", display: "swap" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ZALFI Admin", template: "%s · ZALFI Admin" },
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: "/admin-icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0c" },
  ],
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodoni.variable} ${hanken.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
