import { GLSL_NOISE, GLSL_SRGB } from '../../gl/gl'

// Linear-light HDR scene for the neon stage. Works in CSS pixels, y down.
// Also used (with uShowText = 0) for the picker's live background.
// Colors arrive as linear-chroma "light colors" (see lightColor() in colors.ts):
// nothing here converts to gray or mixes toward white except the tube's own
// hot core, so the spill keeps the chosen chroma all the way down.
export const NEON_SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;       // css px
uniform float uScale;    // device px per css px
uniform float uTubeY;    // css px from the top
uniform float uTube;     // core intensity
uniform float uSpill;    // light poured into the room
uniform float uHalf;     // lit half-length, 0..1 of the tube half-width
uniform float uTip;      // heat of the advancing / retreating tips
uniform float uTime;
uniform vec3 uTubeColor;  // tube, halo, and the spill right under the tube
uniform vec3 uBackColor;  // the body of the spill, glow behind the text
uniform vec3 uTextColor;  // target on-screen color of the lit lettering
uniform float uTextFade;
uniform float uShowText;
uniform float uBg;        // composite background (display value)
uniform float uExposure;  // composite exposure
uniform sampler2D uText;
uniform vec4 uTextRect;  // x, y (top), w, h in css px
uniform float uTitleFs;   // title font size, css px (shadow offsets are in em)
out vec4 o;
${GLSL_NOISE}
${GLSL_SRGB}

const float TUBE_R = 1.5;   // 3px thick

// light that the composite's chroma-preserving tonemap turns into display color t
vec3 untonemap(vec3 t) {
  vec3 tl = toLinear(t);
  float m = max(tl.r, max(tl.g, tl.b));
  vec3 ratio = tl / max(m, 1e-5);
  float dPeak = toSrgb(vec3(m)).x;
  float k = clamp((dPeak - uBg) / (1.0 - uBg), 0.0, 0.985);
  return ratio * (-log(1.0 - k) / uExposure);
}

void main() {
  vec2 px = gl_FragCoord.xy / uScale;
  float W = uRes.x;
  float H = uRes.y;
  float x = px.x;
  float y = H - px.y;
  float cx = W * 0.5;
  float TW = 0.45 * W;               // 90% of the width
  float L = uHalf * TW;
  float ax = abs(x - cx);
  float dx = max(ax - L, 0.0);
  float dy = y - uTubeY;
  float d = length(vec2(dx, dy));
  float aa = 0.6 / uScale + 0.3;

  vec3 col = vec3(0.0);
  float bloomW = 1.0;

  // ---- the tube itself -------------------------------------------------
  float core = smoothstep(TUBE_R + aa, TUBE_R - aa, d);
  float tipD = length(vec2(ax - L, dy));
  float tip = uTip * exp(-tipD * tipD / (2.0 * 10.0 * 10.0));
  float halo = exp(-d / 3.0);              // tight bright halo
  float glow = exp(-d / 24.0);             // wider soft glow
  vec3 hot = mix(uTubeColor, vec3(1.0), 0.32);
  vec3 tubeLight = hot * core * (6.5 + 7.0 * tip)
                 + uTubeColor * (halo * (1.05 + 1.2 * tip) + glow * 0.26);
  // unlit glass along the rest of the tube catches a little light from the lit part
  float bodyD = length(vec2(max(ax - TW, 0.0), dy));
  float body = smoothstep(TUBE_R + aa, TUBE_R - aa, bodyD) * (1.0 - core);
  tubeLight += uTubeColor * body * 0.09 * exp(-dx / (0.12 * W));
  col += tubeLight * uTube;

  // ---- light poured down from the lit section ---------------------------
  float depth = max(dy, 0.0) / H;
  float spread = W * (0.016 + depth * 0.2);
  float lateral = exp(-(dx * dx) / (spread * spread));
  float under = 1.0 - 0.2 * smoothstep(0.0, max(L, 1.0), ax);
  // feathered fall-off: full under the tube, black by ~68% of the height
  float fall = 1.0 - smoothstep(0.0, 0.68, depth);
  fall = fall * fall;
  float nearTube = exp(-depth * 22.0);
  float air = 0.9 + 0.2 * vnoise(vec2(x / W * 3.0 + uTime * 0.02, y / H * 2.2 - uTime * 0.035));
  float pour = lateral * under * (fall * 0.5 + nearTube * 0.45) * air;
  // a sliver of light above the tube, on the ceiling
  float above = exp(min(dy, 0.0) / 7.0) * exp(-(dx * dx) / (40.0 * 40.0)) * 0.5;
  // the light is the tube's: its own color right under it, blending into the
  // backlight color that carries the body of the spill. The tube color is
  // matched to the backlight's peak so only the hue changes along the way.
  float bMax = max(uBackColor.r, max(uBackColor.g, uBackColor.b));
  float tMax = max(uTubeColor.r, max(uTubeColor.g, uTubeColor.b));
  vec3 tubeSpill = uTubeColor * (bMax / max(tMax, 1e-4));
  vec3 spillColor = mix(tubeSpill, uBackColor, smoothstep(0.0, 0.3, depth));
  col += (dy < 0.0 ? tubeSpill * above : spillColor * pour) * uSpill;

  if (uShowText > 0.5) {
    // ---- backlight glow behind the title ----------------------------------
    vec2 tc = uTextRect.xy + 0.5 * uTextRect.zw;
    vec2 gq = (vec2(x, y) - tc) / vec2(max(uTextRect.z * 0.75, 1.0), max(uTextRect.w * 1.3, 1.0));
    float tDepthC = max(tc.y - uTubeY, 0.0) / H;
    float tSpreadC = W * (0.016 + tDepthC * 0.2) * 0.8;
    float reachC = exp(-(dx * dx) / (tSpreadC * tSpreadC)) * uSpill;
    col += uBackColor * exp(-dot(gq, gq)) * 0.1 * reachC * uTextFade;

    // ---- title, revealed by the light that reaches it ----------------------
    vec2 tuv = (vec2(x, y) - uTextRect.xy) / uTextRect.zw;
    if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      // drop shadow cast by the tube light above: driven by the same tube
      // intensity as the light, so it flickers with it (longer + softer when bright)
      float ti = clamp(uTube, 0.0, 1.0);
      float offEm = mix(0.06, 0.14, ti);
      float blurEm = mix(0.1, 0.25, ti);
      float lod = log2(max(blurEm * uTitleFs * uScale, 1.0));
      float sh = textureLod(uText, tuv - vec2(0.0, offEm * uTitleFs / uTextRect.w), lod).r;
      float shDepth = max(dy, 0.0) / H;
      float shSpread = W * (0.016 + shDepth * 0.2) * 0.8;
      float lit = smoothstep(0.02, 0.8, exp(-(dx * dx) / (shSpread * shSpread)) * uSpill);
      float S = sh * 0.55 * ti * lit * uTextFade;
      vec3 shadowInk = uBackColor * 0.004;           // ~black, faintly tinted by the backlight
      col = mix(col, shadowInk, S);

      float a = texture(uText, tuv).r;
      if (a > 0.0) {
        float aUp = texture(uText, tuv - vec2(0.0, 2.5 / uTextRect.w)).r;
        float edge = clamp(a - aUp, 0.0, 1.0);     // top edges catch the tube light
        float tDepth = max(dy, 0.0) / H;
        float tSpread = W * (0.016 + tDepth * 0.2) * 0.8;
        float reach = exp(-(dx * dx) / (tSpread * tSpread)) * uSpill;
        float reveal = smoothstep(0.02, 0.8, reach) * uTextFade;
        // per-line vertical gradient: brushed silver, brighter toward the light
        float g = clamp(texture(uText, tuv).g / max(a, 1e-3), 0.0, 1.0);
        float shade = mix(1.0, 0.78, g) + 0.03 * sin((x / W) * 9.0 + y / H * 3.0 + uTime * 0.25);
        vec3 target = min(uTextColor * shade + edge * 0.18, vec3(0.99));
        vec3 letter = untonemap(target) * reveal;
        col = mix(col, letter, a);
        // crisp lettering: it only feeds a quarter of its light to the bloom
        bloomW = 1.0 - 0.75 * a;
      }
    }
  }
  o = vec4(col, bloomW);
}`
