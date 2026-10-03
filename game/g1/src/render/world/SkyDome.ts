// Sky (Phase 2R §6 SKYDEF): ONE dome shader drawn first (depth write off,
// centred on the camera): world-space gradient (the horizon stays level when
// the path pitches), haze band, HDR sun disc + glow (optional second sun),
// stars, high cirrus, and up to three celestial bodies ray-cast in the
// shader — sphere normal from the disc coordinates, lit by the world sun
// (terminator, night side), procedural surfaces in body space (bands /
// craters / icy cracks / rock / void), atmosphere limb, tilted rings with
// the planet's shadow on them and their shadow on the planet. All uniforms:
// a world change never recompiles.
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3, Vector4 } from 'three';
import type { SkyBodyDef, WorldDef } from '../../data/worlds/types';
import { missionSpace } from './missionSpace';
import { AP_UNIFORMS, sunDirection } from './atmosphere';
import type { TodState } from './tod';

const MAX_BODIES = 3;
const SURF: Record<SkyBodyDef['surface'], number> = { banded: 1, cratered: 2, icyCracked: 3, rocky: 4, cloudy: 5, void: 6 };
const DEG = Math.PI / 180;

export const SKY_RADIUS = 4800;

export class SkyDome {
  /** the world's star density (the time of day scales it) */
  private starDensity = 0;
  /** body id per uniform slot (size order) + its spin-axis tilt (sky events move bodies) */
  private bodyIds: string[] = [];
  private bodyTilt: number[] = [];
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor() {
    const v3 = () => Array.from({ length: MAX_BODIES }, () => new Vector3());
    const v4 = () => Array.from({ length: MAX_BODIES }, () => new Vector4());
    const col = () => Array.from({ length: MAX_BODIES }, () => new Color());
    this.material = new ShaderMaterial({
      name: 'sky',
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uPathB: missionSpace.uniforms.uPathB,
        uSunW: AP_UNIFORMS.uSunW,
        uZenith: { value: new Color() },
        uMid: { value: new Color() },
        uHorizon: { value: new Color() },
        uHaze: { value: new Color() },
        uGround: { value: new Color() },
        uSunCol: { value: new Color() },
        uSunDisc: { value: 0.9999 },
        uSunGlow: { value: 1 },
        uSun2W: { value: new Vector3(0, -1, 0) },
        uSun2Col: { value: new Color() },
        uSun2Disc: { value: 1.1 },
        uStars: { value: 0 },
        uRidgeFar: { value: new Color() },
        uMeteors: { value: 0 },
        uAlt: { value: 0 },
        uMeteorAmt: { value: 0 },
        uShipDir: { value: new Vector3(0, 1, 0) },
        uShipAxis: { value: new Vector3(1, 0, 0) },
        uShipOn: { value: 0 },
        uRidgeNear: { value: new Color() },
        uCirrus: { value: 0 },
        uCirrusCol: { value: new Color() },
        uTime: { value: 0 },
        /** 1 while capturing the environment probe: ground bounce below the horizon, no sun disc */
        uProbe: { value: 0 },
        uBounce: { value: new Color() },
        uBodyDir: { value: v3() },
        uBodyAxis: { value: v3() },
        /** x = angular radius (rad), y = surface kind, z = rotation phase, w = atmosphere thickness */
        uBodyP: { value: v4() },
        uBodyA: { value: col() },
        uBodyB: { value: col() },
        uBodyC: { value: col() },
        uBodyAtm: { value: col() },
        /** x = inner, y = outer (planet radii), z = opacity, w = has rings */
        uRing: { value: v4() },
        uRingCol: { value: col() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; // on the far plane
        }`,
      fragmentShader: /* glsl */ `
        uniform mat3 uPathB;
        uniform vec3 uSunW, uZenith, uMid, uHorizon, uHaze, uGround, uSunCol, uSun2W, uSun2Col, uCirrusCol;
        uniform float uSunDisc, uSunGlow, uSun2Disc, uStars, uCirrus, uTime, uProbe;
        uniform vec3 uBounce, uRidgeFar, uRidgeNear, uShipDir, uShipAxis;
        uniform float uMeteors, uMeteorAmt, uShipOn, uAlt;
        uniform vec3 uBodyDir[${MAX_BODIES}];
        uniform vec3 uBodyAxis[${MAX_BODIES}];
        uniform vec4 uBodyP[${MAX_BODIES}];
        uniform vec3 uBodyA[${MAX_BODIES}];
        uniform vec3 uBodyB[${MAX_BODIES}];
        uniform vec3 uBodyC[${MAX_BODIES}];
        uniform vec3 uBodyAtm[${MAX_BODIES}];
        uniform vec4 uRing[${MAX_BODIES}];
        uniform vec3 uRingCol[${MAX_BODIES}];
        varying vec3 vDir;

        float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        float n3(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), u.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), u.x), u.y),
                     mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), u.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), u.x), u.y), u.z);
        }
        float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.02 + 7.1; a *= 0.5; } return s; }
        // cellular distance (craters / cracks)
        vec2 cell(vec3 p) {
          vec3 i = floor(p); float d1 = 9.0, d2 = 9.0;
          for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec3 g = vec3(x, y, z), o = vec3(h31(i + g), h31(i + g + 13.7), h31(i + g + 29.3));
            float d = length(g + o - fract(p));
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          return vec2(d1, d2);
        }

        vec3 surface(int i, vec3 q, float kind) {
          vec3 A = uBodyA[i], B = uBodyB[i], C = uBodyC[i];
          if (kind < 1.5) { // banded gas giant: latitude bands, warped by turbulence
            float lat = q.y;
            float warp = fbm3(q * 3.0 + vec3(uBodyP[i].z, 0.0, 0.0)) - 0.5;
            float b = sin((lat + warp * 0.12) * 26.0) * 0.5 + 0.5;
            float b2 = sin((lat + warp * 0.2) * 61.0) * 0.5 + 0.5;
            vec3 col = mix(A, B, smoothstep(0.25, 0.75, b));
            col = mix(col, C, smoothstep(0.6, 0.95, b2) * 0.55);
            return col * (0.86 + 0.28 * fbm3(q * 9.0));
          }
          if (kind < 2.5) { // cratered moon: maria + crater rims
            float m = smoothstep(0.42, 0.62, fbm3(q * 2.2));
            vec3 col = mix(A, B, m);
            vec2 c = cell(q * 7.0);
            float rim = smoothstep(0.06, 0.0, abs(c.x - 0.32)) * 0.35;
            col *= 0.82 + 0.3 * fbm3(q * 18.0) - smoothstep(0.3, 0.0, c.x) * 0.18 + rim;
            return col;
          }
          if (kind < 3.5) { // icy, cracked
            vec2 c = cell(q * 5.0);
            float crack = smoothstep(0.05, 0.0, c.y - c.x);
            vec3 col = mix(A, B, fbm3(q * 3.0));
            return mix(col, C, crack * 0.85);
          }
          if (kind < 4.5) return mix(A, B, fbm3(q * 4.0)) * (0.8 + 0.4 * fbm3(q * 16.0));
          if (kind < 5.5) return mix(A, B, smoothstep(0.35, 0.7, fbm3(q * 2.5 + vec3(0.0, uBodyP[i].z, 0.0))));
          return vec3(0.0);
        }

        // one body over the colour behind it; returns premultiplied colour + coverage
        vec4 body(int i, vec3 v) {
          float r = uBodyP[i].x * (1.0 + 0.3 * uAlt); // the bodies grow at the edge of the atmosphere
          if (r <= 0.0) return vec4(0.0);
          vec3 d = uBodyDir[i];
          float c = dot(v, d);
          if (c < cos(r * 3.2)) return vec4(0.0); // outside even the rings
          vec3 ax = uBodyAxis[i];
          vec3 t1 = normalize(cross(ax, d)), t2 = cross(d, t1);
          vec2 p = vec2(dot(v, t1), dot(v, t2)) / sin(r);
          float rr = dot(p, p);
          vec4 res = vec4(0.0);
          // sphere hit (visible hemisphere faces the camera, i.e. -d)
          float zf = rr < 1.0 ? sqrt(1.0 - rr) : 0.0;
          vec3 n = p.x * t1 + p.y * t2 - zf * d;
          vec3 sunW = uSunW;
          // rings: plane through the centre, normal = axis; orthographic per body (it is far away)
          vec4 ring = vec4(0.0);
          float ringS = 1e9;
          if (uRing[i].w > 0.5) {
            vec3 P0 = p.x * t1 + p.y * t2;
            float dn = dot(d, ax);
            if (abs(dn) > 1e-4) {
              float s = -dot(P0, ax) / dn;
              vec3 q = P0 + s * d;
              float rq = length(q);
              if (rq > uRing[i].x && rq < uRing[i].y) {
                float t = (rq - uRing[i].x) / (uRing[i].y - uRing[i].x);
                // radial density profile: faint inner ring, dense middle, Cassini-like gap, outer ring
                // with a narrow gap; low-amplitude ringlets (kept coarse: fine ones alias into lines)
                float dens = 0.28 + 0.62 * smoothstep(0.16, 0.24, t) - 0.25 * smoothstep(0.5, 0.6, t);
                dens *= 1.0 - smoothstep(0.035, 0.0, abs(t - 0.64)) * 0.92;
                dens *= 1.0 - smoothstep(0.012, 0.0, abs(t - 0.87)) * 0.7;
                dens *= 0.82 + 0.18 * n3(vec3(t * 46.0, 0.5, 0.5)) + 0.08 * (n3(vec3(t * 13.0, 3.1, 0.5)) - 0.5);
                float a = uRing[i].z * dens * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.94, t);
                // planet shadow on the ring
                float along = dot(q, sunW);
                float perp = length(q - along * sunW);
                float shade = (along < 0.0 && perp < 1.0) ? 0.12 : 1.0;
                float lit = 0.35 + 0.65 * abs(dot(ax, sunW));
                ring = vec4(uRingCol[i] * lit * shade * a, a);
                ringS = s;
              }
            }
          }
          if (rr < 1.0) {
            float lit = dot(n, sunW);
            float day = smoothstep(-0.06, 0.18, lit);
            // body-space coordinates for the surface (spin axis = ax)
            vec3 e1 = normalize(cross(ax, vec3(0.31, 0.12, 0.94))), e2 = cross(ax, e1);
            vec3 q = vec3(dot(n, e1), dot(n, ax), dot(n, e2));
            vec3 col = surface(i, q, uBodyP[i].y);
            // ring shadow on the planet
            if (uRing[i].w > 0.5) {
              float dn2 = dot(sunW, ax);
              if (abs(dn2) > 1e-3) {
                float s2 = -dot(n, ax) / dn2;
                if (s2 > 0.0) { float rq2 = length(n + s2 * sunW); if (rq2 > uRing[i].x && rq2 < uRing[i].y) day *= 1.0 - uRing[i].z * 0.7; }
              }
            }
            vec3 lightCol = mix(vec3(1.0), uSunCol, 0.35);
            vec3 shaded = col * lightCol * (0.025 + 1.15 * day * max(lit, 0.0) + 0.1 * day);
            if (uBodyP[i].y > 5.5) shaded = vec3(0.0);
            // atmosphere limb (lit side brighter)
            float limb = pow(1.0 - zf, 3.0) * uBodyP[i].w * 14.0;
            shaded += uBodyAtm[i] * limb * (0.06 + day);
            res = vec4(shaded, 1.0);
            // ring in FRONT of the planet covers it
            if (ring.a > 0.0 && ringS < -zf) res = vec4(ring.rgb + res.rgb * (1.0 - ring.a), 1.0);
          } else if (ring.a > 0.0) res = ring;
          // soft outer atmosphere glow just outside the limb
          if (rr >= 1.0 && uBodyP[i].w > 0.0) {
            float g = exp(-(sqrt(rr) - 1.0) * 22.0) * uBodyP[i].w * 6.0;
            res.rgb += uBodyAtm[i] * g * 0.6;
            res.a = max(res.a, 0.0);
          }
          return res;
        }

        void main() {
          // the dome is camera-centred in mission space; turn the view direction into WORLD space
          vec3 v = normalize(transpose(uPathB) * normalize(vDir));
          // the edge of the atmosphere (Planet 1 §1.1, uAlt 0..1 above ~300 u): the horizon dips (the
          // world curves away below), the sky darkens toward space, stars show even by day
          float y = v.y + 0.04 * uAlt;
          vec3 sky;
          if (y >= 0.0) {
            sky = mix(uHorizon, uMid, smoothstep(0.0, 0.28, y));
            sky = mix(sky, uZenith, smoothstep(0.22, 0.95, y));
          } else sky = mix(uHorizon, uGround, smoothstep(0.0, -0.2, y));
          sky = mix(sky, uHaze, exp(-abs(y) * 12.0) * 0.55);
          sky = mix(sky, vec3(0.008, 0.014, 0.04), uAlt * 0.62 * smoothstep(0.02, 0.6, y));
          // stars (fade into the sky's brightness)
          // daylight: 0 with the sun below the horizon, 1 in full day
          float dayF = smoothstep(-0.1, 0.22, uSunW.y) * (1.0 - 0.75 * uAlt);
          if (uStars > 0.0 && y > 0.0 && dayF < 0.999) {
            vec3 sc = floor(v * 420.0);
            float st = step(1.0 - 0.0025 * uStars, h31(sc));
            sky += vec3(0.9, 0.95, 1.0) * st * smoothstep(0.05, 0.4, y) * 1.2 * (1.0 - dayF) * (1.0 - smoothstep(0.03, 0.15, dot(sky, vec3(0.33))));
          }
          // bodies (largest first is drawn first: index order = size order from the CPU)
          // the atmosphere is IN FRONT of a body: in daylight its in-scattered sky light adds over the
          // body (the unlit side reads as sky, like a daytime moon) and its light dims toward the
          // horizon; at night bodies occlude the sky normally
          float trans = mix(1.0, 0.9, dayF) * exp(-0.035 / max(y + 0.03, 0.01));
          for (int i = 0; i < ${MAX_BODIES}; i++) {
            vec4 b = body(i, v);
            // the lit side holds its colour (mostly opaque); the night side lets the day sky through
            float occl = mix(1.0, mix(0.45, 0.9, smoothstep(0.02, 0.25, dot(b.rgb, vec3(0.3, 0.5, 0.2)))), dayF);
            sky = b.rgb * trans + sky * (1.0 - b.a * occl);
          }
          // high cirrus: streaked fbm on a plane, fading to the horizon
          if (uCirrus > 0.0 && y > 0.01) {
            vec2 uv = v.xz / (y + 0.08);
            float c = fbm3(vec3(uv.x * 1.6 + uTime * 0.004, uv.y * 0.45, 0.0)) ;
            c = smoothstep(1.0 - uCirrus, 1.0 - uCirrus + 0.35, c) * smoothstep(0.01, 0.18, y);
            float sunLit = pow(max(dot(v, uSunW), 0.0), 4.0);
            sky = mix(sky, uCirrusCol * (0.9 + sunLit * 1.4), c * 0.65);
          }
          // suns: glow + HDR disc
          float cs = dot(v, uSunW);
          sky += uSunCol * (pow(max(cs, 0.0), 6.0) * 0.18 + pow(max(cs, 0.0), 90.0) * 0.9) * uSunGlow;
          float c2 = dot(v, uSun2W);
          if (uProbe > 0.5) {
            // probe: the lit ground below the horizon (bounce), the sun's glow without its disc (the
            // directional light is the sun's highlight; a 40x texel would only sparkle in the PMREM)
            sky = mix(sky, uBounce, smoothstep(0.0, -0.08, y));
            sky += uSunCol * pow(max(cs, 0.0), 24.0) * 1.5;
          } else {
            sky += uSunCol * smoothstep(uSunDisc, uSunDisc + 0.00003, cs) * 40.0;
            sky += uSun2Col * (pow(max(c2, 0.0), 40.0) * 0.5 + smoothstep(uSun2Disc, uSun2Disc + 0.00003, c2) * 20.0);
            // shooting stars (W2b sky events): 3 slots, each a fast streak with a fading tail, placed by
            // hash per period; strength follows the star field (they fade out with the dawn)
            if (uMeteorAmt > 0.001 && y > 0.05) {
              float period = 180.0 / max(uMeteors, 0.1);
              for (int i = 0; i < 3; i++) {
                float t = uTime / period + float(i) * 0.371;
                float k = floor(t), u = fract(t) * period / 0.9;
                if (u < 1.0) {
                  vec3 hk = vec3(k, float(i), 3.7);
                  float maz = h31(hk) * 6.2832, mel = 0.4 + h31(hk + 1.3) * 0.7;
                  vec3 c = vec3(sin(maz) * cos(mel), sin(mel), -cos(maz) * cos(mel));
                  if (dot(v, c) > 0.97) {
                    vec3 t1 = normalize(cross(c, vec3(0.0, 1.0, 0.0)) * (h31(hk + 2.1) < 0.5 ? -1.0 : 1.0) + vec3(0.0, -0.4, 0.0));
                    t1 = normalize(t1 - c * dot(t1, c));
                    vec3 t2 = cross(c, t1);
                    float along = dot(v, t1) - (u - 0.5) * 0.3, across = dot(v, t2);
                    float tail = clamp(1.0 + along / 0.08, 0.0, 1.0) * step(along, 0.0);
                    float m = smoothstep(0.0011, 0.0, abs(across)) * tail * tail * sin(u * 3.1416);
                    sky += vec3(0.85, 0.92, 1.0) * m * 3.0 * uMeteorAmt;
                  }
                }
              }
            }
            // the ICS Meridian in orbit (scale): a sunlit sliver along its track + a blinking beacon
            if (uShipOn > 0.001) {
              // the track axis made tangent at the ship (the from -> to chord is not), offsets from its centre
              vec3 ax1 = normalize(uShipAxis - uShipDir * dot(uShipAxis, uShipDir));
              vec3 ax2 = cross(uShipDir, ax1);
              vec2 sp = vec2(dot(v - uShipDir, ax1), dot(v - uShipDir, ax2));
              if (dot(v, uShipDir) > 0.995) {
                // ~0.35 deg long: a kilometre-class hull a few hundred km up, a dark sliver with a lit edge
                float hull = smoothstep(0.0062, 0.0042, length(sp * vec2(0.42, 2.2)));
                float rim = hull * smoothstep(-0.001, 0.0016, sp.y);
                float beacon = smoothstep(0.0016, 0.0, length(sp - vec2(0.0075, 0.0))) * step(0.82, fract(uTime * 0.9));
                sky = mix(sky, vec3(0.05, 0.06, 0.08), hull * 0.75 * uShipOn) + (uSunCol * 1.4 * rim + vec3(1.0, 0.25, 0.2) * 4.0 * beacon) * uShipOn;
              }
            }
            // far horizon ridges (W2b): two hazy silhouette bands where the terrain ribbon ends (the
            // valley end was empty haze); periodic in azimuth (noise on the unit circle: no seam), low
            // (<= ~2 deg) so a dawn sun can still peek over them; the view only (never the probe)
            vec2 ring = normalize(v.xz + vec2(1e-5));
            float far = 0.008 + 0.05 * pow(1.0 - abs(2.0 * n3(vec3(ring * 4.3, 0.5)) - 1.0), 2.2) + 0.012 * n3(vec3(ring * 17.0, 4.2));
            float near = 0.003 + 0.03 * pow(1.0 - abs(2.0 * n3(vec3(ring * 2.7, 9.3)) - 1.0), 1.8) + 0.009 * n3(vec3(ring * 9.0, 2.7));
            sky = mix(sky, uRidgeFar, smoothstep(far + 0.0015, far - 0.0015, y));
            sky = mix(sky, uRidgeNear, smoothstep(near + 0.0012, near - 0.0012, y));
          }
          gl_FragColor = vec4(sky, 1.0);
        }`,
    });
    this.mesh = new Mesh(new SphereGeometry(SKY_RADIUS, 48, 24), this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  /** world look (uniforms only) */
  setWorld(w: WorldDef): void {
    const u = this.material.uniforms, s = w.sky;
    u.uZenith.value.set(s.zenith);
    u.uMid.value.set(s.mid);
    u.uHorizon.value.set(s.horizon);
    u.uHaze.value.set(s.haze);
    u.uGround.value.set(w.atmosphere.hazeFar);
    // ground bounce for the probe: the ground colour lit by sun + sky (rough albedo x irradiance)
    u.uBounce.value.set(s.groundBounce).multiplyScalar(0.55);
    const sun = s.suns[0];
    u.uSunCol.value.set(sun.color);
    u.uSunDisc.value = Math.cos((sun.discDeg / 2) * DEG);
    u.uSunGlow.value = sun.glow;
    const s2 = s.suns[1];
    if (s2) {
      sunDirection(s2.elevation, s2.azimuth, u.uSun2W.value);
      u.uSun2Col.value.set(s2.color);
      u.uSun2Disc.value = Math.cos((s2.discDeg / 2) * DEG);
    } else u.uSun2Disc.value = 1.1;
    u.uStars.value = this.starDensity = s.stars.density;
    const cirrus = s.clouds.find(c => c.kind === 'cirrus');
    u.uCirrus.value = cirrus ? cirrus.coverage : 0;
    u.uCirrusCol.value.set(cirrus ? cirrus.color : '#ffffff');
    const bodies = [...s.bodies].sort((a, b) => b.angularDeg - a.angularDeg).slice(0, MAX_BODIES);
    this.bodyIds = bodies.map(b => b.id);
    this.bodyTilt = bodies.map(b => (b.rings?.tilt ?? 8) * DEG);
    for (let i = 0; i < MAX_BODIES; i++) {
      const b = bodies[i];
      const P = u.uBodyP.value[i] as Vector4;
      if (!b) {
        P.set(0, 0, 0, 0);
        continue;
      }
      const dir = sunDirection(b.elevation, b.azimuth, u.uBodyDir.value[i]);
      // spin axis: world up tilted toward the camera-right by the ring tilt (bands + rings lean)
      const tilt = (b.rings?.tilt ?? 8) * DEG;
      (u.uBodyAxis.value[i] as Vector3).set(0, 1, 0).applyAxisAngle(dir, tilt).normalize();
      P.set((b.angularDeg / 2) * DEG, SURF[b.surface], b.rotation, b.atmosphere?.thickness ?? 0);
      (u.uBodyA.value[i] as Color).set(b.palette[0]);
      (u.uBodyB.value[i] as Color).set(b.palette[1]);
      (u.uBodyC.value[i] as Color).set(b.palette[2]);
      (u.uBodyAtm.value[i] as Color).set(b.atmosphere?.color ?? '#000000');
      const R = u.uRing.value[i] as Vector4;
      if (b.rings) {
        R.set(b.rings.inner, b.rings.outer, b.rings.opacity, 1);
        (u.uRingCol.value[i] as Color).set(b.rings.color);
      } else R.set(0, 0, 0, 0);
    }
  }

  /** sky event: move a world body (planet-rise over a ridge); uniforms only */
  setBody(id: string, el: number, az: number): void {
    const i = this.bodyIds.indexOf(id);
    if (i < 0) return;
    const u = this.material.uniforms;
    const dir = sunDirection(el, az, u.uBodyDir.value[i]);
    (u.uBodyAxis.value[i] as Vector3).set(0, 1, 0).applyAxisAngle(dir, this.bodyTilt[i]).normalize();
  }

  /** the edge of the atmosphere: 0 below ~300 u above the path baseline .. 1 at the service ceiling */
  setAltitude(a: number): void {
    this.material.uniforms.uAlt.value = a;
  }

  /** sky events: shooting stars (per minute, x visibility) and the Meridian (direction, track, 0 = off) */
  setEvents(meteorsPerMin: number, meteorAmt: number, shipDir: Vector3 | null, shipAxis: Vector3 | null): void {
    const u = this.material.uniforms;
    u.uMeteors.value = meteorsPerMin;
    u.uMeteorAmt.value = meteorAmt;
    u.uShipOn.value = shipDir ? 1 : 0;
    if (shipDir && shipAxis) {
      u.uShipDir.value.copy(shipDir);
      u.uShipAxis.value.copy(shipAxis);
    }
  }

  /** time of day (render/world/tod.ts): gradient, sun colour, stars (uniforms only) */
  applyTod(t: TodState): void {
    const u = this.material.uniforms;
    u.uZenith.value.copy(t.zenith);
    u.uMid.value.copy(t.mid);
    u.uHorizon.value.copy(t.horizon);
    u.uSunCol.value.copy(t.sunColor);
    u.uStars.value = this.starDensity * t.stars;
    // ridge silhouettes sit IN the haze: far = between the horizon glow and the far haze, near = the far
    // haze a little darker (aerial perspective: nearer ranges are darker, never a flat band)
    u.uRidgeFar.value.copy(t.horizon).lerp(t.hazeFar, 0.55);
    u.uRidgeNear.value.copy(t.hazeFar).lerp(t.horizon, 0.25).multiplyScalar(0.88);
  }

  /** per frame: centre on the camera (mission-scene position relative to the dome's parent) */
  update(camLocal: Vector3, time: number): void {
    this.mesh.position.copy(camLocal);
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
