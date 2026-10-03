// The CLOUD DECK (Control / Camera / Boundary addendum: "open sky = a visible
// dense cloud deck"; W2b). The sim's ceiling over open terrain sits
// cloudDeckOffset(envB) above the path line; this draws it there, so the
// limit the ship feels is a thing the pilot sees: a low valley cloud layer,
// dense over the flight corridor with fbm breaks (the sky shows through),
// fading out beyond the valley walls so peaks rise through it. Seen from
// below (the only side the downdraft allows): darker, sun-tinted base;
// lightning (the HUD's flashes inside the deck) lights it from within.
// One horizontal plane, world-space noise (it never swims with the camera),
// aerial perspective, depth-tested against the terrain. Uniforms only.
import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { missionSpace } from './missionSpace';
import { AP_GLSL, AP_UNIFORMS } from './atmosphere';
import { MISSION_ORIGIN } from '../../scenes/sceneBridge';
import { CLOUD_DECK } from '../../data/mission';

/** HUD -> deck: lightning flash level (0..1) this frame */
export const deckFx = { flash: 0 };

const _c = new Color();
const _w = new Color(1, 1, 1);

export class CloudDeck {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor() {
    const D = CLOUD_DECK;
    const geo = new PlaneGeometry(D.size, D.size, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.material = new ShaderMaterial({
      name: 'cloud-deck',
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
      uniforms: {
        ...AP_UNIFORMS,
        uPathP0: missionSpace.uniforms.uPathP0,
        uPathB: missionSpace.uniforms.uPathB,
        uMissionO: { value: new Vector3(...MISSION_ORIGIN) },
        uLit: { value: new Color() },
        uBase: { value: new Color() },
        uFlash: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        uniform vec3 uPathP0, uMissionO;
        uniform mat3 uPathB;
        varying vec3 vWorldP;
        varying vec2 vLocal;
        varying float vDist;
        void main() {
          vec4 c = modelMatrix * vec4(position, 1.0);
          vec4 mv = viewMatrix * c;
          gl_Position = projectionMatrix * mv;
          vWorldP = uPathP0 + transpose(uPathB) * (c.xyz - uMissionO);
          // mission-local (path frame at the player): x = across the valley, z = along it
          vLocal = (c.xyz - uMissionO).xz;
          vDist = -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLit, uBase;
        uniform float uFlash, uTime, uOpacity;
        varying vec3 vWorldP;
        varying vec2 vLocal;
        varying float vDist;
        ${AP_GLSL}
        float dh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float dn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(dh(i), dh(i + vec2(1, 0)), u.x), mix(dh(i + vec2(0, 1)), dh(i + vec2(1, 1)), u.x), u.y);
        }
        float df(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * dn(p); p = p * 2.03 + 7.7; a *= 0.5; } return s; }
        void main() {
          vec2 w = vWorldP.xz / ${CLOUD_DECK.scale.toFixed(1)} + vec2(uTime * 0.006, uTime * 0.002);
          float n = df(w);
          // dense over the corridor, broken toward the walls, gone past them (peaks rise through)
          float across = abs(vLocal.x);
          float cover = mix(${CLOUD_DECK.coverCore.toFixed(2)}, ${CLOUD_DECK.coverEdge.toFixed(2)}, smoothstep(${CLOUD_DECK.coreHalf.toFixed(1)}, ${CLOUD_DECK.edgeHalf.toFixed(1)}, across));
          float a = smoothstep(1.0 - cover, 1.0 - cover + 0.22, n);
          a *= smoothstep(${CLOUD_DECK.fadeFar.toFixed(1)}, ${CLOUD_DECK.fadeNear.toFixed(1)}, vDist);
          // edge-on (the camera at the deck's height) a plane collapses to a bright line: fade at grazing
          // angles — inside the base the HUD whiteout takes over
          a *= smoothstep(0.015, 0.09, abs(normalize(uCamW - vWorldP).y));
          if (a < 0.004) discard;
          // underside: darker where thick, the sun's colour where thin; lightning from within
          float thick = smoothstep(0.45, 0.9, n);
          vec3 col = mix(uLit, uBase, thick) + vec3(0.85, 0.9, 1.0) * uFlash * (0.6 + thick);
          vec4 ap = aerial(vWorldP);
          col = mix(col, ap.rgb, ap.a * 0.85);
          gl_FragColor = vec4(col, a * uOpacity * ${CLOUD_DECK.maxAlpha.toFixed(2)});
        }`,
    });
    this.mesh = new Mesh(geo, this.material);
    this.mesh.name = 'cloud-deck';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -400; // after the sky + cumulus, before nearer transparents
  }

  /** time of day: base + lit colours (uniforms only) */
  applyTod(sunColor: Color, zenith: Color, hazeFar: Color, daylight: number): void {
    const u = this.material.uniforms, D = CLOUD_DECK;
    u.uLit.value.set(D.color).multiply(_c.copy(sunColor).lerp(_w, 0.55)).lerp(hazeFar, 0.2).multiplyScalar(0.62 + 0.45 * daylight);
    u.uBase.value.set(D.color).lerp(zenith, 0.25).multiplyScalar(0.42 + 0.33 * daylight);
  }

  /** per frame: the plane at the deck height over the player's path point (world-horizontal) */
  update(offset: number, time: number): void {
    const s = missionSpace;
    s.placeWorld(this.mesh, s.px, s.py + offset, s.pz);
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uFlash.value = deckFx.flash;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
