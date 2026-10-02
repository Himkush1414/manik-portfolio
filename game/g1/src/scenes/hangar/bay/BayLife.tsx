// The bay's moving parts (brief §11 BAY): gantry cranes traversing the ceiling
// rails, rotating amber beacons, flickering holo-displays with scrolling data,
// volumetric light shafts under the ceiling fixtures with dust motes drifting
// in them, steam vents and occasional welding sparks. Few draw calls: instanced
// or merged per material; every effect has a reduced-motion / reduced-flashing
// behaviour.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '../../../core/constants';
import { createRng } from '../../../core/rng';
import { hdr } from '../../../render/palette';
import { BAY } from './bayGeometry';

const SHAFTS: [number, number][] = [[-5.5, -3], [5.5, -3], [-5.5, 5], [5.5, 5]];
const BEACONS: [number, number, number, number][] = [
  // x, y, z, facing (+1 = on the left wall facing +x)
  [-BAY.x + 0.4, 8.6, -12, 1], [BAY.x - 0.4, 8.6, -12, -1],
  [-BAY.x + 0.4, 8.6, 6.8, 1], [BAY.x - 0.4, 8.6, 6.8, -1],
  [-BAY.x + 0.4, 8.6, 25, 1], [BAY.x - 0.4, 8.6, 25, -1],
];
const HOLO: { pos: [number, number, number]; rotY: number; w: number; h: number; seed: number }[] = [
  { pos: [-BAY.x + 0.35, 10.2, -5], rotY: Math.PI / 2, w: 4.2, h: 2.4, seed: 1 },
  { pos: [BAY.x - 0.35, 10.2, -5], rotY: -Math.PI / 2, w: 4.2, h: 2.4, seed: 2 },
  { pos: [-BAY.x + 0.35, 4.4, 13], rotY: Math.PI / 2, w: 3.2, h: 1.8, seed: 3 },
  { pos: [BAY.x - 0.35, 4.4, 13], rotY: -Math.PI / 2, w: 3.2, h: 1.8, seed: 4 },
];
const STEAM: [number, number][] = [[-BAY.x + 1.2, -18], [BAY.x - 1.2, 1.5], [-BAY.x + 1.2, 19]];
const WELD: Vector3[] = [new Vector3(-9.2, 2.6, -12.2), new Vector3(9.6, 3.2, -13.4)];

/** Scrolling data readout drawn once; the shader scrolls + flickers it. */
function holoTexture(seed: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  const rng = createRng(seed * 97);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 512);
  g.font = '500 13px "JetBrains Mono", "IBM Plex Mono", monospace';
  g.fillStyle = '#9fe0ff';
  const words = ['HULL', 'SHLD', 'FUEL', 'REPULS', 'NAV', 'LINK', 'GATE', 'BAY07', 'WRLD', 'PWR', 'TEMP', 'SYNC'];
  for (let y = 16; y < 512; y += 18) {
    if (rng.next() < 0.18) {
      // a sparkline row
      g.strokeStyle = 'rgba(159,224,255,0.9)';
      g.beginPath();
      for (let x = 8; x < 248; x += 8) g.lineTo(x, y - 6 + Math.sin(x * 0.07 + seed + y) * 5 * rng.next());
      g.stroke();
      continue;
    }
    const w = words[Math.floor(rng.next() * words.length)];
    const v = (rng.next() * 999).toFixed(rng.next() < 0.5 ? 1 : 0).padStart(5, '0');
    g.globalAlpha = 0.55 + rng.next() * 0.45;
    g.fillText(`${w.padEnd(7, '.')}${v}  ${rng.next() < 0.2 ? '▲' : '·'}`, 10, y);
    g.globalAlpha = 1;
    g.fillRect(200, y - 9, 40 * rng.next(), 6);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapT = RepeatWrapping;
  return t;
}

export function BayLife({ particles = 1, reduceMotion = false, reduceFlashing = false }: { particles?: number; reduceMotion?: boolean; reduceFlashing?: boolean }) {
  const cranes = useRef<Group[]>([]);
  const built = useMemo(() => {
    const rng = createRng(3131 + SEED);
    const steel = new MeshStandardMaterial({ color: '#3b4252', metalness: 0.85, roughness: 0.45, envMapIntensity: 0.3 });
    const hazard = new MeshStandardMaterial({ color: '#8a3a18', metalness: 0.4, roughness: 0.6, envMapIntensity: 0.3 });
    const amber = new MeshBasicMaterial({ color: hdr('hot', 3.5), toneMapped: false });

    // --- gantry crane: bridge girder across the bay + end trucks + trolley + hook
    const cranePart = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(x, y, z);
    const craneSteel = mergeGeometries([
      cranePart(22.6, 0.9, 0.7, 0, 19.15, 0.45),
      cranePart(22.6, 0.9, 0.7, 0, 19.15, -0.45),
      cranePart(1.4, 0.7, 2.4, -11, 19.9, 0),
      cranePart(1.4, 0.7, 2.4, 11, 19.9, 0),
      new CylinderGeometry(0.03, 0.03, 4.6, 6).translate(0, 16.4, 0.2),
      new CylinderGeometry(0.03, 0.03, 4.6, 6).translate(0, 16.4, -0.2),
    ])!;
    const craneHazard = mergeGeometries([cranePart(2.0, 0.9, 2.2, 0, 18.45, 0), cranePart(0.8, 0.9, 0.5, 0, 13.8, 0), new ConeGeometry(0.28, 0.6, 8).rotateX(Math.PI).translate(0, 13.1, 0)])!;
    const craneLamp = new SphereGeometry(0.12, 10, 8).translate(0, 18.0, 1.15);

    // --- beacons: housing + amber dome (instanced) + rotating beam cards
    const housing = new CylinderGeometry(0.22, 0.26, 0.3, 14);
    const dome = new SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const housings = new InstancedMesh(housing, steel, BEACONS.length);
    const domes = new InstancedMesh(dome, amber, BEACONS.length);
    const m = new Matrix4();
    BEACONS.forEach(([x, y, z], i) => {
      housings.setMatrixAt(i, m.makeTranslation(x, y, z));
      domes.setMatrixAt(i, m.makeTranslation(x, y + 0.15, z));
    });
    const beamMat = new ShaderMaterial({
      uniforms: { uCol: { value: hdr('hot', 1.2) } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying vec2 vUv;
        void main(){
          float along = vUv.x;                              // 0 at the lamp
          float across = abs(vUv.y - 0.5) * 2.0;
          float cone = 0.08 + along * 0.9;                   // widens away from the lamp
          // pow() on extrapolated varyings -> NaN -> black frame (engine notes): clamp first
          float a = pow(clamp(1.0 - along, 0.0, 1.0), 2.2) * pow(clamp(1.0 - across / cone, 0.0, 1.0), 2.0) * 0.22;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uCol * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    // a beam card: 5 u long, widening, pivot at the lamp
    const beamGeo = new PlaneGeometry(5, 1.6, 1, 1).translate(2.5, 0, 0);
    const beams = new InstancedMesh(beamGeo, beamMat, BEACONS.length * 2);
    beams.frustumCulled = false;

    // --- holo displays
    const holoMats = HOLO.map(
      h =>
        new ShaderMaterial({
          uniforms: { uTex: { value: holoTexture(h.seed) }, uTime: { value: 0 }, uCol: { value: hdr('ice', 1.1) }, uSeed: { value: h.seed }, uFlicker: { value: 1 } },
          vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: /* glsl */ `
            uniform sampler2D uTex; uniform float uTime, uSeed, uFlicker; uniform vec3 uCol; varying vec2 vUv;
            void main(){
              vec2 uv = vec2(vUv.x, vUv.y * 0.45 + uTime * 0.035 + uSeed * 0.21);
              float d = texture2D(uTex, uv).r;
              float scan = 0.8 + 0.2 * sin(vUv.y * 220.0);
              vec2 e = min(vUv, 1.0 - vUv);
              float frame = 1.0 - smoothstep(0.0, 0.02, min(e.x, e.y));
              float glitch = step(0.985, fract(sin(floor(uTime * 9.0) + uSeed * 7.0) * 43758.5)) * uFlicker;
              float a = (d * scan * 0.75 + frame * 0.6 + 0.04) * (1.0 - glitch * 0.6);
              gl_FragColor = vec4(uCol * a, 1.0);
            }`,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
    );
    const holoGeos = HOLO.map(h => new PlaneGeometry(h.w, h.h));
    const bracket = mergeGeometries(HOLO.map(h => new BoxGeometry(0.12, h.h + 0.3, h.w + 0.3).translate(h.pos[0] + (h.rotY > 0 ? -0.12 : 0.12), h.pos[1], h.pos[2])))!;

    // --- light shafts: open cones under the four ceiling fixtures
    const shaftGeo = mergeGeometries(
      SHAFTS.map(([x, z]) => new CylinderGeometry(1.2, 4.2, BAY.y - 0.6, 24, 1, true).translate(x, (BAY.y - 0.6) / 2, z)),
    )!;
    const shaftMat = new ShaderMaterial({
      uniforms: { uCol: { value: hdr('core', 0.9) }, uTime: { value: 0 }, uTop: { value: BAY.y - 0.6 } },
      vertexShader: /* glsl */ `
        varying vec3 vW; varying vec3 vN; varying vec3 vV;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uTime, uTop;
        varying vec3 vW; varying vec3 vN; varying vec3 vV;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float y = clamp(vW.y / uTop, 0.0, 1.0);
          float edge = pow(abs(dot(normalize(vN), vV)), 1.6);        // soft cone edges
          float streak = 0.6 + 0.4 * n(vec2(atan(vW.z, vW.x) * 6.0, vW.y * 0.25 - uTime * 0.05));
          float a = edge * streak * pow(y, 1.2) * 0.1;
          gl_FragColor = vec4(uCol * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
      fog: false,
    });

    // --- dust motes inside the shafts
    const nDust = Math.round(420 * particles);
    const dPos = new Float32Array(nDust * 3), dSeed = new Float32Array(nDust);
    for (let i = 0; i < nDust; i++) {
      const [sx, sz] = SHAFTS[i % SHAFTS.length];
      const y = rng.range(0.5, BAY.y - 1);
      const r = (1.2 + (1 - y / BAY.y) * 3) * Math.sqrt(rng.next());
      const a = rng.range(0, Math.PI * 2);
      dPos.set([sx + Math.cos(a) * r, y, sz + Math.sin(a) * r], i * 3);
      dSeed[i] = rng.next();
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new Float32BufferAttribute(dPos, 3));
    dustGeo.setAttribute('aSeed', new Float32BufferAttribute(dSeed, 1));
    const dustMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: hdr('core', 1.4) } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uTime * 0.13 + aSeed * 40.0) * 0.6, sin(uTime * 0.07 + aSeed * 17.0) * 0.8, cos(uTime * 0.11 + aSeed * 23.0) * 0.6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.4 + 0.6 * sin(uTime * (0.5 + aSeed) + aSeed * 9.0) * 0.5 + 0.3) * smoothstep(80.0, 20.0, -mv.z);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.0 + aSeed * 1.6) * (28.0 / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c) * 18.0) * vA * 0.5; if (a < 0.01) discard; gl_FragColor = vec4(uCol * a, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const dust = new Points(dustGeo, dustMat);
    dust.frustumCulled = false;

    // --- steam: soft sprites rising from floor grates (normal blending)
    const nSteam = Math.round(90 * particles);
    const sPos = new Float32Array(nSteam * 3), sSeed = new Float32Array(nSteam);
    for (let i = 0; i < nSteam; i++) {
      const [x, z] = STEAM[i % STEAM.length];
      sPos.set([x, 0, z], i * 3);
      sSeed[i] = rng.next();
    }
    const steamGeo = new BufferGeometry();
    steamGeo.setAttribute('position', new Float32BufferAttribute(sPos, 3));
    steamGeo.setAttribute('aSeed', new Float32BufferAttribute(sSeed, 1));
    const steamMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: hdr('steel', 0.55) } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; varying float vA;
        void main(){
          float life = 4.5 + aSeed * 2.0;
          float k = fract(uTime / life + aSeed);
          vec3 p = position + vec3(sin(aSeed * 30.0 + k * 3.0) * k * 1.2, k * 5.5, cos(aSeed * 11.0 + k * 2.0) * k * 1.2);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.15, k) * (1.0 - smoothstep(0.45, 1.0, k));
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (40.0 + k * 160.0) * (1.0 / -mv.z) * 10.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c) * 7.0) * vA * 0.1; if (a < 0.004) discard; gl_FragColor = vec4(uCol, a); }`,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    const steam = new Points(steamGeo, steamMat);
    steam.frustumCulled = false;
    const grate = mergeGeometries(STEAM.map(([x, z]) => new BoxGeometry(1.6, 0.04, 1.6).translate(x, 0.02, z)))!;

    // --- welding sparks: bursts with gravity, re-seeded per burst
    const nSpark = 64;
    const kGeo = new BufferGeometry();
    kGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(nSpark * 3), 3));
    const kVel = new Float32Array(nSpark * 3);
    for (let i = 0; i < nSpark; i++) kVel.set([rng.range(-2.4, 2.4), rng.range(0.5, 4.5), rng.range(-2.4, 2.4)], i * 3);
    kGeo.setAttribute('aVel', new Float32BufferAttribute(kVel, 3));
    const sparkMat = new ShaderMaterial({
      uniforms: { uAge: { value: 99 }, uOrigin: { value: new Vector3() }, uCol: { value: hdr('core', 6) } },
      vertexShader: /* glsl */ `
        attribute vec3 aVel; uniform float uAge; uniform vec3 uOrigin; varying float vA;
        void main(){
          float t = uAge * (0.7 + fract(aVel.x * 13.1) * 0.6);
          vec3 p = uOrigin + aVel * t + vec3(0.0, -4.9 * t * t, 0.0);
          p.y = max(p.y, 0.02);
          vA = clamp(1.0 - t / 0.9, 0.0, 1.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 2.2 * (24.0 / -mv.z) + 1.0;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying float vA;
        void main(){ if (vA <= 0.0) discard; vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c) * 12.0) * vA; gl_FragColor = vec4(uCol * a, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const sparks = new Points(kGeo, sparkMat);
    sparks.frustumCulled = false;
    const arcMat = new MeshBasicMaterial({ color: hdr('ice', 8), toneMapped: false, transparent: true, opacity: 0 });
    const arc = new Mesh(new SphereGeometry(0.09, 8, 6), arcMat);

    return {
      steel, hazard, amber, craneSteel, craneHazard, craneLamp, housing, dome, housings, domes, beamMat, beamGeo, beams,
      holoMats, holoGeos, bracket, shaftGeo, shaftMat, dust, dustGeo, dustMat, steam, steamGeo, steamMat, grate,
      sparks, kGeo, sparkMat, arc, arcMat,
    };
  }, [particles]);

  useEffect(
    () => () => {
      const b = built;
      [b.steel, b.hazard, b.amber, b.beamMat, b.shaftMat, b.dustMat, b.steamMat, b.sparkMat, b.arcMat, ...b.holoMats].forEach(m => m.dispose());
      b.holoMats.forEach(m => (m.uniforms.uTex.value as CanvasTexture).dispose());
      [b.craneSteel, b.craneHazard, b.craneLamp, b.housing, b.dome, b.beamGeo, b.bracket, b.shaftGeo, b.dustGeo, b.steamGeo, b.grate, b.kGeo, b.arc.geometry, ...b.holoGeos].forEach(g => g.dispose());
      b.housings.dispose();
      b.domes.dispose();
      b.beams.dispose();
    },
    [built],
  );

  const weld = useRef({ next: 3, age: 99, at: 0 });
  const dummy = useMemo(() => new Object3D(), []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const still = reduceMotion;
    // cranes ping-pong slowly along the rails
    cranes.current.forEach((g, i) => {
      if (!g) return;
      const span = 44, speed = 0.35, ph = i * 0.5;
      const u = still ? 0.3 + i * 0.4 : (Math.sin((t * speed) / span * Math.PI + ph * Math.PI) * 0.5 + 0.5);
      // stay behind the pad: a crane nearer than z ~ 6 swings its hook through
      // the hangar camera's frame (a huge red wedge at the top of the shot)
      g.position.z = -20 + u * 24;
    });
    // beacons: two beam cards per lamp, sweeping
    BEACONS.forEach(([x, y, z, f], i) => {
      const a = still ? 0.8 : t * 3.2 + i * 1.3;
      for (let k = 0; k < 2; k++) {
        dummy.position.set(x, y + 0.12, z);
        dummy.rotation.set(0, a + k * Math.PI, 0);
        const vis = Math.cos(a + k * Math.PI) * f > -0.2 ? 1 : 0.0001; // no beam through the wall
        dummy.scale.setScalar(vis);
        dummy.updateMatrix();
        built.beams.setMatrixAt(i * 2 + k, dummy.matrix);
      }
    });
    built.beams.instanceMatrix.needsUpdate = true;
    built.beams.visible = !reduceFlashing;
    built.holoMats.forEach(m => {
      m.uniforms.uTime.value = still ? 0 : t;
      m.uniforms.uFlicker.value = reduceFlashing ? 0 : 1;
    });
    built.shaftMat.uniforms.uTime.value = t;
    built.dustMat.uniforms.uTime.value = still ? 0 : t;
    built.steamMat.uniforms.uTime.value = t;
    built.steam.visible = !still;
    // welding: a burst every 3-8 s at one of the parked fighters
    const w = weld.current;
    w.age += dt;
    if (!still && !reduceFlashing && t > w.next) {
      w.age = 0;
      w.at = (w.at + 1) % WELD.length;
      built.sparkMat.uniforms.uOrigin.value.copy(WELD[w.at]);
      built.arc.position.copy(WELD[w.at]);
      w.next = t + 3 + ((t * 7.31) % 5);
    }
    built.sparkMat.uniforms.uAge.value = w.age;
    built.arcMat.opacity = w.age < 0.45 ? (Math.sin(t * 90) > 0 ? 1 : 0.35) : 0;
  });

  return (
    <group name="bay-life">
      {[0, 1].map(i => (
        <group key={i} ref={g => void (g && (cranes.current[i] = g))}>
          <mesh geometry={built.craneSteel} material={built.steel} />
          <mesh geometry={built.craneHazard} material={built.hazard} />
          <mesh geometry={built.craneLamp} material={built.amber} />
        </group>
      ))}
      <primitive object={built.housings} />
      <primitive object={built.domes} />
      <primitive object={built.beams} />
      {HOLO.map((h, i) => (
        <mesh key={i} geometry={built.holoGeos[i]} material={built.holoMats[i]} position={h.pos} rotation-y={h.rotY} />
      ))}
      <mesh geometry={built.bracket} material={built.steel} />
      <mesh geometry={built.shaftGeo} material={built.shaftMat} renderOrder={6} />
      <primitive object={built.dust} />
      <mesh geometry={built.grate} material={built.steel} />
      <primitive object={built.steam} />
      <primitive object={built.sparks} />
      <primitive object={built.arc} />
    </group>
  );
}
