// Deep space around the catapult run (Phase 2 launch): the Phase 1 sky is a
// window plane sized for the bay mouth; out of the bay the whole view must be
// space. A sphere fixed to the COCKPIT frame (the ship is static there, the
// launch tunnel slides) = a skybox: direction-hashed stars (two layers) and
// a Nebula / Ice glow ahead (W5 replaces it with the planet below). Never writes depth.
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { HEX } from '../../palette';

export function createLaunchSky(radius: number): Mesh {
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNeb: { value: new Color(HEX.nebula) }, uIce: { value: new Color(HEX.ice) }, uBase: { value: new Color(HEX.abyss) } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uNeb, uIce, uBase;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float stars(vec3 d, float scale, float dens, float sharp) {
        vec3 g = d * scale, id = floor(g), f = fract(g) - 0.5;
        float h = hash(id);
        vec3 off = vec3(hash(id + 3.1), hash(id + 7.7), hash(id + 1.3)) - 0.5;
        vec3 q = f - off * 0.6;
        float tw = 0.75 + 0.25 * sin(uTime * (0.6 + h * 2.0) + h * 40.0);
        return step(1.0 - dens, h) * exp(-dot(q, q) * sharp) * tw * (0.4 + 1.6 * h * h);
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = uBase * 0.25;
        col += vec3(0.85, 0.9, 1.0) * (stars(d, 120.0, 0.05, 180.0) + 0.5 * stars(d, 260.0, 0.07, 120.0));
        // the Veil glow ahead (-z), a soft Nebula wash with an Ice heart
        float ahead = max(0.0, -d.z);
        col += uNeb * pow(clamp(ahead, 0.0, 1.0), 6.0) * 0.35 + uIce * pow(clamp(ahead, 0.0, 1.0), 40.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  mat.name = 'launch-sky';
  const m = new Mesh(new SphereGeometry(radius, 48, 24), mat);
  m.name = 'launch-sky';
  m.renderOrder = -30;
  m.frustumCulled = false;
  m.visible = false;
  return m;
}
