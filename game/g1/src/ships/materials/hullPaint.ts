// Hull paint (brief §10): CustomShaderMaterial on MeshPhysicalMaterial.
// - paintZone attribute (0 primary, 1 secondary, 2 accent, 3 trim) -> livery colours
// - finish: matte / satin / pearl (view-dependent shift) / flake (sparkle under a
//   smooth clearcoat) / metal
// - baked edge wear reveals bare metal; engine soot darkens + roughens
// - faint procedural panel-line layer on top of the real groove geometry
// - livery change: colour lerp + a diagonal repaint band sweeping nose -> tail
// - dissolve: noise threshold with an HDR Ignition edge (ship swap)
import { Color, MeshPhysicalMaterial } from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import type { Livery, Finish } from '../../data/liveries';
import { hdr } from '../../render/palette';

const FINISH_ID: Record<Finish, number> = { matte: 0, satin: 1, pearl: 2, flake: 3, metal: 4 };

const vertex = /* glsl */ `
  attribute float paintZone;
  attribute float aWear;
  attribute float aSoot;
  varying float vZone;
  varying float vWear;
  varying float vSoot;
  varying vec3 vObjPos;
  varying vec3 vObjNormal;
  void main() {
    vZone = paintZone;
    vWear = aWear;
    vSoot = aSoot;
    vObjPos = position;
    vObjNormal = normal;
  }`;

const fragment = /* glsl */ `
  uniform vec3 uCol[4];
  uniform vec3 uPrev[4];
  uniform float uFinish;
  uniform float uPrevFinish;
  uniform float uRepaint;   // 0..1 band progress (1 = done)
  uniform float uDissolve;  // 0 visible .. 1 gone
  uniform vec2 uZRange;     // hull z extent (tail, nose)
  uniform vec3 uEdge;       // HDR Ignition
  uniform float uFissure;   // OBSIDIAN CROWN molten fissures (0 = off)
  uniform float uTime;
  varying float vZone;
  varying float vWear;
  varying float vSoot;
  varying vec3 vObjPos;
  varying vec3 vObjNormal;

  float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = h13(i), n100 = h13(i + vec3(1,0,0)), n010 = h13(i + vec3(0,1,0)), n110 = h13(i + vec3(1,1,0));
    float n001 = h13(i + vec3(0,0,1)), n101 = h13(i + vec3(1,0,1)), n011 = h13(i + vec3(0,1,1)), n111 = h13(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
  }
  vec3 pick(vec3 c[4], float z) { return z < 0.5 ? c[0] : z < 1.5 ? c[1] : z < 2.5 ? c[2] : c[3]; }

  // faint triplanar panel lines (irregular: two offset grids, broken by noise)
  float panelLines(vec3 p, vec3 n) {
    vec3 an = abs(n);
    vec2 q = an.x > an.y && an.x > an.z ? p.zy : (an.y > an.z ? p.xz : p.xy);
    vec2 s1 = q * vec2(0.62, 0.9) + vec2(0.3, 0.1);
    vec2 g1 = abs(fract(s1) - 0.5) / max(fwidth(s1), 1e-4);
    float l1 = 1.0 - clamp(min(g1.x, g1.y) - 0.4, 0.0, 1.0);
    vec2 s2 = q * vec2(1.7, 1.25) + vec2(0.71, 0.37);
    vec2 g2 = abs(fract(s2) - 0.5) / max(fwidth(s2), 1e-4);
    float l2 = 1.0 - clamp(min(g2.x, g2.y) - 0.4, 0.0, 1.0);
    float keep = step(0.45, vnoise(floor(q.xyx * vec3(0.62, 0.9, 1.0)) + 3.0));
    return max(l1 * keep, l2 * 0.45 * step(0.62, vnoise(floor(q.xyy * 1.7) + 9.0)));
  }

  void main() {
    // --- dissolve (ship swap) ---
    float dn = vnoise(vObjPos * 1.6) * 0.7 + vnoise(vObjPos * 5.3) * 0.3;
    if (uDissolve > 0.0 && dn < uDissolve) discard;
    float dEdge = uDissolve > 0.0 ? 1.0 - smoothstep(0.0, 0.05, dn - uDissolve) : 0.0;

    // --- livery with diagonal repaint band (nose first) ---
    float s = (vObjPos.z - uZRange.x) / max(uZRange.y - uZRange.x, 0.001);
    float t = 1.0 - s + vObjPos.y * 0.06;              // diagonal
    float isNew = step(t, uRepaint * 1.25);
    float band = (1.0 - smoothstep(0.0, 0.035, abs(t - uRepaint * 1.25))) * step(uRepaint, 0.999);
    vec3 col = mix(pick(uPrev, vZone), pick(uCol, vZone), isNew);
    float finish = mix(uPrevFinish, uFinish, isNew);

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);
    float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.0);

    float rough = finish < 0.5 ? 0.62 : finish < 1.5 ? 0.42 : finish < 2.5 ? 0.3 : finish < 3.5 ? 0.36 : 0.26;
    float metal = finish > 3.5 ? 0.85 : finish > 2.5 ? 0.35 : 0.05;
    float coat = finish < 0.5 ? 0.1 : finish < 1.5 ? 0.35 : 0.85;
    // >= 0.1: the key light is a point source; mirror-sharp clearcoat turns
    // every facet glint into a bloom flare
    float coatRough = finish < 0.5 ? 0.5 : finish < 1.5 ? 0.18 : 0.11;

    // pearl: view-dependent hue drift toward the secondary
    if (finish > 1.5 && finish < 2.5) col = mix(col, pick(uCol, 1.0) * 1.25 + col * 0.3, fres * 0.45);

    // panel lines: darker + rougher
    float pl = panelLines(vObjPos, vObjNormal) * 0.28;
    col *= 1.0 - pl * 0.4;
    rough = mix(rough, 0.78, pl);

    // subtle large-scale paint variation (breaks uniform roughness)
    float var1 = vnoise(vObjPos * 0.9);
    rough *= 0.88 + var1 * 0.24;
    col *= 0.94 + vnoise(vObjPos * 2.3) * 0.12;

    // edge wear -> bare brushed metal
    float wn = vnoise(vObjPos * 9.0) * 0.6 + vnoise(vObjPos * 23.0) * 0.4;
    float wear = smoothstep(0.55, 0.8, vWear + (wn - 0.5) * 0.4);
    col = mix(col, vec3(0.34, 0.35, 0.38), wear);
    metal = mix(metal, 1.0, wear);
    rough = mix(rough, 0.3, wear);
    coat *= 1.0 - wear;

    // engine soot
    float soot = vSoot * (0.7 + 0.3 * vnoise(vObjPos * 3.1));
    col *= 1.0 - soot * 0.75;
    rough = mix(rough, 0.85, soot);
    coat *= 1.0 - soot;

    // metal flake: sparkle normals in the base layer under a smooth clearcoat
    vec3 nrm = csm_FragNormal;
    if (finish > 2.5 && finish < 3.5) {
      vec3 fp = floor(vObjPos * 320.0);
      vec3 j = vec3(h13(fp), h13(fp + 17.0), h13(fp + 41.0)) - 0.5;
      nrm = normalize(nrm + j * 0.11);
    }
    csm_FragNormal = nrm;

    csm_DiffuseColor = vec4(col, 1.0);
    csm_Roughness = clamp(rough, 0.04, 1.0);
    csm_Metalness = clamp(metal, 0.0, 1.0);
    csm_Clearcoat = coat;
    csm_ClearcoatRoughness = coatRough;
    // molten fissures: ridged-noise veins glowing through the obsidian glass
    float fis = 0.0;
    if (uFissure > 0.0) {
      float r1 = 1.0 - abs(vnoise(vObjPos * vec3(0.9, 1.6, 0.45)) * 2.0 - 1.0);
      float r2 = 1.0 - abs(vnoise(vObjPos * vec3(2.3, 3.1, 1.2) + 7.0) * 2.0 - 1.0);
      float mask = smoothstep(0.36, 0.58, vnoise(vObjPos * vec3(0.3, 0.5, 0.18) + 3.0));
      float vein = pow(max(r1, r2 * 0.7), 36.0) * mask;
      float pulse = 0.75 + 0.25 * sin(uTime * 1.3 + vObjPos.z * 0.8);
      fis = vein * pulse * uFissure * (1.0 - wear);
      col = mix(col, vec3(0.02), fis);
    }
    csm_Emissive = uEdge * (dEdge * 1.0 + band * 0.55 + fis * 1.6);
  }`;

export type HullPaint = CustomShaderMaterial & {
  uniforms: {
    uCol: { value: Color[] };
    uPrev: { value: Color[] };
    uFinish: { value: number };
    uPrevFinish: { value: number };
    uRepaint: { value: number };
    uDissolve: { value: number };
    uZRange: { value: [number, number] };
    uEdge: { value: Color };
    uFissure: { value: number };
    uTime: { value: number };
  };
};

export function liveryColors(l: Livery): Color[] {
  return [new Color(l.primary), new Color(l.secondary), new Color(l.accent), new Color(l.trim)];
}

export function createHullPaint(livery: Livery, zRange: [number, number]): HullPaint {
  const cols = liveryColors(livery);
  const mat = new CustomShaderMaterial({
    baseMaterial: MeshPhysicalMaterial,
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uCol: { value: cols },
      uPrev: { value: cols.map(c => c.clone()) },
      uFinish: { value: FINISH_ID[livery.finish] },
      uPrevFinish: { value: FINISH_ID[livery.finish] },
      uRepaint: { value: 1 },
      uDissolve: { value: 0 },
      uZRange: { value: zRange },
      uEdge: { value: hdr('ignition', 5) },
      uFissure: { value: 0 },
      uTime: { value: 0 },
    },
    // base props (CSM overrides per fragment)
    roughness: 0.4,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: new Color('#ffffff'),
    envMapIntensity: 1.0,
  }) as unknown as HullPaint;
  return mat;
}

export function finishId(f: Finish): number {
  return FINISH_ID[f];
}
