/**
 * GLSL for the ZALFI stage. All colours arrive as linear RGB (THREE.Color handles sRGB→linear),
 * and every material ends with <colorspace_fragment> so output matches the DOM exactly.
 *
 * The light is still. Nothing here depends on time or on the pointer: a frame only changes when
 * the visitor scrolls, hovers, drags or navigates.
 */

/* ------------------------------------------------------------------------------------------------
 * Bottle: the real product photo, relit with baked normal + material maps.
 * ----------------------------------------------------------------------------------------------*/
export const bottleVertex = /* glsl */ `
  uniform float uMirror;
  varying vec2 vUv;
  varying vec2 vMeshUv;
  void main() {
    vMeshUv = uv;
    vUv = uMirror > 0.5 ? vec2(uv.x, 1.0 - uv.y) : uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const bottleFragment = /* glsl */ `
  uniform sampler2D uColor;
  uniform sampler2D uNormal;
  uniform sampler2D uMask;
  uniform float uOpacity;
  uniform float uMirror;
  uniform float uLift;
  uniform vec2 uLight;
  uniform vec3 uBg;
  uniform vec3 uDeep;
  uniform vec3 uAccent;
  uniform vec3 uCapTint;
  varying vec2 vUv;
  varying vec2 vMeshUv;

  const float PI = 3.14159265;

  // Studio environment, split so black glass stays black: the room only shows at grazing angles,
  // while the softboxes reflect crisply everywhere (as they do on real lacquered glass).
  vec3 room(vec3 R) {
    float h = R.y * 0.5 + 0.5;
    return mix(uDeep, mix(uBg, vec3(1.0), 0.18), smoothstep(0.05, 0.95, h));
  }
  float boxes(vec3 R) {
    float sx = R.x * 5.0;
    // Wide, soft-edged softboxes hung in fixed places
    float key = smoothstep(0.34, 0.0, abs(sx - 0.42)) * smoothstep(-0.8, 0.0, R.y) * 0.55;
    float fill = smoothstep(0.22, 0.0, abs(sx + 0.72)) * smoothstep(-0.5, 0.3, R.y) * 0.22;
    float ceiling = smoothstep(0.6, 0.95, R.y) * 0.14;
    return key + fill + ceiling;
  }
  vec3 studio(vec3 R) {
    return room(R) * 0.5 + mix(vec3(1.0), uAccent, 0.12) * boxes(R) * 1.4;
  }

  float ggx(float NdH, float rough) {
    float a = rough * rough;
    float a2 = a * a;
    float d = NdH * NdH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
  }

  void main() {
    vec4 photo = texture2D(uColor, vUv, uMirror * 2.5);
    if (photo.a < 0.004) discard;
    vec3 tn = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    if (uMirror > 0.5) tn.y = -tn.y;
    vec4 m = texture2D(uMask, vUv);
    float metal = m.r;
    float glass = m.g;
    float print = m.b;
    float thick = m.a;

    // Lit in the photograph's own frame, like a still life: the bottle may drift or turn a little
    // with scroll, but its reflections never slide across the glass.
    vec3 N = normalize(tn);
    const vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(uLight, 0.85));
    vec3 H = normalize(L + V);
    float NdV = max(dot(N, V), 0.0);
    float NdH = max(dot(N, H), 0.0);
    float NdL = max(dot(N, L), 0.0);
    vec3 R = reflect(-V, N);

    vec3 base = photo.rgb;
    vec3 col = base;

    // Smoked glass: crisp softbox reflections + room colour only at grazing angles + key highlight
    float fres = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
    col += glass * mix(vec3(1.0), uAccent, 0.1) * boxes(R) * (0.035 + 0.25 * fres);
    col += glass * room(R) * fres * 0.18;
    col += glass * vec3(1.0) * min(ggx(NdH, 0.2), 40.0) * 0.0025 * NdL;

    // Metal caps: keep the photo's identity, add tinted mirror reflections of the studio
    vec3 tint = mix(uCapTint * 1.35, vec3(1.0), 0.15);
    vec3 metalRefl = studio(R) * tint;
    col = mix(col, col * 0.75 + metalRefl * 0.3, metal * 0.4);
    col += metal * tint * min(ggx(NdH, 0.26), 30.0) * 0.006 * NdL;

    // Silver print catches the light
    col += print * vec3(1.0) * min(ggx(NdH, 0.3), 20.0) * 0.01;

    // Palette rim light on the silhouette: separates black glass from dark worlds
    float rim = pow(1.0 - NdV, 3.0) * (glass + metal * 0.4);
    col += rim * uAccent * 0.28;

    // Faint smoke glow inside thick glass
    col += glass * thick * uAccent * 0.008;

    // Hover lift: a touch more exposure
    col *= 1.0 + uLift * 0.12;

    float alpha = photo.a * uOpacity;
    if (uMirror > 0.5) {
      // Floor reflection: strongest at the base, fading down, sunk into the floor tone
      float fade = pow(vMeshUv.y, 3.2);
      col = mix(col, uDeep, 0.35);
      alpha *= fade * 0.26;
    }
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------------------------------------
 * World background: palette field, one still key light, baked haze, a floor horizon, vignette.
 * ----------------------------------------------------------------------------------------------*/
export const worldVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

export const worldFragment = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uDeep;
  uniform vec3 uAccent;
  uniform float uFloorY;
  uniform float uFloor;
  uniform float uAspect;
  uniform sampler2D uHaze;
  varying vec2 vUv;

  // Sine-free hash (stable for pixel coordinates on every GPU)
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = vUv;
    float lum = dot(uBg, vec3(0.2126, 0.7152, 0.0722));
    float dark = 1.0 - smoothstep(0.02, 0.35, lum);

    vec3 col = mix(mix(uBg, uDeep, 0.1), uBg, smoothstep(0.0, 0.85, uv.y));

    // One still key light from the upper left: a broad, soft falloff. No rays, nothing moves.
    vec2 d = (uv - vec2(0.12, 1.1)) * vec2(uAspect, 1.0);
    float wash = exp(-dot(d, d) * 0.9);
    vec3 lightCol = mix(mix(uBg, vec3(1.0), 0.45), uAccent, 0.35 + dark * 0.3);
    col = mix(col, lightCol, wash * (0.065 - dark * 0.025));

    // Haze: soft smoke, baked once into a small texture and never animated
    float haze = texture2D(uHaze, uv).r;
    col = mix(col, mix(uDeep, uAccent, 0.4), smoothstep(0.5, 0.95, haze) * (0.07 + dark * 0.1));

    // Floor: a glossy surface below the bottles' resting base line
    float below = smoothstep(uFloorY + 0.003, uFloorY - 0.3, uv.y) * uFloor;
    col = mix(col, mix(uBg, uDeep, 0.3 + dark * 0.2), below * 0.55);
    col += exp(-abs(uv.y - uFloorY) * 180.0) * 0.02 * uFloor * lightCol;

    // Vignette
    vec2 vv = (uv - 0.5) * vec2(1.15, 1.0);
    col *= mix(1.0, 0.8 - dark * 0.15, smoothstep(0.35, 1.05, length(vv)));

    // A fixed dither against banding in the gradients (static, so it never shimmers)
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------------------------------------------
 * Soft sprites: back glow behind each bottle, and contact shadow at its base.
 * ----------------------------------------------------------------------------------------------*/
export const spriteVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float g = exp(-dot(p, p) * 2.6) * smoothstep(1.0, 0.55, length(p));
    // additive: colour carries the intensity
    gl_FragColor = vec4(uColor * g * uOpacity, 1.0);
    #include <colorspace_fragment>
  }
`;

export const shadowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float core = exp(-dot(p * vec2(1.0, 2.6), p * vec2(1.0, 2.6)) * 3.5);
    gl_FragColor = vec4(0.0, 0.0, 0.0, core * uOpacity);
  }
`;

/* ------------------------------------------------------------------------------------------------
 * Masthead: the fragrance name, set huge behind the bottle, revealed by a diagonal wipe.
 * ----------------------------------------------------------------------------------------------*/
export const mastheadFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uReveal;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uMap, vUv).a;
    // Letters rise out of a baseline mask, staggered left to right
    float edge = uReveal * 1.45 - vUv.x * 0.45;
    float visible = 1.0 - smoothstep(edge - 0.03, edge, vUv.y);
    a *= visible * uOpacity;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

/**
 * The world's haze, baked once on the CPU: the same domain-warped fbm the shader used to animate,
 * frozen. A small single-channel texture, so the full-screen pass costs one texture read.
 */
export function bakeHaze(w = 192, h = 108) {
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const fbm = (x: number, y: number) => {
    let v = 0;
    let amp = 0.5;
    for (let i = 0; i < 5; i++) {
      v += amp * noise(x, y);
      x = x * 2.03 + 1.7;
      y = y * 2.03 + 9.2;
      amp *= 0.5;
    }
    return v;
  };
  const data = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      // Same framing as before: 16:9 reference aspect, x stretched by 1.6 and y by 1.3
      const x = ((i + 0.5) / w) * 2.84;
      const y = ((j + 0.5) / h) * 1.3;
      const warp = fbm(x * 0.7, y * 0.7);
      data[j * w + i] = Math.round(Math.min(1, fbm(x + warp, y + warp)) * 255);
    }
  return { data, width: w, height: h };
}
