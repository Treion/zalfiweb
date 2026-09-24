import * as THREE from "three";
import type { Palette } from "@/lib/fragrance";
import { anchors, type Anchor } from "./anchors";
import { BOTTLE_META } from "./bottle-meta";
import { bottlePose, chapterProgress, mastheadState, worldBlend, type Pose } from "./choreography";
import { chapterAt } from "./config";
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
  readonly caustics: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly aspect: number;
  ready = false;
  lift = 0;
  /** Higgsfield 3D model (when listed in model-manifest.ts) and its floor reflection */
  model: ModelInstance | null = null;
  modelMirror: ModelInstance | null = null;
  spin = 0;
  private maps: Record<"uColor" | "uNormal" | "uMask", THREE.IUniform<THREE.Texture | null>>;

  constructor(
    readonly slug: string,
    shared: Record<string, THREE.IUniform>,
    tier: Tier,
  ) {
    const meta = BOTTLE_META[slug];
    this.aspect = meta.trim.w / meta.trim.h;
    this.maps = { uColor: { value: null }, uNormal: { value: null }, uMask: { value: null } };
    const common = {
      ...shared,
      ...this.maps,
      uLift: { value: 0 },
      uEnvShift: { value: 0 },
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
      bottleMaterial({
        ...common,
        uMirror: { value: 0 },
        uOpacity: { value: 0 },
        uSweep: { value: 0 },
      }),
      6,
    );
    // The floor reflection shares textures, palette and light; only mirror/opacity differ
    this.mirror = quad(
      bottleMaterial({
        ...common,
        uMirror: { value: 1 },
        uOpacity: { value: 0 },
        uSweep: { value: 0 },
      }),
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
    this.caustics = quad(
      spriteMaterial(
        S.causticsFragment,
        { uColor: shared.uAccent, uOpacity: { value: 0 }, uTime: shared.uTime },
        { blending: THREE.AdditiveBlending },
      ),
      3,
    );
    this.group.add(this.glow, this.shadow, this.mirror, this.bottle);
    if (tier === "high") this.group.add(this.caustics);
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
    for (const m of [this.bottle, this.mirror, this.glow, this.shadow, this.caustics])
      m.material.dispose();
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

/**
 * The imperative heart of the stage. Owns all three.js objects and turns (scroll, anchors,
 * pointer) into a frame. Kept outside React so per-frame mutation never touches React state.
 */
export class StageDirector {
  private palettes: LinPalette[];
  private current = toLinear(HOUSE_PALETTE);
  private target = toLinear(HOUSE_PALETTE);
  private shared: {
    uBg: THREE.IUniform<THREE.Color>;
    uDeep: THREE.IUniform<THREE.Color>;
    uAccent: THREE.IUniform<THREE.Color>;
    uTime: THREE.IUniform<number>;
    uLight: THREE.IUniform<THREE.Vector2>;
  };
  private world: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private rigs: BottleRig[];
  private mastheads: Masthead[];
  private pointer = { x: 0, y: 0 };
  private floor = { y: 0.2, amount: 0 };
  private disposed = false;
  private scene: THREE.Scene | null = null;
  private library = new ModelLibrary();
  private notes = new Map<string, { inst: ModelInstance | null; seed: number }>();
  private keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  private rimLight = new THREE.DirectionalLight(0xffffff, 1.2);

  constructor(
    private fragrances: StageFragrance[],
    private tier: Tier,
  ) {
    this.palettes = [HOUSE_PALETTE, ...fragrances.map((f) => f.palette)].map(toLinear);
    this.shared = {
      uBg: { value: this.current.bg },
      uDeep: { value: this.current.deep },
      uAccent: { value: this.current.accent },
      uTime: { value: 0 },
      uLight: { value: new THREE.Vector2(-0.5, 0.55) },
    };
    this.world = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: S.worldVertex,
        fragmentShader: S.worldFragment,
        uniforms: {
          uBg: this.shared.uBg,
          uDeep: this.shared.uDeep,
          uAccent: this.shared.uAccent,
          uTime: this.shared.uTime,
          uFloorY: { value: 0.2 },
          uFloor: { value: 0 },
          uAspect: { value: 1 },
          uPointer: { value: new THREE.Vector2() },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.world.renderOrder = -10;
    this.world.frustumCulled = false;
    this.rigs = fragrances.map((f) => new BottleRig(f.slug, this.shared, tier));
    this.mastheads = fragrances.map(() => new Masthead());
  }

  attach(scene: THREE.Scene, gl: THREE.WebGLRenderer) {
    this.scene = scene;
    scene.add(this.world, ...this.rigs.map((r) => r.group), ...this.mastheads.map((m) => m.mesh));
    this.fragrances.forEach((f, i) => void this.mastheads[i].draw(f.name));
    if (anyModels()) {
      // Real 3D models need physically based light: a studio environment for reflections, a key
      // light that follows the pointer, and a rim light in the world's accent colour.
      scene.environment = studioEnvironment(gl);
      gl.toneMapping = THREE.AgXToneMapping;
      gl.toneMappingExposure = 1.05;
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
    const t = time;
    this.shared.uTime.value = t;

    // Camera: 1 world unit = 1 CSS pixel at z = 0
    const dist = vh / 2 / Math.tan((FOV * DEG) / 2);
    if (Math.abs(camera.position.z - dist) > 0.5) {
      camera.position.z = dist;
      camera.far = dist * 4;
      camera.updateProjectionMatrix();
    }

    this.pointer.x = damp(this.pointer.x, stageState.pointer.x, 4, dt);
    this.pointer.y = damp(this.pointer.y, stageState.pointer.y, 4, dt);
    const px = this.pointer.x;
    const py = this.pointer.y;

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

    // World palette
    const s = stageState.s;
    const k = stageState.k;
    const P = this.palettes;
    let rate = 5;
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

    this.shared.uLight.value.set(-0.5 + px * 0.75, 0.55 + py * 0.4);
    this.keyLight.position.set(-0.5 + px * 0.75, 0.55 + py * 0.4, 0.85);
    this.rimLight.color.copy(cur.accent).lerp(WHITE, 0.2);
    this.rimLight.intensity = 0.8 + darkWorld * 2.2;
    const wu = this.world.material.uniforms;
    wu.uAspect.value = vw / vh;
    wu.uPointer.value.set(px, py);

    let floorY = this.floor.y;
    let floorAmt = 0;

    this.rigs.forEach((rig, i) => {
      let rect: Rect | null = null;
      let pose: Pose | null = null;
      let tiltX = -py * 3 * DEG;
      let tiltY = px * 6 * DEG;

      if (prod && prod.slug === rig.slug) {
        rect = prod;
        pose = {
          dx: 0,
          dy: 0,
          rotZ: 0,
          rotY: 0,
          scale: 1,
          opacity: 1,
          // a slow light pass across the glass every 8 seconds
          sweep: t % 8 < 2.2 ? ((t % 8) / 2.2) * 1.2 : 0,
          grounded: 1,
        };
        tiltY = px * 11 * DEG;
        tiltX = -py * 5 * DEG;
        // drag to turn (stageState.spin), with a slow breathing turn when left alone
        rig.spin = damp(rig.spin, stageState.spin + Math.sin(t * 0.35) * 0.3, 5, dt);
      } else if (cols.get(i)?.onScreen) {
        rect = cols.get(i)!;
        const e = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.45)));
        const rise = e * e * (3 - 2 * e);
        rig.lift = damp(rig.lift, stageState.collectionHover === i ? 1 : 0, 7, dt);
        pose = {
          dx: 0,
          dy: -(1 - rise) * 140 + rig.lift * rect.h * 0.06,
          rotZ: 0,
          rotY: rig.lift * 8 * DEG,
          scale: 1 + rig.lift * 0.03,
          opacity: rise,
          sweep: rig.lift > 0.02 && rig.lift < 0.98 ? rig.lift * 1.2 : 0,
          grounded: rise * (1 - rig.lift * 0.6),
        };
        tiltY = px * 5 * DEG;
        rig.spin = damp(rig.spin, rig.lift * 0.9 + Math.sin(t * 0.4 + i) * 0.12, 6, dt);
      } else if (exp?.onScreen) {
        rect = exp;
        pose = bottlePose(s, i, k, vw, vh);
        // a scrubbed turntable: each bottle turns through ~70° across its chapter
        rig.spin = (chapterProgress(s, i, k) - 0.5) * 1.2;
      }

      const visible = !!rect && !!pose && pose.opacity > 0.001 && rig.ready;
      rig.setVisible(visible);
      if (!visible || !rect || !pose) return;

      // Fit the photo inside the anchor (object-contain), never distorted
      const ph = Math.min(rect.h, rect.w / rig.aspect) * pose.scale;
      const pw = ph * rig.aspect;
      const cx = rect.cx + pose.dx;
      const cy = rect.cy + pose.dy;
      const base = cy - ph / 2;

      const upright3 = Math.max(0, 1 - Math.abs(pose.rotZ) / (10 * DEG));
      if (rig.model && rig.modelMirror) {
        const entry = BOTTLE_MODELS[rig.slug];
        const g3 = pose.grounded * upright3;
        const rotY = rig.spin + pose.rotY + tiltY;
        const m = rig.model.object;
        m.position.set(cx, base, 0);
        m.rotation.set(tiltX * 0.6, rotY, pose.rotZ);
        m.scale.setScalar(ph);
        rig.model.setOpacity(pose.opacity);
        const mm = rig.modelMirror.object;
        mm.position.set(cx, base, 0);
        mm.rotation.set(-tiltX * 0.6, rotY, -pose.rotZ);
        mm.scale.set(ph, -ph, ph);
        mm.visible = g3 > 0.01;
        rig.modelMirror.uniforms.uFloorY.value = base;
        rig.modelMirror.uniforms.uFadeH.value = ph * 0.4;
        rig.modelMirror.setOpacity(pose.opacity * g3);
        if (entry) {
          // sprites follow the model's real footprint
          const w3 = ph * Math.max(entry.size[0], entry.size[2]);
          rig.glow.scale.set(w3 * 2.4, ph * 1.45, 1);
        }
      }

      const bu = rig.bottle.material.uniforms;
      rig.bottle.position.set(cx, cy, 0);
      rig.bottle.rotation.set(tiltX, pose.rotY + tiltY, pose.rotZ);
      rig.bottle.scale.set(pw, ph, 1);
      bu.uOpacity.value = pose.opacity;
      bu.uSweep.value = pose.sweep;
      bu.uLift.value = rig.lift;
      bu.uEnvShift.value = px * 0.9 + (pose.rotY + tiltY) * 3.2;

      const upright = Math.max(0, 1 - Math.abs(pose.rotZ) / (10 * DEG));
      const g = pose.grounded * upright;
      rig.mirror.position.set(cx, base - ph / 2, 0);
      rig.mirror.rotation.set(-tiltX, pose.rotY + tiltY, -pose.rotZ);
      rig.mirror.scale.set(pw, ph, 1);
      rig.mirror.material.uniforms.uOpacity.value = pose.opacity * g;

      rig.glow.position.set(cx, cy + ph * 0.04, -ph * 0.6);
      if (!rig.model) rig.glow.scale.set(pw * 2.4, ph * 1.45, 1);
      const glowU = rig.glow.material.uniforms;
      glowU.uColor.value.copy(cur.accent).lerp(WHITE, 0.25);
      glowU.uOpacity.value = pose.opacity * (0.035 + darkWorld * 0.16) * (1 + rig.lift * 0.5);

      rig.shadow.position.set(cx, base + ph * 0.01, rig.model ? -ph * 0.35 : -2);
      rig.shadow.scale.set(pw * 1.35, ph * 0.1, 1);
      rig.shadow.material.uniforms.uOpacity.value = pose.opacity * g * (0.55 - darkWorld * 0.2);

      rig.caustics.position.set(cx + pw * 0.42, base - ph * 0.035, rig.model ? -ph * 0.35 : -1);
      rig.caustics.scale.set(pw * 1.7, ph * 0.18, 1);
      rig.caustics.material.uniforms.uOpacity.value =
        pose.opacity * g * (0.12 + darkWorld * 0.3 + (pose.sweep > 0 ? 0.2 : 0));

      if (g > floorAmt && !cols.get(i)?.onScreen) {
        floorAmt = g;
        floorY = (base + vh / 2) / vh;
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
        exp.cx - px * 14,
        exp.cy + exp.h * 0.02 + ms.lift * exp.h,
        -Math.max(80, exp.h * 0.6),
      );
      m.mesh.scale.set(w, h, 1);
      m.uniforms.uReveal.value = ms.reveal;
      m.uniforms.uOpacity.value = ms.opacity * 0.92;
      m.uniforms.uColor.value.copy(P[i + 1].ink);
    });

    this.updateNotes(vw, vh, t, px, py, s, k);
  }

  /**
   * 3D notes: every DOM note in the chapters is an anchor. When a Higgsfield model exists for that
   * ingredient, it is drawn exactly where the DOM note is (so the GSAP arrive / recede / scatter
   * choreography and the depth parallax carry over), turning slowly in the stage's light.
   */
  private updateNotes(
    vw: number,
    vh: number,
    t: number,
    px: number,
    py: number,
    s: number,
    k: number,
  ) {
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
        Math.sin(t * 0.5 + rec.seed) * 0.08 - py * 0.12,
        t * 0.32 + rec.seed * 6.283 + px * 0.35,
        Math.sin(t * 0.4 + rec.seed * 3) * 0.05,
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
