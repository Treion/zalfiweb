import localFont from "next/font/local";

/**
 * The site's two typefaces, self-hosted (src/app/fonts, SIL OFL), so no build or dev start ever
 * needs to reach Google Fonts. Variable files cover every weight; the Latin subset, as before.
 */
export const bodoni = localFont({
  src: [
    { path: "./fonts/BodoniModa-Variable.woff2", weight: "400 900", style: "normal" },
    { path: "./fonts/BodoniModa-Italic-Variable.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-bodoni",
  display: "swap",
});

export const hanken = localFont({
  src: [{ path: "./fonts/HankenGrotesk-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-hanken",
  display: "swap",
});
