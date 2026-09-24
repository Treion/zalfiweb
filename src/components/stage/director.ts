import * as THREE from "three";
import type { Palette } from "@/lib/fragrance";
import { anchors, type Anchor } from "./anchors";
import { BOTTLE_META } from "./bottle-meta";
import { bottlePose, chapterProgress, mastheadState, worldBlend, type Pose } from "./choreography";
import { chapterAt, easeInOutCubic } from "./config";
import * as S from "./shaders";
import { stageState } from "./stage-state";
import { HOUSE_PALETTE, type StageFragrance } from "./worlds";
import {
  BOTTLE_MODELS,
  NOTE_MODELS,
  ModelLibrary,
  anyModels,
  instantiate,
  studioEnvironment,
  type ModelInstance,
} from "./models";

export type Tier = "high" | "low";
export const FOV = 30;
const DEG = Math.PI / 180;

/* ---------------------------------------------------------------------------------------------- */

type LinPalette = { bg: THREE.Color; deep: THREE.Color; accent: THREE.Color; ink: THREE.Color };

const toLinear = (p: Palette): LinPalette => ({
  bg: new THREE.Color(p.bg),
  deep: new THREE.Color(p.deep),
  accent: new THREE.Color(p.accent),
  ink: new THREE.Color(p.ink),
});

const lerpPalette = (out: LinPalette, a: LinPalette, b: LinPalette, t: number) => {
  out.bg.copy(a.bg).lerp(b.bg, t);
  out.deep.copy(a.deep).lerp(b.deep, t);
  out.accent.copy(a.accent).lerp(b.accent, t);
  out.ink.copy(a.ink).lerp(b.ink, t);
  return out;
};

const damp = (a: number, b: number, lambda: number, dt: number) =>
  a + (b - a) * (1 - Math.exp(-lambda * dt));

const unitPlane = new THREE.PlaneGeometry(1, 1);
const WHITE = new THREE.Color(1, 1, 1);

function spriteMaterial(
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  opts: Partial<THREE.ShaderMaterialParameters> = {},
) {
  return new THREE.ShaderMaterial({
    vertexShader: S.spriteVertex,
    fragmentShader,
    uniforms,
    transparent: true,
    // Sprites test depth (never write it) so a 3D bottle correctly occludes what sits behind it
    depthTest: true,
    depthWrite: false,
    ...opts,
  });
}

function quad(material: THREE.ShaderMaterial, order: number) {
  const m = new THREE.Mesh(unitPlane, material);
  m.renderOrder = order;
  m.frustumCulled = false;
  m.visible = false;
  return m;
}

type Rect = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  top: number;
  bottom: number;
  onScreen: boolean;
  /** The anchor element, and when it mounted (performance.now) */
  el: HTMLElement;
  mountedAt: number;
};

function rectOf(a: Anchor, vw: number, vh: number): Rect {
  const r = a.el.getBoundingClientRect();
  return {
    cx: r.left + r.width / 2 - vw / 2,
    cy: vh / 2 - (r.top + r.height / 2),
    w: r.width,
    h: r.height,
    top: r.top,
    bottom: r.bottom,
    onScreen: r.bottom > 0 && r.top < vh,
    el: a.el,
    mountedAt: a.mountedAt,
  };
}

/* ---------------------------------------------------------------------------------------------- */

/** Everything drawn for one bottle. Shared palette uniforms keep all six in the same light. */
class BottleRig {
  readonly group = new THREE.Group();
  readonly bottle: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly mirror: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly aspect: number;
  ready = false;
  lift = 0;
  /** Higgsfield 3D model (when listed in model-manifest.ts) and its floor reflection */
  model: ModelInstance | null = null;
  modelMirror: ModelInstance | null = null;
  spin = 0;

  // Continuity across pages (the canvas outlives every route)
  /** The anchor element currently showing this bottle, and where it was last drawn from it.
   *  An element, not a key: two pages can mount anchors with the same key (the finder's result
   *  and the product page), and that is still a move to a new place. */
  source: HTMLElement | null = null;
  last: Placement | null = null;
  /** performance.now() seconds of the last frame drawn from an anchor */
  anchoredAt = -Infinity;
  /** A glide from where the bottle stood on the previous page to its new anchor */
  travel: { from: Placement; start: number } | null = null;
  /** 0..1: fades bottles in on a new page, and out where their page was taken away */
  presence = 1;
  leaving = false;
  private maps: Record<"uColor" | "uNormal" | "uMask", THREE.IUniform<THREE.Texture | null>>;

  constructor(
    readonly slug: string,
    shared: Record<string, THREE.IUniform>,
  ) {
    const meta = BOTTLE_META[slug];
    this.aspect = meta.trim.w / meta.trim.h;
    this.maps = { uColor: { value: null }, uNormal: { value: null }, uMask: { value: null } };
    const common = {
      ...shared,
      ...this.maps,
      uLift: { value: 0 },
      uCapTint: { value: new THREE.Color().setRGB(...meta.capTint, THREE.SRGBColorSpace) },
    };
    const bottleMaterial = (u: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: S.bottleVertex,
        fragmentShader: S.bottleFragment,
        uniforms: u,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
    this.bottle = quad(
      bottleMaterial({ ...common, uMirror: { value: 0 }, uOpacity: { value: 0 } }),
      6,
    );
    // The floor reflection shares textures, palette and light; only mirror/opacity differ
    this.mirror = quad(
      bottleMaterial({ ...common, uMirror: { value: 1 }, uOpacity: { value: 0 } }),
      5,
    );
    this.glow = quad(
      spriteMaterial(
        S.glowFragment,
        { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
        { blending: THREE.AdditiveBlending },
      ),
      2,
    );
    this.shadow = quad(spriteMaterial(S.shadowFragment, { uOpacity: { value: 0 } }), 4);
    this.group.add(this.glow, this.shadow, this.mirror, this.bottle);
  }

  setTextures(color: THREE.Texture, normal: THREE.Texture, mask: THREE.Texture) {
    this.maps.uColor.value = color;
    this.maps.uNormal.value = normal;
    this.maps.uMask.value = mask;
    this.ready = true;
  }

  setModel(model: ModelInstance, mirror: ModelInstance) {
    this.model = model;
    this.modelMirror = mirror;
    model.object.renderOrder = 6;
    mirror.object.renderOrder = 5;
    model.object.traverse((o) => (o.renderOrder = 6));
    mirror.object.traverse((o) => (o.renderOrder = 5));
    this.group.add(mirror.object, model.object);
    this.ready = true;
  }

  setVisible(v: boolean) {
    for (const c of this.group.children) c.visible = v;
    // With a 3D model, the photo planes are only the loading fallback
    if (this.model) {
      this.bottle.visible = false;
      this.mirror.visible = false;
    }
  }

  dispose() {
    this.model?.dispose();
    this.modelMirror?.dispose();
    for (const m of [this.bottle, this.mirror, this.glow, this.shadow]) m.material.dispose();
    for (const u of Object.values(this.maps)) u.value?.dispose();
  }
}

/** Giant fragrance name rendered to a texture in the real display face (Bodoni Moda). */
class Masthead {
  readonly uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uColor: { value: new THREE.Color() },
    uReveal: { value: 0 },
    uOpacity: { value: 0 },
  };
  readonly mesh = quad(spriteMaterial(S.mastheadFragment, this.uniforms), 1);
  aspect = 3;
  /** Rendered width in font-size units */
  ratio = 3;

  async draw(name: string) {
    const family =
      getComputedStyle(document.documentElement).getPropertyValue("--font-bodoni").trim() ||
      "serif";
    const px = 320;
    await document.fonts.load(`400 ${px}px ${family}`).catch(() => undefined);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `400 ${px}px ${family}`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(name).width + px * 0.3);
    const h = Math.ceil(px * 1.2);
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.fillText(name, w / 2, h * 0.86);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    this.uniforms.uMap.value = tex;
    this.aspect = w / h;
    this.ratio = w / px;
  }

  dispose() {
    this.uniforms.uMap.value?.dispose();
    this.mesh.material.dispose();
  }
}

/* ---------------------------------------------------------------------------------------------- */

/** Where one bottle is drawn this frame: CSS px, y up, relative to the viewport centre. */
type Placement = {
  cx: number;
  cy: number;
  /** Photo height (the width follows the bottle's aspect ratio) */
  ph: number;
  rotY: number;
  rotZ: number;
  opacity: number;
  /** 0..1 how "grounded" on the floor (drives reflection and shadow) */
  grounded: number;
  /** The anchor's resting base line: where the floor meets the bottle once it has landed */
  rest: number;
};

type Frame = {
  prod: (Rect & { slug?: string }) | null;
  cols: Map<number, Rect>;
  exp: Rect | null;
  s: number;
  k: number;
  vw: number;
  vh: number;
  dt: number;
};

const RESTING: Pose = { dx: 0, dy: 0, rotZ: 0, rotY: 0, scale: 1, opacity: 1, grounded: 1 };

/** How long a bottle takes to glide from one page's anchor to the next */
const TRAVEL_S = 1.1;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Between two placements. Scale moves evenly (log space); the floor stays at the destination. */
const mixPlacement = (a: Placement, b: Placement, t: number): Placement => ({
  cx: mix(a.cx, b.cx, t),
  cy: mix(a.cy, b.cy, t),
  ph: a.ph * Math.pow(b.ph / Math.max(a.ph, 1e-3), t),
  rotY: mix(a.rotY, b.rotY, t),
  rotZ: mix(a.rotZ, b.rotZ, t),
  opacity: mix(a.opacity, b.opacity, t),
  grounded: mix(a.grounded, b.grounded, t),
  rest: b.rest,
});

const withOpacity = (p: Placement, k: number): Placement =>
  k >= 0.999 ? p : { ...p, opacity: p.opacity * k };

/** The studio's key light: upper left, and it never moves */
const KEY_LIGHT = new THREE.Vector2(-0.45, 0.6);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The imperative heart of the stage. Owns all three.js objects and turns (scroll, anchors, hover)
 * into a frame. Kept outside React so per-frame mutation never touches React state.
 *
 * The light is still: nothing follows the pointer or runs on a clock. Bottles move only with
 * scroll, hover, drag and navigation.
 */
export class StageDirector {
  private palettes: LinPalette[];
  private current = toLinear(HOUSE_PALETTE);
  private target = toLinear(HOUSE_PALETTE);
  private shared: {
    uBg: THREE.IUniform<THREE.Color>;
    uDeep: THREE.IUniform<THREE.Color>;
    uAccent: THREE.IUniform<THREE.Color>;
    uLight: THREE.IUniform<THREE.Vector2>;
  };
  private world: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private haze: THREE.DataTexture;
  private rigs: BottleRig[];
  private mastheads: Masthead[];
  private floor = { y: 0.2, amount: 0 };
  private disposed = false;
  private scene: THREE.Scene | null = null;
  private library = new ModelLibrary();
  private notes = new Map<string, { inst: ModelInstance | null; seed: number }>();
  private keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
  private rimLight = new THREE.DirectionalLight(0xffffff, 0.8);

  constructor(private fragrances: StageFragrance[]) {
    this.palettes = [HOUSE_PALETTE, ...fragrances.map((f) => f.palette)].map(toLinear);
    this.shared = {
      uBg: { value: this.current.bg },
      uDeep: { value: this.current.deep },
      uAccent: { value: this.current.accent },
      uLight: { value: KEY_LIGHT.clone() },
    };
    const haze = S.bakeHaze();
    this.haze = new THREE.DataTexture(
      haze.data,
      haze.width,
      haze.height,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    this.haze.minFilter = THREE.LinearFilter;
    this.haze.magFilter = THREE.LinearFilter;
    this.haze.generateMipmaps = false;
    this.haze.needsUpdate = true;
    this.world = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: S.worldVertex,
        fragmentShader: S.worldFragment,
        uniforms: {
          uBg: this.shared.uBg,
          uDeep: this.shared.uDeep,
          uAccent: this.shared.uAccent,
          uFloorY: { value: 0.2 },
          uFloor: { value: 0 },
          uAspect: { value: 1 },
          uHaze: { value: this.haze },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.world.renderOrder = -10;
    this.world.frustumCulled = false;
    this.rigs = fragrances.map((f) => new BottleRig(f.slug, this.shared));
    this.mastheads = fragrances.map(() => new Masthead());
  }

  attach(scene: THREE.Scene, gl: THREE.WebGLRenderer) {
    this.scene = scene;
    scene.add(this.world, ...this.rigs.map((r) => r.group), ...this.mastheads.map((m) => m.mesh));
    this.fragrances.forEach((f, i) => void this.mastheads[i].draw(f.name));
    if (anyModels()) {
      // Real 3D models need physically based light: a studio environment for reflections, the
      // same fixed key light as the photos, and a rim light in the world's accent colour.
      scene.environment = studioEnvironment(gl);
      gl.toneMapping = THREE.AgXToneMapping;
      gl.toneMappingExposure = 1.05;
      this.keyLight.position.set(KEY_LIGHT.x, KEY_LIGHT.y, 0.85);
      this.rimLight.position.set(0.2, 0.5, -1);
      scene.add(this.keyLight, this.rimLight);
    }
  }

  detach(scene: THREE.Scene) {
    this.disposed = true;
    scene.remove(
      this.world,
      ...this.rigs.map((r) => r.group),
      ...this.mastheads.map((m) => m.mesh),
      this.keyLight,
      this.rimLight,
    );
    for (const n of this.notes.values()) {
      if (n.inst) scene.remove(n.inst.object);
      n.inst?.dispose();
    }
    this.notes.clear();
    scene.environment?.dispose();
    scene.environment = null;
    this.library.dispose();
    this.rigs.forEach((r) => r.dispose());
    this.mastheads.forEach((m) => m.dispose());
    this.world.material.dispose();
    this.world.geometry.dispose();
    this.haze.dispose();
  }

  /** Load textures: whatever is on screen first (product page / hero), then the rest in order. */
  async load(gl: THREE.WebGLRenderer) {
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const get = async (url: string, color: boolean) => {
      const t = await loader.loadAsync(url);
      if (color) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = aniso;
      } else {
        t.colorSpace = THREE.NoColorSpace;
        t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter;
      }
      return t;
    };
    const productSlug = [...anchors.values()].find((a) => a.kind === "product")?.slug;
    const order = [...this.rigs].sort(
      (a, b) => Number(b.slug === productSlug) - Number(a.slug === productSlug),
    );
    const idle = () =>
      new Promise<void>((r) =>
        "requestIdleCallback" in window
          ? window.requestIdleCallback(() => r(), { timeout: 800 })
          : setTimeout(r, 120),
      );
    for (const [n, rig] of order.entries()) {
      // Spread GPU uploads across idle periods so no single frame pays for all six bottles
      if (n > 0) await idle();
      if (this.disposed) return;
      const markReady = () => {
        stageState.bottleReady[this.rigs.indexOf(rig)] = true;
        document.documentElement.classList.add(`sr-${rig.slug}`);
        if (!stageState.ready) {
          stageState.ready = true;
          // two frames later the canvas has painted: crossfade the DOM fallbacks out
          requestAnimationFrame(() =>
            requestAnimationFrame(() => document.documentElement.classList.add("stage-ready")),
          );
        }
      };
      const entry = BOTTLE_MODELS[rig.slug];
      if (entry) {
        try {
          const src = await this.library.load(entry);
          if (this.disposed) return;
          const shoulder = BOTTLE_META[rig.slug]?.shoulder ?? 0.37;
          rig.setModel(
            instantiate(src, { bottle: { shoulder } }),
            instantiate(src, { bottle: { shoulder }, mirror: true }),
          );
          markReady();
          continue;
        } catch (err) {
          console.warn("[stage] 3D model failed, using the relit photo", rig.slug, err);
        }
      }
      const base = `/images/bottles/maps/${rig.slug}`;
      try {
        const [c, n, m] = await Promise.all([
          get(`${base}-color.webp`, true),
          get(`${base}-normal.webp`, false),
          get(`${base}-mask.webp`, false),
        ]);
        if (this.disposed) return;
        gl.initTexture(c);
        gl.initTexture(n);
        gl.initTexture(m);
        rig.setTextures(c, n, m);
        markReady();
      } catch (err) {
        console.warn("[stage] failed to load", rig.slug, err);
      }
    }
  }

  update(camera: THREE.PerspectiveCamera, vw: number, vh: number, time: number, delta: number) {
    const dt = Math.min(delta, 0.1);

    // Camera: 1 world unit = 1 CSS pixel at z = 0
    const dist = vh / 2 / Math.tan((FOV * DEG) / 2);
    if (Math.abs(camera.position.z - dist) > 0.5) {
      camera.position.z = dist;
      camera.far = dist * 4;
      camera.updateProjectionMatrix();
    }

    // Gather anchors
    let exp: Rect | null = null;
    let prod: (Rect & { slug?: string }) | null = null;
    let colSection: Rect | null = null;
    const cols = new Map<number, Rect>();
    for (const a of anchors.values()) {
      const r = rectOf(a, vw, vh);
      if (a.kind === "experience") exp = r;
      else if (a.kind === "product") prod = { ...r, slug: a.slug };
      else if (a.kind === "collection-section") colSection = r;
      else if (a.kind === "collection") cols.set(a.index, r);
    }

    // World palette: a slow wash towards whichever world is on screen. Inside the home
    // experience it follows the scrubbed scroll closely instead.
    const s = stageState.s;
    const k = stageState.k;
    const P = this.palettes;
    let rate = 3;
    if (prod) {
      const idx = this.fragrances.findIndex((f) => f.slug === prod!.slug);
      const p = P[idx + 1] ?? P[0];
      lerpPalette(this.target, p, p, 0);
    } else if (colSection && colSection.top < vh * 0.6) {
      lerpPalette(this.target, P[0], P[0], 0);
    } else if (exp) {
      const wb = worldBlend(s, k);
      lerpPalette(this.target, P[wb.from], P[wb.to], wb.t);
      lerpPalette(this.target, this.target, P[0], wb.house);
      rate = 14;
    } else {
      lerpPalette(this.target, P[0], P[0], 0);
    }
    const cur = this.current;
    lerpPalette(cur, cur, this.target, 1 - Math.exp(-rate * dt));
    const bgLum = cur.bg.r * 0.2126 + cur.bg.g * 0.7152 + cur.bg.b * 0.0722;
    const darkWorld = 1 - Math.min(1, Math.max(0, (bgLum - 0.02) / 0.3));

    this.rimLight.color.copy(cur.accent).lerp(WHITE, 0.2);
    this.rimLight.intensity = 0.5 + darkWorld * 1.0;
    const wu = this.world.material.uniforms;
    wu.uAspect.value = vw / vh;

    const frame: Frame = { prod, cols, exp, s, k, vw, vh, dt };
    const now = performance.now() / 1000;
    let floorY = this.floor.y;
    let floorAmt = 0;
    this.rigs.forEach((rig, i) => {
      const p = this.continuity(rig, this.place(rig, i, frame), now, dt);
      const visible = !!p && p.opacity > 0.001 && rig.ready;
      rig.setVisible(visible);
      if (!visible || !p) return;
      const g = this.draw(rig, p, cur, darkWorld);
      // The home experience and product pages stand their bottles on a floor; the collection
      // has none, and a bottle dissolving off a page it has left doesn't bring its floor along
      if (g > floorAmt && !cols.get(i)?.onScreen && !rig.leaving) {
        floorAmt = g;
        floorY = (p.rest + vh / 2) / vh;
      }
    });

    this.floor.y = damp(this.floor.y, floorY, 10, dt);
    this.floor.amount = damp(this.floor.amount, floorAmt, 6, dt);
    wu.uFloorY.value = this.floor.y;
    wu.uFloor.value = this.floor.amount;

    // Mastheads (home experience only)
    this.mastheads.forEach((m, i) => {
      if (!exp?.onScreen || !m.uniforms.uMap.value) {
        m.mesh.visible = false;
        return;
      }
      const ms = mastheadState(s, i, k);
      if (ms.opacity <= 0.001) {
        m.mesh.visible = false;
        return;
      }
      const fontPx = Math.min(vw * (vw < 768 ? 0.27 : 0.2), exp.h * 0.55);
      const w = Math.min(vw * 0.96, fontPx * m.ratio);
      const h = w / m.aspect;
      m.mesh.visible = true;
      m.mesh.position.set(
        exp.cx,
        exp.cy + exp.h * 0.02 + ms.lift * exp.h,
        -Math.max(80, exp.h * 0.6),
      );
      m.mesh.scale.set(w, h, 1);
      m.uniforms.uReveal.value = ms.reveal;
      m.uniforms.uOpacity.value = ms.opacity * 0.92;
      m.uniforms.uColor.value.copy(P[i + 1].ink);
    });

    this.updateNotes(vw, vh, s, k);
  }

  /**
   * Carries a bottle across pages. The canvas outlives every route, so:
   *  - when a visible bottle changes anchor (a navigation, or a jump to another section), it glides
   *    from where it stood to its new place
   *  - when its page is taken away from under it, it dissolves where it stood
   *  - on a page that has only just mounted, with nothing to glide from, it fades in
   * Scrolling never moves a visible bottle to another anchor, so normal browsing is unaffected.
   */
  private continuity(
    rig: BottleRig,
    hit: { p: Placement; rect: Rect } | null,
    now: number,
    dt: number,
  ): Placement | null {
    if (hit) {
      if (rig.source !== hit.rect.el) {
        const from = rig.last;
        const recent = !!from && from.opacity > 0.5 && now - rig.anchoredAt < 0.6;
        rig.travel = recent && from ? { from, start: now } : null;
        if (!recent && now * 1000 - hit.rect.mountedAt < 1000) rig.presence = 0;
        rig.source = hit.rect.el;
        rig.leaving = false;
      }
      let p = hit.p;
      if (rig.travel) {
        const t = (now - rig.travel.start) / TRAVEL_S;
        if (t >= 1) rig.travel = null;
        else p = mixPlacement(rig.travel.from, p, easeInOutCubic(t));
      }
      rig.presence = damp(rig.presence, 1, 5, dt);
      rig.last = p;
      rig.anchoredAt = now;
      return withOpacity(p, rig.presence);
    }
    if (rig.source) {
      // Its anchor is gone: unmounted while the bottle was on screen means the page changed
      const unmounted = !rig.source.isConnected;
      rig.leaving = unmounted && !!rig.last && rig.last.opacity > 0.5 && now - rig.anchoredAt < 0.3;
      rig.source = null;
      rig.travel = null;
    }
    if (rig.leaving && rig.last) {
      rig.presence = damp(rig.presence, 0, 6, dt);
      if (rig.presence > 0.01) return withOpacity(rig.last, rig.presence);
      rig.leaving = false;
    }
    return null;
  }

  /** Where rig i belongs this frame, from whichever anchor is showing it (or null). */
  private place(rig: BottleRig, i: number, f: Frame): { p: Placement; rect: Rect } | null {
    let rect: Rect;
    let pose: Pose;
    const col = f.cols.get(i);
    if (f.prod && f.prod.slug === rig.slug) {
      rect = f.prod;
      pose = RESTING;
      rig.lift = damp(rig.lift, 0, 4, f.dt);
      // A 3D bottle turns only when the visitor drags it; left alone, it stays still
      rig.spin = damp(rig.spin, stageState.spin, 5, f.dt);
    } else if (col?.onScreen) {
      rect = col;
      // Bottles settle gently into the line-up as it scrolls in
      const e = clamp01((f.vh - rect.top) / (f.vh * 0.45));
      const rise = e * e * (3 - 2 * e);
      rig.lift = damp(rig.lift, stageState.collectionHover === i ? 1 : 0, 4, f.dt);
      pose = {
        dx: 0,
        dy: -(1 - rise) * 56 + rig.lift * rect.h * 0.04,
        rotZ: 0,
        rotY: rig.lift * 4 * DEG,
        scale: 1 + rig.lift * 0.02,
        opacity: rise,
        grounded: rise * (1 - rig.lift * 0.6),
      };
      rig.spin = damp(rig.spin, rig.lift * 0.5, 4, f.dt);
    } else if (f.exp?.onScreen) {
      rect = f.exp;
      pose = bottlePose(f.s, i, f.k, f.vw, f.vh);
      rig.lift = damp(rig.lift, 0, 4, f.dt);
      // A scrubbed turntable for 3D bottles: each turns through ~40° across its chapter
      rig.spin = (chapterProgress(f.s, i, f.k) - 0.5) * 0.7;
    } else return null;

    // Fit the photo inside the anchor (object-contain), never distorted
    const fit = Math.min(rect.h, rect.w / rig.aspect);
    const p: Placement = {
      cx: rect.cx + pose.dx,
      cy: rect.cy + pose.dy,
      ph: fit * pose.scale,
      rotY: pose.rotY,
      rotZ: pose.rotZ,
      opacity: pose.opacity,
      grounded: pose.grounded,
      rest: rect.cy - fit / 2,
    };
    return { p, rect };
  }

  /** Draws a rig at a placement. Returns how grounded it is, for the world floor. */
  private draw(rig: BottleRig, p: Placement, cur: LinPalette, darkWorld: number) {
    const ph = p.ph;
    const pw = ph * rig.aspect;
    const base = p.cy - ph / 2;
    const upright = Math.max(0, 1 - Math.abs(p.rotZ) / (10 * DEG));
    const g = p.grounded * upright;

    if (rig.model && rig.modelMirror) {
      const entry = BOTTLE_MODELS[rig.slug];
      const rotY = rig.spin + p.rotY;
      const m = rig.model.object;
      m.position.set(p.cx, base, 0);
      m.rotation.set(0, rotY, p.rotZ);
      m.scale.setScalar(ph);
      rig.model.setOpacity(p.opacity);
      const mm = rig.modelMirror.object;
      mm.position.set(p.cx, base, 0);
      mm.rotation.set(0, rotY, -p.rotZ);
      mm.scale.set(ph, -ph, ph);
      mm.visible = g > 0.01;
      rig.modelMirror.uniforms.uFloorY.value = base;
      rig.modelMirror.uniforms.uFadeH.value = ph * 0.4;
      rig.modelMirror.setOpacity(p.opacity * g);
      // sprites follow the model's real footprint
      if (entry)
        rig.glow.scale.set(ph * Math.max(entry.size[0], entry.size[2]) * 2.4, ph * 1.45, 1);
    }

    const bu = rig.bottle.material.uniforms;
    rig.bottle.position.set(p.cx, p.cy, 0);
    rig.bottle.rotation.set(0, p.rotY, p.rotZ);
    rig.bottle.scale.set(pw, ph, 1);
    bu.uOpacity.value = p.opacity;
    bu.uLift.value = rig.lift;

    rig.mirror.position.set(p.cx, base - ph / 2, 0);
    rig.mirror.rotation.set(0, p.rotY, -p.rotZ);
    rig.mirror.scale.set(pw, ph, 1);
    rig.mirror.material.uniforms.uOpacity.value = p.opacity * g;

    rig.glow.position.set(p.cx, p.cy + ph * 0.04, -ph * 0.6);
    if (!rig.model) rig.glow.scale.set(pw * 2.4, ph * 1.45, 1);
    const glowU = rig.glow.material.uniforms;
    glowU.uColor.value.copy(cur.accent).lerp(WHITE, 0.25);
    glowU.uOpacity.value = p.opacity * (0.03 + darkWorld * 0.12) * (1 + rig.lift * 0.15);

    rig.shadow.position.set(p.cx, base + ph * 0.01, rig.model ? -ph * 0.35 : -2);
    rig.shadow.scale.set(pw * 1.35, ph * 0.1, 1);
    rig.shadow.material.uniforms.uOpacity.value = p.opacity * g * (0.55 - darkWorld * 0.2);
    return g;
  }

  /**
   * 3D notes: every DOM note in the chapters is an anchor. When a Higgsfield model exists for that
   * ingredient, it is drawn exactly where the DOM note is (so the GSAP arrive / recede / scatter
   * choreography and the depth parallax carry over), turning slowly as the visitor scrolls.
   */
  private updateNotes(vw: number, vh: number, s: number, k: number) {
    if (!this.scene || !Object.keys(NOTE_MODELS).length) return;
    const active = chapterAt(s, k);
    const seen = new Set<string>();
    for (const [key, a] of anchors) {
      if (a.kind !== "note" || !a.slug) continue;
      const entry = NOTE_MODELS[a.slug];
      if (!entry) continue;
      seen.add(key);
      let rec = this.notes.get(key);
      if (!rec) {
        // Load only around the current chapter (this also preloads the next one)
        if (Math.abs(active - a.index) > 1) continue;
        const record = { inst: null as ModelInstance | null, seed: hash(key) };
        rec = record;
        this.notes.set(key, record);
        void this.library.load(entry).then((src) => {
          if (this.disposed || !this.notes.has(key)) return;
          record.inst = instantiate(src);
          record.inst.object.traverse((o) => (o.renderOrder = 7));
          this.scene?.add(record.inst.object);
        });
      }
      const inst = rec.inst;
      if (!inst) continue;
      const r = rectOf(a, vw, vh);
      const opacity = domOpacity(a.el) * (a.el.dataset.far ? 0.6 : 1);
      const visible = r.onScreen && opacity > 0.01;
      inst.object.visible = visible;
      if (!visible) continue;
      const size = Math.min(r.h, r.w / Math.max(entry.size[0], entry.size[2], 0.01)) * 0.92;
      inst.object.position.set(r.cx, r.cy - size / 2, 0);
      inst.object.scale.setScalar(size);
      inst.object.rotation.set(
        (rec.seed - 0.5) * 0.16,
        rec.seed * 6.283 + s * 0.004,
        (rec.seed - 0.5) * 0.1,
      );
      inst.setOpacity(opacity);
      if (a.el.dataset.ready !== "true") a.el.dataset.ready = "true";
    }
    for (const [key, rec] of this.notes)
      if (!seen.has(key)) {
        if (rec.inst) {
          this.scene.remove(rec.inst.object);
          rec.inst.dispose();
        }
        this.notes.delete(key);
      }
  }
}

/** Product of the inline opacities GSAP writes on the anchor's ancestors, up to its chapter. */
function domOpacity(el: HTMLElement) {
  let o = 1;
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    if (n.style.visibility === "hidden") return 0;
    if (n.style.opacity !== "") o *= parseFloat(n.style.opacity);
    if (n.dataset.chapter !== undefined) break;
  }
  return o;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}
