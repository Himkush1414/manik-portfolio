// Display pad (brief §11 PAD): 22 u turntable. Stepped lathe top plate with
// grooves + bolt circle (rotates with the turntable), segmented emissive
// Ignition ring (slow chase), counter-rotating outer tick ring, three
// projector pylons, an outward pulse ring and a horizontal scan plane for
// ship swaps (padFx).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  CircleGeometry,
  ShaderMaterial,
  Vector2,
} from 'three';
import { hdr } from '../../render/palette';
import { padFx } from './padFx';
import { turntable } from './turntable';

const RING = { r0: 9.95, r1: 10.22, y: 0.235, segs: 48 };
const OUTER = { r0: 10.55, r1: 10.95, y: 0.215 };

function plateProfile(): Vector2[] {
  // (radius, height) from the centre out: raised hub, grooves, bevelled rim
  const pts: [number, number][] = [
    [0, 0.26], [2.2, 0.26], [2.25, 0.24], [2.35, 0.24], [2.4, 0.22],
    [5.3, 0.22], [5.35, 0.2], [5.45, 0.2], [5.5, 0.22],
    [7.9, 0.22], [7.95, 0.2], [8.05, 0.2], [8.1, 0.22],
    [9.6, 0.22], [9.7, 0.2], [10.45, 0.2], [10.5, 0.19], [11.05, 0.19], [11.2, 0.12], [11.25, 0],
  ];
  // lathe winding: listed centre-out, the faces point DOWN (culled) — reverse
  return pts.reverse().map(([r, h]) => new Vector2(r, h));
}

function ringMaterial(kind: 'segments' | 'ticks'): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uCol: { value: kind === 'segments' ? hdr('ignition', 1.9) : hdr('steel', 0.55) },
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uR: { value: new Vector2(kind === 'segments' ? RING.r0 : OUTER.r0, kind === 'segments' ? RING.r1 : OUTER.r1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader:
      kind === 'segments'
        ? /* glsl */ `
      uniform vec3 uCol; uniform float uTime, uPulse; uniform vec2 uR;
      varying vec2 vP;
      void main() {
        float a = atan(vP.y, vP.x) / 6.2831853 + 0.5;
        float seg = fract(a * ${RING.segs}.0);
        if (seg < 0.14) discard;                      // segment gaps
        float idx = floor(a * ${RING.segs}.0);
        float chase = 0.55 + 0.45 * pow(clamp(0.5 + 0.5 * sin(idx * 0.52 - uTime * 2.4), 0.0, 1.0), 6.0);
        float r = (length(vP) - uR.x) / (uR.y - uR.x);
        float edge = smoothstep(0.0, 0.18, r) * smoothstep(1.0, 0.82, r);
        float flash = (1.0 - uPulse) * 1.6;
        gl_FragColor = vec4(uCol * (0.35 + chase + flash) * (0.4 + 0.6 * edge), 1.0);
      }`
        : /* glsl */ `
      uniform vec3 uCol; uniform float uTime; uniform vec2 uR;
      varying vec2 vP;
      void main() {
        float a = atan(vP.y, vP.x) / 6.2831853 + 0.5;
        float t = fract(a * 180.0);
        float major = step(0.9, fract(a * 12.0 + 0.04));
        float r = (length(vP) - uR.x) / (uR.y - uR.x);
        float tick = step(0.82, t) * step(r, 0.55 + major * 0.45);
        if (tick < 0.5 && major < 0.5) discard;
        gl_FragColor = vec4(uCol * (0.4 + major * 0.9), 1.0);
      }`,
    side: DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function Pad({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const plate = useRef<Group>(null);
  const outer = useRef<Group>(null);
  const segs = useRef<Group>(null);
  const built = useMemo(() => {
    const metal = new MeshPhysicalMaterial({ color: '#10141d', metalness: 0.85, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.28, envMapIntensity: 0.55 });
    const dark = new MeshStandardMaterial({ color: '#07090f', metalness: 0.6, roughness: 0.6 });
    const lathe = new LatheGeometry(plateProfile(), 128);
    // bolt circle + radial spokes on the plate
    const bolt = new CylinderGeometry(0.07, 0.07, 0.05, 10);
    const bolts = new InstancedMesh(bolt, metal, 96);
    const m = new Matrix4();
    for (let i = 0; i < 96; i++) {
      const r = i < 48 ? 9.25 : 4.8, a = ((i % 48) / 48) * Math.PI * 2;
      bolts.setMatrixAt(i, m.makeTranslation(Math.cos(a) * r, 0.235, Math.sin(a) * r));
    }
    const spoke = new BoxGeometry(0.12, 0.03, 2.3);
    const spokes = new InstancedMesh(spoke, dark, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      spokes.setMatrixAt(i, new Matrix4().makeRotationY(-a).premultiply(new Matrix4().makeTranslation(Math.cos(a) * 6.65, 0.225, Math.sin(a) * 6.65)));
    }
    const segMat = ringMaterial('segments');
    const tickMat = ringMaterial('ticks');
    const ringGeo = new RingGeometry(RING.r0, RING.r1, 192, 1);
    const tickGeo = new RingGeometry(OUTER.r0, OUTER.r1, 192, 1);
    // pylons: tapered 4-sided columns with an emissive lens facing the pad
    const pylonGeo = new CylinderGeometry(0.28, 0.5, 1.9, 4, 1);
    pylonGeo.rotateY(Math.PI / 4);
    const lensGeo = new CircleGeometry(0.16, 20);
    const lensMat = new MeshStandardMaterial({ color: '#000000', emissive: hdr('ice', 1), emissiveIntensity: 2.5, toneMapped: false });
    // pulse ring (floor) + scan plane
    const pulseMat = new ShaderMaterial({
      uniforms: { uCol: { value: hdr('ignition', 2.4) }, uP: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uP; varying vec2 vP;
        void main(){
          float r = length(vP);
          float front = 10.4 + uP * 8.0;
          float d = (r - front) * 2.2;
          float band = exp(-d * d) * (1.0 - uP);
          if (band < 0.004) discard;
          gl_FragColor = vec4(uCol * band, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const pulseGeo = new RingGeometry(10, 19, 128, 1);
    const scanMat = new ShaderMaterial({
      uniforms: { uCol: { value: hdr('ice', 1.2) }, uA: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; uniform float uA; varying vec2 vP;
        void main(){
          float r = length(vP) / 7.6;
          vec2 g = abs(fract(vP * 1.25) - 0.5);
          float grid = step(0.46, max(g.x, g.y));
          float rim = smoothstep(0.86, 1.0, r) * step(r, 1.0);
          float a = (0.012 + grid * 0.06 + rim * 0.45) * (1.0 - smoothstep(0.96, 1.0, r)) * uA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uCol * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const scanGeo = new CircleGeometry(7.6, 96);
    return { metal, dark, lathe, bolts, spokes, bolt, spoke, segMat, tickMat, ringGeo, tickGeo, pylonGeo, lensGeo, lensMat, pulseMat, pulseGeo, scanMat, scanGeo };
  }, []);

  useEffect(
    () => () => {
      const b = built;
      [b.metal, b.dark, b.segMat, b.tickMat, b.lensMat, b.pulseMat, b.scanMat].forEach(m => m.dispose());
      [b.lathe, b.bolt, b.spoke, b.ringGeo, b.tickGeo, b.pylonGeo, b.lensGeo, b.pulseGeo, b.scanGeo].forEach(g => g.dispose());
      b.bolts.dispose();
      b.spokes.dispose();
    },
    [built],
  );

  const scan = useRef<Group>(null);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (plate.current) plate.current.rotation.y = turntable.yaw;
    if (!reduceMotion) {
      // rings lie in their local XY plane (group rotated -90 deg on x): spin about local Z
      if (segs.current) segs.current.rotation.z += dt * 0.05;
      if (outer.current) outer.current.rotation.z -= dt * 0.03;
    }
    built.segMat.uniforms.uTime.value = t;
    built.segMat.uniforms.uPulse.value = padFx.pulse;
    built.pulseMat.uniforms.uP.value = padFx.pulse;
    built.scanMat.uniforms.uA.value = padFx.scanA;
    built.lensMat.emissiveIntensity = 2.5 + padFx.pylon * 6;
    if (scan.current) {
      scan.current.visible = padFx.scanA > 0.002;
      scan.current.position.y = 0.4 + padFx.scan * 5.2;
    }
  });

  return (
    <group name="pad">
      <group ref={plate}>
        <mesh geometry={built.lathe} material={built.metal} receiveShadow castShadow={false} />
        <primitive object={built.bolts} />
        <primitive object={built.spokes} />
      </group>
      <group ref={segs} rotation-x={-Math.PI / 2} position-y={RING.y}>
        <mesh geometry={built.ringGeo} material={built.segMat} />
      </group>
      <group ref={outer} rotation-x={-Math.PI / 2} position-y={OUTER.y}>
        <mesh geometry={built.tickGeo} material={built.tickMat} />
      </group>
      {[30, 150, 270].map(deg => { // none dead ahead of the hangar camera (+z)
        const a = (deg * Math.PI) / 180;
        return (
          <group key={deg} position={[Math.cos(a) * 12.1, 0, Math.sin(a) * 12.1]} rotation-y={-a - Math.PI / 2}>
            <mesh geometry={built.pylonGeo} material={built.dark} position-y={0.95} castShadow />
            <mesh geometry={built.lensGeo} material={built.lensMat} position={[0, 1.45, 0.32]} rotation-x={-0.35} />
          </group>
        );
      })}
      <mesh geometry={built.pulseGeo} material={built.pulseMat} rotation-x={-Math.PI / 2} position-y={0.03} renderOrder={5} />
      <group ref={scan} visible={false}>
        <mesh geometry={built.scanGeo} material={built.scanMat} rotation-x={-Math.PI / 2} renderOrder={12} />
      </group>
    </group>
  );
}
