# 3D models (Higgsfield)

The site is ready for real 3D models of the six bottles and the 26 notes. Any model listed in `src/components/stage/model-manifest.ts` renders in 3D on the WebGL stage:

- **Bottles:** in the hero, the six chapters (where they turn with scroll), the collection (hover turns them), and the product pages (drag or arrow keys to turn).
- **Notes:** as floating objects in the chapters, following the same arrive, recede and scatter choreography.

Anything not listed keeps its current fallback: the relit bottle photo, or the note's photo or frame. So models can arrive one at a time.

## 1. Generate (Higgsfield connector)

`higgsfield-plan.json` holds everything the connector needs:

| | What | Model | Estimated cost |
|---|---|---|---|
| Bottles | Already uploaded; the media IDs are in the plan | `tripo_h3_1_image_to_3d`, detailed, PBR | 6 × 18 credits |
| Note images | Style block + subject line per note, 1:1 | `gpt_image_2_5` | 26 × 0.25 credits |
| Note cut-outs | `remove_background` on each image | | small |
| Notes 3D | The cut-out images | `hunyuan3d_v3_image_to_3d`, PBR | 26 × 15 credits |

The total is about 500–600 credits, plus a retry budget. Review every result before ingesting. Reject any bottle whose label, cap or proportions drift from the photo.

## 2. Ingest

```bash
# assets/models/sources.json: [{ "kind": "bottle", "slug": "reva", "src": "<GLB url or path>", "yaw": 0 }, …]
npm run models:ingest -- --batch assets/models/sources.json
npm run models:ingest -- --kind note --slug iris --src ./iris.glb --yaw 30   # one at a time
npm run models:ingest -- --remove bottle:reva                               # take one out again
```

Each model is cleaned, simplified to its budget (120k triangles for bottles, 24k for notes), and compressed (meshopt geometry, WebP textures). It is then normalised to height 1, standing on the floor, and written to `public/models/…` with its manifest entry. Use `--yaw` (degrees) so the bottle's label faces the camera.

**Network:** downloading results needs the environment to allow Higgsfield's CDN host (currently `d2ol7oe51mr4n9.cloudfront.net`; the job results may show another CloudFront host). Otherwise, download the GLBs yourself and pass local paths.

## 3. Check

Open `/?stage=force` and `/fragrances/<slug>?stage=force`. Headless and GPU-less browsers get the static layout unless forced.
