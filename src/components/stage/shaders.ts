/**
 * GLSL for the ZALFI stage. All colours arrive as linear RGB (THREE.Color handles sRGB→linear),
 * and every material ends with <colorspace_fragment> so output matches the DOM exactly.
 */

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
`;

/* ------------------------------------------------------------------------------------------------
 * Bottle: the real product photo, relit with baked normal + material maps.
 * ----------------------------------------------------------------------------------------------*/
export const bottleVertex = /* glsl */ `
  uniform float uMirror;
  varying vec2 vUv;
  varying vec2 vMeshUv;
  varying vec3 vViewPos;
  varying vec3 vNm0;
  varying vec3 vNm1;
  varying vec3 vNm2;
  void main() {
    vMeshUv = uv;
    vUv = uMirror > 0.5 ? vec2(uv.x, 1.0 - uv.y) : uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNm0 = normalMatrix[0]; vNm1 = normalMatrix[1]; vNm2 = normalMatrix[2];
    gl_Position = projectionMatrix * mv;
  }
`;

export const bottleFragment = /* glsl */ `
  uniform sampler2D uColor;
  uniform sampler2D uNormal;
  uniform sampler2D uMask;
  uniform float uOpacity;
  uniform float uMirror;
  uniform float uSweep;
  uniform float uLift;
  uniform float uEnvShift;
  uniform float uTime;
  uniform vec2 uLight;
  uniform vec3 uBg;
  uniform vec3 uDeep;
  uniform vec3 uAccent;
  uniform vec3 uCapTint;
  varying vec2 vUv;
  varying vec2 vMeshUv;
  varying vec3 vViewPos;
  varying vec3 vNm0;
  varying vec3 vNm1;
  varying vec3 vNm2;

  const float PI = 3.14159265;

  // Studio environment, split so black glass stays black: the room only shows at grazing angles,
  // while the softboxes reflect crisply everywhere (as they do on real lacquered glass).
  vec3 room(vec3 R) {
    float h = R.y * 0.5 + 0.5;
    return mix(uDeep, mix(uBg, vec3(1.0), 0.18), smoothstep(0.05, 0.95, h));
  }
  float boxes(vec3 R) {
    float sx = R.x * 5.0 + uEnvShift;
    // Wide, soft-edged softboxes: reflections glide across the glass rather than flare
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

    mat3 nm = mat3(vNm0, vNm1, vNm2);
    vec3 N = normalize(nm * tn);
    vec3 V = normalize(-vViewPos);
    vec3 L = normalize(vec3(uLight, 0.85));
    vec3 H = normalize(L + V);
    float NdV = max(dot(N, V), 0.0);
    float NdH = max(dot(N, H), 0.0);
    float NdL = max(dot(N, L), 0.0);
    vec3 R = reflect(-V, N);
    vec3 env = studio(R);

    vec3 base = photo.rgb;
    vec3 col = base;

    // Smoked glass: crisp softbox reflections + room colour only at grazing angles + key highlight
    float fres = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
    col += glass * mix(vec3(1.0), uAccent, 0.1) * boxes(R) * (0.035 + 0.25 * fres);
    col += glass * room(R) * fres * 0.18;
    col += glass * vec3(1.0) * min(ggx(NdH, 0.2), 40.0) * 0.0025 * NdL;

    // Metal caps: keep the photo's identity, add tinted mirror reflections that move with the light
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

    // Light sweep: a soft diagonal band travelling across the glass
    float band = vMeshUv.x * 0.62 + (1.0 - vMeshUv.y) * 0.38;
    float sweep = smoothstep(0.24, 0.0, abs(band - uSweep)) * step(0.001, uSweep) * step(uSweep, 1.2);
    col += (glass + metal * 0.5) * sweep * vec3(0.045);

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
 * World background: palette field, light shafts, drifting smoke, a floor horizon and vignette.
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
  uniform float uTime;
  uniform float uFloorY;
  uniform float uFloor;
  uniform float uAspect;
  uniform vec2 uPointer;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float lum = dot(uBg, vec3(0.2126, 0.7152, 0.0722));
    float dark = 1.0 - smoothstep(0.02, 0.35, lum);

    vec3 col = mix(mix(uBg, uDeep, 0.1), uBg, smoothstep(0.0, 0.85, uv.y));

    // Light shafts falling from the upper left, gently following the pointer
    vec2 src = vec2(0.18 + uPointer.x * 0.04, 1.15);
    vec2 d = (uv - src) * vec2(uAspect, 1.0);
    float ang = atan(d.y, d.x);
    float rays = fbm(vec2(ang * 4.0, uTime * 0.006)) * fbm(vec2(ang * 9.0 + 3.1, -uTime * 0.004));
    rays = smoothstep(0.08, 0.5, rays) * smoothstep(1.8, 0.1, length(d));
    vec3 lightCol = mix(mix(uBg, vec3(1.0), 0.45), uAccent, 0.35 + dark * 0.3);
    col = mix(col, lightCol, rays * (0.07 - dark * 0.02));

    // Smoke / haze drifting slowly
    vec2 sp = uv * vec2(uAspect * 1.6, 1.3);
    float smoke = fbm(sp + vec2(uTime * 0.016, -uTime * 0.01) + fbm(sp * 0.7 - uTime * 0.01));
    col = mix(col, mix(uDeep, uAccent, 0.4), smoothstep(0.5, 0.95, smoke) * (0.07 + dark * 0.1));

    // Floor: a glossy surface below the bottles' base line
    float below = smoothstep(uFloorY + 0.003, uFloorY - 0.3, uv.y) * uFloor;
    col = mix(col, mix(uBg, uDeep, 0.3 + dark * 0.2), below * 0.55);
    col += exp(-abs(uv.y - uFloorY) * 260.0) * 0.035 * uFloor * lightCol;

    // Vignette
    vec2 vv = (uv - 0.5) * vec2(1.15, 1.0);
    col *= mix(1.0, 0.8 - dark * 0.15, smoothstep(0.35, 1.05, length(vv)));

    // Blue-noise-ish dither to kill banding in gradients
    col += (hash(uv * 1000.0 + uTime) - 0.5) / 255.0;

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
 * Caustics: light focused through the glass onto the floor, tinted by the fragrance accent.
 * ----------------------------------------------------------------------------------------------*/
export const causticsFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv * vec2(3.2, 1.2);
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float t = uTime * 0.12 * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    float caustic = pow(abs(c), 7.0);
    vec2 q = (vUv - 0.5) * 2.0;
    float mask = smoothstep(1.0, 0.15, length(q * vec2(1.0, 1.0)));
    float a = clamp(caustic, 0.0, 1.0) * mask * uOpacity;
    // additive: colour carries the intensity
    gl_FragColor = vec4(uColor * a, 1.0);
    #include <colorspace_fragment>
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
