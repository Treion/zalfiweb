# ZALFI: Note Image Checklist

Every note image the site needs. Drop each one into `public/images/notes/` using the **exact filename** below.

## Shared photo spec (applies to every image)

- **Photorealistic only.** Real photos, or AI-generated images that are indistinguishable from studio photography (allowed by the owner on 2026-09-22). No illustrations, cartoon styles, visible 3D-render look, or clip art.
- **Transparent background PNG**, cut out cleanly. Keep soft shadows off the cutout; the site adds its own.
- **At least 2000px on the long edge.** 3000px is ideal. The site serves smaller sizes automatically through `next/image`.
- **Lighting:** soft and directional, one key light. It should roughly match the bottle shots so everything looks like it sits in the same room.
- **Crop:** the subject fills about 80% of the frame with a little air around it. Nothing touching the edges.
- **Filenames:** lowercase kebab-case, `.png`.

A missing file does not break anything. The site draws a thin empty frame with the filename written inside, never a substitute image.

## Bottles: received ✓

The originals were uploaded to the repo root and are moved to `public/images/bottles/` in M0.

| File | Status | Cap |
|---|---|---|
| `reva.png` | ✓ 2000×2000, transparent | silver, ribbed |
| `riven.png` | ✓ 2000×2000, transparent | gunmetal, ribbed |
| `maree.png` | ✓ 2000×2000, transparent | gold, ribbed |
| `solea.png` | ✓ 2000×2000, transparent | chrome sphere |
| `bond.png` | ✓ 2000×2000, transparent | black sphere |
| `oudor.png` | ✓ 2000×2000, transparent | gold sphere |

Logo: `logo.png` ✓ (1483×1061, black on transparent). It is traced to SVG in M0.

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

---

## Prompt pack (for AI image generation)

Paste the **style block** first, then the line for one note. Generate each image separately. Use a square 1:1 frame. Ask for a transparent background if your tool supports it; otherwise ask for a plain pure-white background and I'll cut it out.

**Style block, identical for all 26 so the set looks like one photoshoot:**

> Luxury perfume ingredient still life, photorealistic studio product photography, shot on a medium-format camera with a 100mm macro lens, f/8, single soft key light from the upper left with a gentle fill, subtle natural shadows on the object only, rich true-to-life colour, extremely fine detail and texture, the subject isolated and centred with generous empty space around it, filling about 80% of the frame, nothing touching the edges, plain pure white seamless background (or transparent), no props, no surface, no text, no logos, no hands, no people, no bottles, no illustration, no cartoon, no CGI look.

**Subject lines:**

| File | Subject line |
|---|---|
| `pineapple.png` | A whole ripe golden pineapple with a full green crown, three-quarter view, cold and dewy with fine condensation droplets on the skin. |
| `mint.png` | A loose sprig of fresh spearmint with six vivid green leaves, two leaves slightly bruised and curled, side view. |
| `lavender.png` | A small bundle of five fresh French lavender stems with full violet flower heads, laid diagonally. |
| `oakmoss.png` | A clump of grey-green oakmoss lichen with delicate branching fronds, growing on a small piece of dark oak bark. |
| `vetiver.png` | A bundle of dried golden-tan vetiver roots tied with natural twine, fibrous texture clearly visible. |
| `tonka-bean.png` | A small cluster of seven tonka beans, wrinkled, dark brown-black with a subtle sheen. |
| `cucumber.png` | Half a fresh cucumber with three thin translucent slices fanned out in front, wet, crisp and glassy. |
| `jasmine.png` | A sprig of white jasmine sambac with open star-shaped flowers, a few closed buds and dark glossy leaves. |
| `lime.png` | One whole lime and one halved lime, juicy cut face toward the camera, glistening pulp. |
| `patchouli.png` | A sprig of fresh patchouli with broad, soft, serrated green leaves. |
| `green-apple.png` | A single Granny Smith apple with its stem and one leaf, glossy bright green skin, side view. |
| `tuberose.png` | One stem of waxy white tuberose flowers, several fully open with closed buds at the top. |
| `cedarwood.png` | A cross-section slice of a cedar log showing clear growth rings and warm reddish heartwood, three-quarter view. |
| `sandalwood.png` | Five pale-gold sandalwood sticks and a few small chips, fine wood grain visible. |
| `apple.png` | A single red-blushed yellow Pink Lady apple with its stem, warm-toned, glossy skin. |
| `coconut.png` | A coconut cracked cleanly in half, bright white flesh and fibrous brown husk both visible. |
| `vanilla.png` | Four cured vanilla pods, dark, glossy and slightly oily, with one pale cream vanilla orchid flower. |
| `iris.png` | A single purple bearded iris flower on a short stem, side view, delicate ruffled petals. |
| `nutmeg.png` | A whole nutmeg wrapped in its bright red lace of mace, beside a halved nutmeg showing its marbled interior. |
| `oud.png` | A small heap of dark oud wood chips with visible black resin veins. |
| `precious-woods.png` | A small stack of polished exotic wood offcuts in mixed tones of ebony, rosewood and amber, rich grain visible. |
| `saffron.png` | A small mound of deep crimson saffron threads with a few loose strands in front. |
| `red-rose.png` | A single deep-red Damask rose fully open on a short stem, three-quarter view, velvety petals. |
| `white-oud.png` | Pale blond oud wood shavings and slivers with faint light-brown resin, soft and airy, clearly lighter than dark oud. |
| `agarwood.png` | A sculptural split section of raw agarwood branch with heavy dark resin marbling through pale wood. |
| `musk.png` | A small heap of ambrette seeds, small, grey-brown and kidney-shaped, softly lit. |

**How to hand them over:** upload them just as you did the bottles. Any filename works as long as I can tell which note it is; I'll rename, trim, resize and move them.
