# Fonts

All under the SIL Open Font License 1.1 (`OFL.txt`).

| File | Family | Source | Used by |
|---|---|---|---|
| `BodoniModa-*.ttf` | Bodoni Moda | Google Fonts | OG images, invoice PDF headings |
| `HankenGrotesk-*.woff` | Hanken Grotesk (Latin subset) | Fontsource 5.3.0 | invoice PDF text |
| `NotoSansBengali-*.woff` | Noto Sans Bengali (Bengali subset) | Fontsource 5.3.0 | invoice PDF: the ৳ sign and addresses written in Bangla |

The site and the admin load their own self-hosted copies (`src/app/fonts`, loaded by `src/app/fonts.ts` with `next/font/local`), so building never needs Google Fonts. These copies are for server-side rendering only.
