"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "@/components/motion/gsap";
import type { Palette } from "@/lib/fragrance";
import { anchors, type Anchor } from "./anchors";
import { BOTTLE_META } from "./bottle-meta";
import { bottlePose, mastheadState, worldBlend, type Pose } from "./choreography";
import * as S from "./shaders";
import { stageState } from "./stage-state";
import { HOUSE_PALETTE, type StageFragrance } from "./worlds";

type Tier = "high" | "low";
const DEG = Math.PI / 180;
const FOV = 30;

/**
 * The persistent WebGL stage. One fixed canvas behind the page draws:
 *   the world background → giant fragrance names → back glow → caustics → contact shadow →
 *   floor reflection → the relit bottle photo.
 * It renders only while a stage anchor is on screen, driven by gsap.ticker so it is frame-locked
 * with Lenis and ScrollTrigger.
 */
export default function Stage({ fragrances }: { fragrances: StageFragrance[] }) {
  const tier: Tier = useMemo(
    () =>
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? "low" : "high",
    [],
  );
  const layer = useRef<HTMLDivElement>(null);
  return (
    <div ref={layer} aria-hidden className="stage-layer pointer-events-none fixed inset-0 -z-10">
      <Canvas
        frameloop="never"
        flat
        dpr={tier === "high" ? [1, 2] : [1, 1.5]}
        gl={{
          antialias: tier === "high",
          alpha: false,
          depth: false,
          stencil: false,
          powerPreference: "high-performance",
        }}
        camera={{ fov: FOV, near: 1, far: 30000, position: [0, 0, 1500] }}
      >
        <Scene fragrances={fragrances} tier={tier} layer={layer} />
      </Canvas>
    </div>
  );
}

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

const unitPlane = new THREE.PlaneGeometry(1, 1);

function shader(
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  opts: Partial<THREE.ShaderMaterialParameters> = {},
) {
  return new THREE.ShaderMaterial({
    vertexShader: S.spriteVertex,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    ...opts,
  });
}

function mesh(material: THREE.Material, order: number) {
  const m = new THREE.Mesh(unitPlane, material);
  m.renderOrder = order;
  m.frustumCulled = false;
  m.visible = false;
  return m;
}

/** Everything drawn for one bottle. Shared palette uniforms keep all six in the same light. */
function createRig(slug: string, shared: Record<string, THREE.IUniform>, tier: Tier) {
  const meta = BOTTLE_META[slug];
  const bottleUniforms = {
    ...shared,
    uColor: { value: null as THREE.Texture | null },
    uNormal: { value: null as THREE.Texture | null },
    uMask: { value: null as THREE.Texture | null },
    uOpacity: { value: 0 },
    uMirror: { value: 0 },
    uSweep: { value: 0 },
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
  const bottleMat = bottleMaterial(bottleUniforms);
  // The floor reflection shares textures, palette and light; only mirror/opacity differ
  const mirrorMat = bottleMaterial({
    ...bottleUniforms,
    uMirror: { value: 1 },
    uOpacity: { value: 0 },
    uSweep: { value: 0 },
  });

  const glowMat = shader(
    S.glowFragment,
    { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } },
    { blending: THREE.AdditiveBlending },
  );
  const shadowMat = shader(S.shadowFragment, { uOpacity: { value: 0 } });
  const causticsMat = shader(
    S.causticsFragment,
    { uColor: shared.uAccent, uOpacity: { value: 0 }, uTime: shared.uTime },
    { blending: THREE.AdditiveBlending },
  );

  const group = new THREE.Group();
  const glow = mesh(glowMat, 2);
  const caustics = mesh(causticsMat, 3);
  const shadow = mesh(shadowMat, 4);
  const mirror = mesh(mirrorMat, 5);
  const bottle = mesh(bottleMat, 6);
  group.add(glow, shadow, mirror, bottle);
  if (tier === "high") group.add(caustics);

  return {
    slug,
    aspect: meta.trim.w / meta.trim.h,
    group,
    bottle,
    mirror,
    glow,
    shadow,
    caustics,
    ready: false,
    lift: 0,
    setTextures(color: THREE.Texture, normal: THREE.Texture, mask: THREE.Texture) {
      bottleUniforms.uColor.value = color;
      bottleUniforms.uNormal.value = normal;
      bottleUniforms.uMask.value = mask;
      this.ready = true;
    },
    dispose() {
      [bottleMat, mirrorMat, glowMat, shadowMat, causticsMat].forEach((m) => m.dispose());
      [bottleUniforms.uColor, bottleUniforms.uNormal, bottleUniforms.uMask].forEach((u) =>
        u.value?.dispose(),
      );
    },
  };
}

/** Giant fragrance name rendered to a texture in the real display face (Bodoni Moda). */
function createMasthead() {
  const uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uColor: { value: new THREE.Color() },
    uReveal: { value: 0 },
    uOpacity: { value: 0 },
  };
  const m = mesh(shader(S.mastheadFragment, uniforms), 1);
  return { mesh: m, uniforms, aspect: 3, ratio: 3 };
}
type Masthead = ReturnType<typeof createMasthead>;

async function drawName(name: string, target: Masthead) {
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-bodoni").trim() || "serif";
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
  target.uniforms.uMap.value = tex;
  target.aspect = w / h;
  target.ratio = w / px; // width in font-size units
}

function rectOf(a: Anchor, vw: number, vh: number) {
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
type Rect = ReturnType<typeof rectOf>;

const damp = (a: number, b: number, lambda: number, dt: number) =>
  a + (b - a) * (1 - Math.exp(-lambda * dt));

/* ---------------------------------------------------------------------------------------------- */

function Scene({
  fragrances,
  tier,
  layer,
}: {
  fragrances: StageFragrance[];
  tier: Tier;
  layer: React.RefObject<HTMLDivElement | null>;
}) {
  const { scene, camera, gl, advance } = useThree();

  const palettes = useMemo(
    () => [HOUSE_PALETTE, ...fragrances.map((f) => f.palette)].map(toLinear),
    [fragrances],
  );
  const current = useMemo(() => toLinear(HOUSE_PALETTE), []);
  const target = useMemo(() => toLinear(HOUSE_PALETTE), []);

  const shared = useMemo(
    () => ({
      uBg: { value: current.bg },
      uDeep: { value: current.deep },
      uAccent: { value: current.accent },
      uTime: { value: 0 },
      uLight: { value: new THREE.Vector2(-0.5, 0.55) },
    }),
    [current],
  );

  const world = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: S.worldVertex,
        fragmentShader: S.worldFragment,
        uniforms: {
          uBg: shared.uBg,
          uDeep: shared.uDeep,
          uAccent: shared.uAccent,
          uTime: shared.uTime,
          uFloorY: { value: 0.2 },
          uFloor: { value: 0 },
          uAspect: { value: 1 },
          uPointer: { value: new THREE.Vector2() },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    m.renderOrder = -10;
    m.frustumCulled = false;
    return m;
  }, [shared]);

  const rigs = useMemo(
    () => fragrances.map((f) => createRig(f.slug, shared, tier)),
    [fragrances, shared, tier],
  );
  const mastheads = useMemo(() => fragrances.map(() => createMasthead()), [fragrances]);

  const pointer = useRef({ x: 0, y: 0 });
  const floor = useRef({ y: 0.2, amount: 0 });

  // Build the scene graph
  useEffect(() => {
    scene.add(world, ...rigs.map((r) => r.group), ...mastheads.map((m) => m.mesh));
    return () => {
      scene.remove(world, ...rigs.map((r) => r.group), ...mastheads.map((m) => m.mesh));
      rigs.forEach((r) => r.dispose());
      mastheads.forEach((m) => {
        m.uniforms.uMap.value?.dispose();
        (m.mesh.material as THREE.Material).dispose();
      });
      (world.material as THREE.Material).dispose();
    };
  }, [scene, world, rigs, mastheads]);

  // Load textures: whatever is on screen first (product page / hero), then the rest in order
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const load = async (url: string, color: boolean) => {
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
    const order = [...rigs].sort(
      (a, b) => Number(b.slug === productSlug) - Number(a.slug === productSlug),
    );
    (async () => {
      for (const rig of order) {
        const base = `/images/bottles/maps/${rig.slug}`;
        try {
          const [c, n, m] = await Promise.all([
            load(`${base}-color.webp`, true),
            load(`${base}-normal.webp`, false),
            load(`${base}-mask.webp`, false),
          ]);
          if (cancelled) return;
          gl.initTexture(c);
          gl.initTexture(n);
          gl.initTexture(m);
          rig.setTextures(c, n, m);
          stageState.bottleReady[rigs.indexOf(rig)] = true;
          document.documentElement.classList.add(`sr-${rig.slug}`);
          if (!stageState.ready) {
            stageState.ready = true;
            // two frames later the canvas has painted: crossfade DOM fallbacks out
            requestAnimationFrame(() =>
              requestAnimationFrame(() => document.documentElement.classList.add("stage-ready")),
            );
          }
        } catch (err) {
          console.warn("[stage] failed to load", rig.slug, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rigs, gl]);

  // Mastheads in the real display font
  useEffect(() => {
    fragrances.forEach((f, i) => void drawName(f.name, mastheads[i]));
  }, [fragrances, mastheads]);

  // Frame-lock rendering to gsap.ticker (after Lenis has updated scroll), and only when needed
  useEffect(() => {
    const tick = (time: number) => {
      const vh = window.innerHeight;
      let visible = false;
      for (const a of anchors.values()) {
        const r = a.el.getBoundingClientRect();
        if (r.bottom > -vh * 0.25 && r.top < vh * 1.25) {
          visible = true;
          break;
        }
      }
      if (layer.current) layer.current.style.visibility = visible ? "visible" : "hidden";
      if (visible && !document.hidden) advance(time * 1000);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [advance, layer]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const vw = state.size.width;
    const vh = state.size.height;
    const t = state.clock.elapsedTime;
    shared.uTime.value = t;

    // Camera: 1 world unit = 1 CSS pixel at z = 0
    const cam = camera as THREE.PerspectiveCamera;
    const dist = vh / 2 / Math.tan((FOV * DEG) / 2);
    if (Math.abs(cam.position.z - dist) > 0.5) {
      cam.position.z = dist;
      cam.far = dist * 4;
      cam.updateProjectionMatrix();
    }

    pointer.current.x = damp(pointer.current.x, stageState.pointer.x, 4, dt);
    pointer.current.y = damp(pointer.current.y, stageState.pointer.y, 4, dt);
    const px = pointer.current.x;
    const py = pointer.current.y;

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
    let rate = 5;
    if (prod) {
      const idx = fragrances.findIndex((f) => f.slug === prod!.slug);
      lerpPalette(target, palettes[idx + 1] ?? palettes[0], palettes[idx + 1] ?? palettes[0], 0);
    } else if (colSection && colSection.top < vh * 0.6) {
      lerpPalette(target, palettes[0], palettes[0], 0);
    } else if (exp) {
      const wb = worldBlend(s, k);
      lerpPalette(target, palettes[wb.from], palettes[wb.to], wb.t);
      lerpPalette(target, target, palettes[0], wb.house);
      rate = 14;
    } else {
      lerpPalette(target, palettes[0], palettes[0], 0);
    }
    lerpPalette(current, current, target, 1 - Math.exp(-rate * dt));
    const bgLum = current.bg.r * 0.2126 + current.bg.g * 0.7152 + current.bg.b * 0.0722;
    const darkWorld = 1 - Math.min(1, Math.max(0, (bgLum - 0.02) / 0.3));

    shared.uLight.value.set(-0.5 + px * 0.75, 0.55 + py * 0.4);
    const wu = world.material.uniforms;
    wu.uAspect.value = vw / vh;
    wu.uPointer.value.set(px, py);

    let floorY = floor.current.y;
    let floorAmt = 0;

    // Bottles
    rigs.forEach((rig, i) => {
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
      } else if (cols.has(i) && cols.get(i)!.onScreen) {
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
      } else if (exp && exp.onScreen) {
        rect = exp;
        pose = bottlePose(s, i, k, vw, vh);
      }

      const visible = !!rect && !!pose && pose.opacity > 0.001 && rig.ready;
      rig.group.children.forEach((c) => (c.visible = visible));
      if (!visible || !rect || !pose) return;

      // Fit the photo inside the anchor (object-contain), never distorted
      const ph = Math.min(rect.h, rect.w / rig.aspect) * pose.scale;
      const pw = ph * rig.aspect;
      const cx = rect.cx + pose.dx;
      const cy = rect.cy + pose.dy;
      const base = cy - ph / 2;

      const bu = (rig.bottle.material as THREE.ShaderMaterial).uniforms;
      rig.bottle.position.set(cx, cy, 0);
      rig.bottle.rotation.set(tiltX, pose.rotY + tiltY, pose.rotZ);
      rig.bottle.scale.set(pw, ph, 1);
      bu.uOpacity.value = pose.opacity;
      bu.uSweep.value = pose.sweep;
      bu.uLift.value = rig.lift;
      bu.uEnvShift.value = px * 0.9 + (pose.rotY + tiltY) * 3.2;

      const upright = Math.max(0, 1 - Math.abs(pose.rotZ) / (10 * DEG));
      const g = pose.grounded * upright;
      const mu = (rig.mirror.material as THREE.ShaderMaterial).uniforms;
      rig.mirror.position.set(cx, base - ph / 2, 0);
      rig.mirror.rotation.set(-tiltX, pose.rotY + tiltY, -pose.rotZ);
      rig.mirror.scale.set(pw, ph, 1);
      mu.uOpacity.value = pose.opacity * g;
      mu.uEnvShift.value = bu.uEnvShift.value;

      rig.glow.position.set(cx, cy + ph * 0.04, -20);
      rig.glow.scale.set(pw * 2.4, ph * 1.45, 1);
      const glowU = (rig.glow.material as THREE.ShaderMaterial).uniforms;
      glowU.uColor.value.copy(current.accent).lerp(new THREE.Color(1, 1, 1), 0.25);
      glowU.uOpacity.value = pose.opacity * (0.035 + darkWorld * 0.16) * (1 + rig.lift * 0.5);

      rig.shadow.position.set(cx, base + ph * 0.01, -2);
      rig.shadow.scale.set(pw * 1.35, ph * 0.1, 1);
      (rig.shadow.material as THREE.ShaderMaterial).uniforms.uOpacity.value =
        pose.opacity * g * (0.55 - darkWorld * 0.2);

      rig.caustics.position.set(cx + pw * 0.42, base - ph * 0.035, -1);
      rig.caustics.scale.set(pw * 1.7, ph * 0.18, 1);
      (rig.caustics.material as THREE.ShaderMaterial).uniforms.uOpacity.value =
        pose.opacity * g * (0.12 + darkWorld * 0.3 + (pose.sweep > 0 ? 0.2 : 0));

      if (g > floorAmt) {
        floorAmt = g;
        floorY = (base + vh / 2) / vh;
      }
    });

    floor.current.y = damp(floor.current.y, floorY, 10, dt);
    floor.current.amount = damp(floor.current.amount, floorAmt, 6, dt);
    wu.uFloorY.value = floor.current.y;
    wu.uFloor.value = floor.current.amount;

    // Mastheads (home experience only)
    mastheads.forEach((m, i) => {
      if (!exp || !exp.onScreen || !m.uniforms.uMap.value) {
        m.mesh.visible = false;
        return;
      }
      const ms = mastheadState(s, i, k);
      if (ms.opacity <= 0.001) {
        m.mesh.visible = false;
        return;
      }
      const fontPx = Math.min(vw * (vw < 768 ? 0.28 : 0.23), exp.h * 0.62);
      const w = Math.min(vw * 0.96, fontPx * m.ratio);
      const h = w / m.aspect;
      m.mesh.visible = true;
      m.mesh.position.set(exp.cx - px * 14, exp.cy - exp.h * 0.1 + ms.lift * exp.h, -80);
      m.mesh.scale.set(w, h, 1);
      m.uniforms.uReveal.value = ms.reveal;
      m.uniforms.uOpacity.value = ms.opacity * 0.92;
      m.uniforms.uColor.value.copy(palettes[i + 1].ink);
    });
  });

  return null;
}
