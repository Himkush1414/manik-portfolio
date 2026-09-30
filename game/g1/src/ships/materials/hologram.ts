// Locked-ship hologram (colour language: hologram = ice). Fresnel shell +
// object-space scanlines + a slow scan sweep along the hull + flicker, additive
// so the ship reads as projected light, not a solid.
// Shares the dissolve noise with the hull paint so a ship swap looks identical
// whether the ship is owned or locked.
import { AdditiveBlending, Color, FrontSide, ShaderMaterial } from 'three';
import { hdr } from '../../render/palette';

export type HologramMaterial = ShaderMaterial & {
  uniforms: {
    uCol: { value: Color };
    uTime: { value: number };
    uDissolve: { value: number };
    uZRange: { value: [number, number] };
  };
};

export function createHologram(zRange: [number, number]): HologramMaterial {
  return new ShaderMaterial({
    uniforms: {
      uCol: { value: hdr('ice', 1.25) },
      uTime: { value: 0 },
      uDissolve: { value: 0 },
      uZRange: { value: zRange },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObjPos;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 p = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        vObjPos = p.xyz;
        vec4 mv = modelViewMatrix * p;
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      uniform float uTime, uDissolve;
      uniform vec2 uZRange;
      varying vec3 vObjPos;
      varying vec3 vN;
      varying vec3 vV;
      float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = h13(i), n100 = h13(i + vec3(1,0,0)), n010 = h13(i + vec3(0,1,0)), n110 = h13(i + vec3(1,1,0));
        float n001 = h13(i + vec3(0,0,1)), n101 = h13(i + vec3(1,0,1)), n011 = h13(i + vec3(0,1,1)), n111 = h13(i + vec3(1,1,1));
        return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
      }
      void main() {
        float dn = vnoise(vObjPos * 1.6) * 0.7 + vnoise(vObjPos * 5.3) * 0.3;
        if (uDissolve > 0.0 && dn < uDissolve) discard;
        float dEdge = uDissolve > 0.0 ? 1.0 - smoothstep(0.0, 0.05, dn - uDissolve) : 0.0;

        float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
        float scan = smoothstep(0.82, 1.0, sin((vObjPos.y * 16.0 - uTime * 1.6) * 3.14159) * 0.5 + 0.5);
        float s = (vObjPos.z - uZRange.x) / max(uZRange.y - uZRange.x, 0.001);
        float sd = (fract(uTime * 0.18) * 1.4 - 0.2 - s) * 9.0;
        float sweep = exp(-sd * sd);
        float flicker = 0.92 + 0.08 * step(0.93, fract(sin(floor(uTime * 14.0)) * 43758.5));
        float a = (0.015 + fres * 0.7 + scan * 0.22 + sweep * 0.3) * flicker;
        gl_FragColor = vec4(uCol * a + uCol * dEdge * 2.5, 1.0);
      }`,
    transparent: true,
    // depth ON: the DOF pass reads depth, so a depth-less hologram would be
    // blurred as if it were the floor behind it; also hides inner surfaces
    depthWrite: true,
    blending: AdditiveBlending,
    side: FrontSide,
    toneMapped: false,
  }) as HologramMaterial;
}
