import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BOTTLE_MODELS, NOTE_MODELS, type ModelEntry } from "./model-manifest";

export const hasBottleModel = (slug: string) => slug in BOTTLE_MODELS;
export const hasNoteModel = (slug: string) => slug in NOTE_MODELS;
export const anyModels = () =>
  Object.keys(BOTTLE_MODELS).length + Object.keys(NOTE_MODELS).length > 0;

/**
 * Loads and caches the Higgsfield-generated GLBs listed in model-manifest.ts.
 * Models are normalised at ingest (height 1, standing on y = 0, centred on X/Z), so an instance
 * only needs a uniform scale to fit a DOM anchor's height.
 */
export class ModelLibrary {
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private cache = new Map<string, Promise<THREE.Group>>();

  load(entry: ModelEntry) {
    let p = this.cache.get(entry.file);
    if (!p) {
      p = this.loader.loadAsync(entry.file).then((gltf) => {
        const root = new THREE.Group();
        const pivot = gltf.scene;
        pivot.rotation.y = THREE.MathUtils.degToRad(entry.yaw);
        root.add(pivot);
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.frustumCulled = false;
            m.castShadow = false;
            m.receiveShadow = false;
          }
        });
        return root;
      });
      this.cache.set(entry.file, p);
    }
    return p;
  }

  dispose() {
    for (const p of this.cache.values())
      void p.then((g) =>
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of [m.material].flat()) disposeMaterial(mat);
        }),
      );
    this.cache.clear();
  }
}

function disposeMaterial(mat: THREE.Material) {
  for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
  mat.dispose();
}

/** A neutral studio environment for PBR reflections (generated once, no HDR download). */
export function studioEnvironment(gl: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  pmrem.dispose();
  return env;
}

/** Uniforms shared by every model material (opacity + floor-reflection fade). */
export type ModelUniforms = {
  uOpacity: THREE.IUniform<number>;
  uFloorY: THREE.IUniform<number>;
  uFadeH: THREE.IUniform<number>;
  uMirror: THREE.IUniform<number>;
};

/**
 * Clones a model with its own materials for one placement on the stage.
 *  - Every material gains an opacity uniform, so DOM fades (GSAP) carry over to the 3D model.
 *  - `mirror` builds the floor reflection: flipped, faded with distance below the floor line.
 *  - `bottle` lifts the photo-derived textures into real materials: the smoked-glass body gets
 *    a lacquered clearcoat, and everything above the shoulder (the cap) becomes metal.
 */
export function instantiate(
  source: THREE.Group,
  opts: { mirror?: boolean; bottle?: { shoulder: number } } = {},
) {
  const inst = source.clone(true);
  const uniforms: ModelUniforms = {
    uOpacity: { value: 1 },
    uFloorY: { value: 0 },
    uFadeH: { value: 100 },
    uMirror: { value: opts.mirror ? 1 : 0 },
  };
  const materials: THREE.Material[] = [];

  inst.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const base = [mesh.material].flat()[0] as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshPhysicalMaterial({
      map: base.map ?? null,
      color: base.color ?? new THREE.Color(1, 1, 1),
      normalMap: base.normalMap ?? null,
      roughnessMap: base.roughnessMap ?? null,
      metalnessMap: base.metalnessMap ?? null,
      roughness: base.roughness ?? 0.6,
      metalness: base.metalness ?? 0,
      emissiveMap: base.emissiveMap ?? null,
      emissive: base.emissive ?? new THREE.Color(0, 0, 0),
      aoMap: base.aoMap ?? null,
      transparent: true,
      envMapIntensity: opts.bottle ? 1.25 : 0.9,
      clearcoat: opts.bottle ? 1 : 0,
      clearcoatRoughness: 0.04,
    });
    const shoulder = opts.bottle ? 1 - opts.bottle.shoulder : 2;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms, {
        uMinY: { value: bb.min.y },
        uSpanY: { value: Math.max(1e-5, bb.max.y - bb.min.y) },
        uShoulder: { value: shoulder },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uMinY; uniform float uSpanY;
           varying float vH; varying float vWorldY;`,
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
           vH = (position.y - uMinY) / uSpanY;
           vWorldY = (modelMatrix * vec4(position, 1.0)).y;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uOpacity; uniform float uFloorY; uniform float uFadeH;
           uniform float uMirror; uniform float uShoulder;
           varying float vH; varying float vWorldY;`,
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `#include <metalnessmap_fragment>
           float capMask = smoothstep(uShoulder - 0.01, uShoulder + 0.01, vH);
           metalnessFactor = mix(metalnessFactor, 1.0, capMask);`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, min(roughnessFactor, 0.2),
             smoothstep(uShoulder - 0.01, uShoulder + 0.01, vH));`,
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
           float fade = uMirror > 0.5
             ? pow(clamp(1.0 - (uFloorY - vWorldY) / uFadeH, 0.0, 1.0), 2.4) * 0.26
             : 1.0;
           gl_FragColor.a *= uOpacity * fade;`,
        );
    };
    mat.customProgramCacheKey = () => `zalfi-model-${opts.bottle ? "b" : "n"}`;
    mesh.material = mat;
    materials.push(mat);
  });

  return {
    object: inst,
    uniforms,
    setOpacity(v: number) {
      uniforms.uOpacity.value = v;
      // Opaque when fully visible keeps depth sorting correct; transparent while fading
      const t = v < 0.999 || !!opts.mirror;
      for (const m of materials) if (m.transparent !== t) m.transparent = t;
    },
    dispose() {
      materials.forEach((m) => m.dispose());
    },
  };
}
export type ModelInstance = ReturnType<typeof instantiate>;

export { BOTTLE_MODELS, NOTE_MODELS };
