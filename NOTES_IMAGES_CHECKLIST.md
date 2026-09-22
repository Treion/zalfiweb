# ZALFI: Note Image Checklist

Every note image the site needs. Drop each one into `public/images/notes/` using the **exact filename** below.

## Shared photo spec (applies to every image)

- **Real photography only.** No AI-generated images, illustrations, 3D renders, or clip art.
- **Transparent background PNG**, cut out cleanly. Keep soft shadows off the cutout; the site adds its own.
- **At least 2000px on the long edge.** 3000px is ideal. The site serves smaller sizes automatically through `next/image`.
- **Lighting:** soft and directional, one key light. It should roughly match the bottle shots so everything looks like it sits in the same room.
- **Crop:** the subject fills about 80% of the frame with a little air around it. Nothing touching the edges.
- **Filenames:** lowercase kebab-case, `.png`.

A missing file does not break anything. The site draws a thin empty frame with the filename written inside, never a substitute image.

## Bottles (required, `public/images/bottles/`)

| File | Status |
|---|---|
| `reva.png` | ☐ |
| `riven.png` | ☐ |
| `maree.png` | ☐ |
| `solea.png` | ☐ |
| `bond.png` | ☐ |
| `oudor.png` | ☐ |

Transparent-background PNGs are strongly preferred, because each bottle sits on top of its fragrance's colour world.

## Notes (26 images, `public/images/notes/`)

Some notes appear in more than one fragrance under different names (for example "Crushed Wild Mint" and "Cool Mint"). Those share one ingredient image, and the elegant label comes from the database. No fragrance uses the same image twice.

| # | File | Used in (label shown on site) | Ideal photo |
|---|---|---|---|
| 1 | `pineapple.png` | Reva (Frosted Pineapple), Solea (Pineapple) | Whole ripe pineapple with a full green crown, three-quarter angle. Ideally cold and dewy with fine condensation, to carry the "frosted" feel. |
| 2 | `mint.png` | Reva (Crushed Wild Mint), Riven (Cool Mint) | A loose sprig of fresh spearmint, 5–7 leaves, a couple slightly bruised or curled. Side angle. |
| 3 | `lavender.png` | Reva (French Lavender), Maree (Lavender), Solea (Lavender) | A small bundle of 3–5 dried or fresh lavender stems, full purple flower heads, stems diagonal. |
| 4 | `oakmoss.png` | Reva (Sunlit Oakmoss), Riven (Earthy Oakmoss) | A clump of grey-green oakmoss lichen, fronds visible, ideally still on a small piece of bark. |
| 5 | `vetiver.png` | Reva (Earthy Vetiver), Maree (Vetiver) | A bundle of dried vetiver roots tied with twine, fibrous and golden-tan. |
| 6 | `tonka-bean.png` | Reva (Warm Tonka Bean), Solea (Tonka Bean) | A small cluster of 5–8 tonka beans. Wrinkled, dark brown-black, with a slight sheen. |
| 7 | `cucumber.png` | Riven (Crisp Cucumber), Maree (Cucumber) | Half a cucumber plus 2–3 thin translucent slices fanned out. Wet, crisp, glassy. |
| 8 | `jasmine.png` | Riven (Jasmine), Maree (Jasmine) | A sprig of white jasmine (Jasminum sambac or grandiflorum) with open star-shaped flowers, a few buds, and dark leaves. |
| 9 | `lime.png` | Riven (Zesty Lime) | One whole lime and one halved lime, juicy cut face toward the camera. |
| 10 | `patchouli.png` | Riven (Rich Patchouli), Maree (Patchouli), Bond (Patchouli), Oudor (Patchouli) | A sprig of fresh patchouli leaves (broad, fuzzy, serrated), or a small pile of dried dark-brown patchouli leaves. |
| 11 | `green-apple.png` | Maree (Green Apple) | A single Granny Smith apple with its stem and one leaf, side angle, glossy skin. |
| 12 | `tuberose.png` | Maree (Tuberose) | One stem of waxy white tuberose flowers, several open with buds at the top. |
| 13 | `cedarwood.png` | Maree (Cedarwood) | A cross-section slice or short log of cedar showing growth rings and reddish heartwood. |
| 14 | `sandalwood.png` | Maree (Sandalwood), Bond (Sandalwood) | A few pale-gold sandalwood sticks or chips, fine grain visible. |
| 15 | `apple.png` | Solea (Apple) | A single red-blushed yellow apple (Gala or Pink Lady), warm-toned. It must look clearly different from `green-apple.png`. |
| 16 | `coconut.png` | Solea (Coconut) | A coconut cracked in half, white flesh and brown husk both visible. |
| 17 | `vanilla.png` | Solea (Vanilla), Bond (Vanilla) | 3–4 cured vanilla pods, dark and glossy, ideally with one pale vanilla orchid flower. |
| 18 | `iris.png` | Bond (Iris) | A single purple bearded iris flower, side angle, with a short stem. |
| 19 | `nutmeg.png` | Bond (Nutmeg) | A whole nutmeg with its red lace of mace, plus one halved nutmeg showing the marbled inside. |
| 20 | `oud.png` | Bond (Oud) | A handful of dark oud wood chips with visible black resin veins. |
| 21 | `precious-woods.png` | Bond (Precious Woods) | A small stack of polished exotic wood offcuts in mixed tones (ebony, rosewood, amber), grain visible. |
| 22 | `saffron.png` | Oudor (Saffron) | A small pile of deep-red saffron threads, or 2–3 purple crocus flowers with red stigmas showing. |
| 23 | `red-rose.png` | Oudor (Red Rose) | A single deep-red rose (Damask or Baccara), fully open, short stem, side or three-quarter angle. |
| 24 | `white-oud.png` | Oudor (White Oud) | Pale, blond oud wood shavings or a light-coloured agarwood piece with faint resin. It must look distinct from `oud.png`. |
| 25 | `agarwood.png` | Oudor (Agarwood) | A raw agarwood branch section or split log with heavy dark resin marbling. This is a larger, sculptural object than the chips in `oud.png`. |
| 26 | `musk.png` | Oudor (Warm Musk) | Musk has no literal ingredient. Use ambrette seeds (the botanical musk), or a small heap of white musk crystals. |

## Quick tick-list

```
☐ pineapple.png        ☐ jasmine.png          ☐ coconut.png          ☐ saffron.png
☐ mint.png             ☐ lime.png             ☐ vanilla.png          ☐ red-rose.png
☐ lavender.png         ☐ patchouli.png        ☐ iris.png             ☐ white-oud.png
☐ oakmoss.png          ☐ green-apple.png      ☐ nutmeg.png           ☐ agarwood.png
☐ vetiver.png          ☐ tuberose.png         ☐ oud.png              ☐ musk.png
☐ tonka-bean.png       ☐ cedarwood.png        ☐ precious-woods.png
☐ cucumber.png         ☐ sandalwood.png       ☐ apple.png
```
