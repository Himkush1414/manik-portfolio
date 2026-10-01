// Through the canopy (brief §15): a long launch tunnel with receding strip
// lights and hazard bars ending in a bay opening that frames deep space,
// stars, carrier hull lights and a distant swirling Veil glow. Behind the
// ship: the launch bay's back wall (seen in the mirrors). Cockpit-local
// metres; the ship rides a rail with its eye at the origin.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '../../core/rng';
import { hdr, col } from '../../render/palette';
import { getDoorAssets } from '../shared/doors/doorAssets';

// zEnd: the mouth must read through the canopy (at -190 it was a ~100 px patch)
export const TUNNEL = { floor: -1.9, half: 7, height: 9, zBack: 26, zEnd: -84, rib: 6 } as const;

function hazardTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b4830f';
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#0d0e12';
  for (let x = -32; x < 256; x += 32) {
    g.beginPath();
    g.moveTo(x, 32);
    g.lineTo(x + 16, 32);
    g.lineTo(x + 48, 0);
    g.lineTo(x + 32, 0);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function LaunchTunnel({ reduceMotion }: { reduceMotion: boolean }) {
  const b = useMemo(() => {
    const { floor: Fy, half: X, height: Hh, zBack, zEnd, rib } = TUNNEL;
    const top = Fy + Hh;
    const L = zBack - zEnd, zMid = (zBack + zEnd) / 2;
    const set = getDoorAssets()?.frameMetal;
    const wallMat = new MeshStandardMaterial({ color: '#39404f', map: set?.map ?? null, normalMap: set?.normal ?? null, roughnessMap: set?.orm ?? null, metalness: 0.7, roughness: 1, envMapIntensity: 0.25 });
    const darkMat = new MeshStandardMaterial({ color: '#0c0e14', roughness: 0.8, metalness: 0.3 });
    const hazTex = hazardTexture();
    hazTex.repeat.set(L / 2, 1);
    const hazMat = new MeshStandardMaterial({ map: hazTex, roughness: 0.6, metalness: 0.2 });
    // shell: floor, ceiling, walls (inward-facing), with the opening at zEnd
    const shell = mergeGeometries([
      new BoxGeometry(2 * X, 0.4, L).translate(0, Fy - 0.2, zMid),
      new BoxGeometry(2 * X, 0.4, L).translate(0, top + 0.2, zMid),
      new BoxGeometry(0.4, Hh, L).translate(-X - 0.2, Fy + Hh / 2, zMid),
      new BoxGeometry(0.4, Hh, L).translate(X + 0.2, Fy + Hh / 2, zMid),
      new BoxGeometry(2 * X, Hh, 0.6).translate(0, Fy + Hh / 2, zBack + 0.3), // bay back wall
    ])!;
    // rib frames every `rib` metres (instanced: 4 bars per rib merged)
    const ribGeo = mergeGeometries([
      new BoxGeometry(0.5, Hh, 0.5).translate(-X + 0.25, Fy + Hh / 2, 0),
      new BoxGeometry(0.5, Hh, 0.5).translate(X - 0.25, Fy + Hh / 2, 0),
      new BoxGeometry(2 * X, 0.5, 0.5).translate(0, top - 0.25, 0),
      new BoxGeometry(1.2, 0.8, 0.5).rotateZ(0.8).translate(-X + 0.7, top - 0.7, 0),
      new BoxGeometry(1.2, 0.8, 0.5).rotateZ(-0.8).translate(X - 0.7, top - 0.7, 0),
    ])!;
    const nRib = Math.floor(L / rib);
    const ribs = new InstancedMesh(ribGeo, wallMat, nRib);
    const m = new Matrix4();
    for (let i = 0; i < nRib; i++) ribs.setMatrixAt(i, m.makeTranslation(0, 0, zBack - 2 - i * rib));
    // strip lights: ceiling corners + floor edges, every 3 m (receding lines)
    const stripGeo = new BoxGeometry(0.12, 0.06, 1.6);
    const spots: Vector3[] = [];
    for (let z = zBack - 3; z > zEnd + 2; z -= 3) {
      spots.push(new Vector3(-X + 0.9, top - 0.05, z), new Vector3(X - 0.9, top - 0.05, z), new Vector3(-X + 0.4, Fy + 0.05, z), new Vector3(X - 0.4, Fy + 0.05, z));
    }
    const stripMat = new MeshBasicMaterial({ color: hdr('frost', 2.4), toneMapped: false });
    const strips = new InstancedMesh(stripGeo, stripMat, spots.length);
    spots.forEach((p, i) => strips.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    // centre launch rail + hazard bands along the floor
    const rail = new BoxGeometry(0.5, 0.25, L).translate(0, Fy + 0.12, zMid);
    const haz = new PlaneGeometry(0.5, L).rotateX(-Math.PI / 2);
    // bay back wall lights (mirrors see these)
    const bayLights = mergeGeometries([-4, -1.5, 1.5, 4].map(x => new BoxGeometry(1.4, 0.14, 0.05).translate(x, top - 1.2, zBack - 0.02)))!;
    const bayMat = new MeshBasicMaterial({ color: hdr('core', 2.2), toneMapped: false });
    // opening frame + carrier hull lights around the mouth
    const mouth = mergeGeometries([
      new BoxGeometry(2 * X + 4, 1.2, 1.5).translate(0, top + 0.2, zEnd),
      new BoxGeometry(2 * X + 4, 1.2, 1.5).translate(0, Fy - 0.2, zEnd),
      new BoxGeometry(1.2, Hh + 2, 1.5).translate(-X - 0.6, Fy + Hh / 2, zEnd),
      new BoxGeometry(1.2, Hh + 2, 1.5).translate(X + 0.6, Fy + Hh / 2, zEnd),
    ])!;
    const hullLights: Vector3[] = [];
    const rng = createRng(1717);
    for (let i = 0; i < 18; i++) hullLights.push(new Vector3(rng.range(-X - 1, X + 1), rng.next() < 0.5 ? top + 0.8 : Fy - 0.8, zEnd + 0.8));
    const blinkGeo = new BufferGeometry();
    blinkGeo.setAttribute('position', new Float32BufferAttribute(hullLights.flatMap(p => p.toArray()), 3));
    blinkGeo.setAttribute('aSeed', new Float32BufferAttribute(hullLights.map(() => rng.next()), 1));
    const blinkMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime; varying float vB; varying float vR;
        void main(){ vR = step(0.5, aSeed); vB = step(0.72, fract(uTime * (0.4 + aSeed * 0.5) + aSeed * 7.0));
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 5.0 * (60.0 / -mv.z) + 2.0; }`,
      fragmentShader: /* glsl */ `varying float vB; varying float vR;
        void main(){ vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c)*14.0) * (0.25 + vB * 3.0);
          gl_FragColor = vec4(mix(vec3(1.0,0.2,0.25), vec3(1.0), vR) * a, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const blinks = new Points(blinkGeo, blinkMat);
    blinks.frustumCulled = false;
    // deep space through the mouth: ONE opaque window plane (a star sphere put
    // ~3 stars inside the opening; a far Veil plane read as a flat panel).
    // Two procedural star layers + the Veil as a log-spiral whose bright core
    // sits just outside the opening, so the mouth frames arms and dark lanes.
    const skyGeo = new PlaneGeometry(260, 170);
    const skyMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uA: { value: col('nebula') }, uB: { value: col('ice') }, uV: { value: col('violet') } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uA, uB, uV; varying vec2 vUv;
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
        float stars(vec2 p, float scale, float k, float dens){
          vec2 g = p * scale, id = floor(g), f = fract(g) - 0.5;
          float r = h21(id);
          vec2 off = vec2(h21(id + 7.1), h21(id + 3.3)) - 0.5;
          vec2 d = f - off * 0.7;
          float tw = 0.75 + 0.25 * sin(uTime * (0.8 + r * 2.5) + r * 40.0);
          float big = r * r; big *= big; big *= big; // r^8 without pow()
          return exp(-dot(d, d) * k) * step(1.0 - dens, r) * tw * (0.5 + 2.4 * big);
        }
        void main(){
          vec2 p = (vUv - 0.5) * vec2(260.0 / 170.0, 1.0);
          vec3 c = vec3(0.85, 0.9, 1.0) * (0.9 * stars(p, 60.0, 90.0, 0.11) + 0.45 * stars(p + 3.7, 140.0, 30.0, 0.16));
          // the Veil: log-spiral arms, centred up-right of the opening
          vec2 q = p - vec2(0.4, 0.21);
          float r = length(q), a = atan(q.y, q.x);
          float sw = a * 2.0 + log(r + 0.02) * 4.2 - uTime * 0.05;
          float arms = 0.5 + 0.5 * sin(sw);
          float f = fbm(q * 7.0 + vec2(cos(sw), sin(sw)) * 0.35 + uTime * 0.01);
          float lanes = smoothstep(0.38, 0.8, f * (0.45 + 0.75 * arms));
          float mask = exp(-r * r * 8.0);
          vec3 veil = mix(uV, uA, smoothstep(0.1, 0.9, f)) * lanes * mask * 0.62;
          veil += uB * exp(-r * r * 60.0) * 1.2 + uA * exp(-r * r * 14.0) * 0.1;
          c = c * (1.0 - clamp(lanes * mask, 0.0, 1.0) * 0.6) + veil; // dust dims the stars behind it
          gl_FragColor = vec4(c, 1.0);
        }`,
      fog: false,
      toneMapped: false,
    });
    const sky = new Mesh(skyGeo, skyMat);
    sky.position.set(0, Fy + Hh / 2, zEnd - 300);
    return { wallMat, darkMat, hazTex, hazMat, shell, ribGeo, ribs, stripGeo, stripMat, strips, rail, haz, bayLights, bayMat, mouth, blinks, blinkGeo, blinkMat, sky, skyGeo, skyMat };
  }, []);

  useEffect(
    () => () => {
      [b.shell, b.ribGeo, b.stripGeo, b.rail, b.haz, b.bayLights, b.mouth, b.blinkGeo, b.skyGeo].forEach(g => g.dispose());
      [b.wallMat, b.darkMat, b.hazMat, b.stripMat, b.bayMat, b.blinkMat, b.skyMat].forEach(m => m.dispose());
      b.hazTex.dispose();
      b.ribs.dispose();
      b.strips.dispose();
    },
    [b],
  );

  useFrame(state => {
    const t = reduceMotion ? 0 : state.clock.elapsedTime;
    b.blinkMat.uniforms.uTime.value = state.clock.elapsedTime;
    b.skyMat.uniforms.uTime.value = t;
  });

  const { floor: Fy, zBack, zEnd } = TUNNEL;
  return (
    <group name="launch-tunnel">
      <mesh geometry={b.shell} material={b.wallMat} receiveShadow />
      <primitive object={b.ribs} />
      <primitive object={b.strips} />
      <mesh geometry={b.rail} material={b.darkMat} />
      <mesh geometry={b.haz} material={b.hazMat} position={[-1.2, Fy + 0.02, (zBack + zEnd) / 2]} />
      <mesh geometry={b.haz} material={b.hazMat} position={[1.2, Fy + 0.02, (zBack + zEnd) / 2]} />
      <mesh geometry={b.bayLights} material={b.bayMat} />
      <mesh geometry={b.mouth} material={b.darkMat} />
      <primitive object={b.blinks} />
      <primitive object={b.sky} />
    </group>
  );
}
