// Launch bulkhead (brief §15): the SAME BlastDoors (shared geometry +
// materials: no new programs), without DoorFX lights, attached to the
// director's pose (pre-shake, so camera shake reads against it) at a small
// distance and scaled so the closed panels just cover the view. Close: red
// LEDs, seam steam, big shake. The world swaps behind it while sealed.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Matrix4, NormalBlending, Points, Quaternion, ShaderMaterial, Vector3, type Group } from 'three';
import { BlastDoors } from '../shared/BlastDoors';
import { DOOR } from '../shared/doors/doorSpec';
import { director } from '../../render/cameraDirector';
import { launchDoors } from '../sceneBridge';
import { createRng } from '../../core/rng';
import { bus } from '../../core/bus';
import { hdr } from '../../render/palette';

/** Choreography handle: `active` shows + attaches the bulkhead. */
export const bulkhead = { active: false, dist: 0.32 };

const up = new Vector3(0, 1, 0);
const m = new Matrix4(), q = new Quaternion(), pos = new Vector3(), fwd = new Vector3(), look = new Vector3();

function useSteam() {
  return useMemo(() => {
    const rng = createRng(515);
    const n = 90;
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = rng.next();
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
    const mat = new ShaderMaterial({
      uniforms: { uAge: { value: 99 }, uCol: { value: hdr('steel', 0.9) }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed; uniform float uAge, uScale; varying float vA;
        void main() {
          float t = uAge * (0.6 + aSeed.w * 0.7);
          // puffs along the seam (x = 0, y 0..12 door units), blowing out toward the viewer
          // hug the panel faces (z just in front): steam vents along the seam, not a wall in the camera's face
          vec3 p = vec3((aSeed.x - 0.5) * 0.6 + sign(aSeed.x - 0.5) * t * (1.5 + aSeed.y * 2.0), aSeed.z * 12.0 + t * 0.8, 0.7 + t * 0.4);
          vA = clamp(1.0 - t / 1.5, 0.0, 1.0) * smoothstep(0.0, 0.08, t);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          // world-size puffs (0.5 -> 2 door units), projected: stay small at bulkhead scale
          gl_PointSize = (0.5 + t * 1.5) * length(modelViewMatrix[0].xyz) * projectionMatrix[1][1] * 540.0 * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol; varying float vA;
        void main() { vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c, c) * 9.0) * vA * 0.14; if (a < 0.004) discard; gl_FragColor = vec4(uCol, a); }`,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    const p = new Points(g, mat);
    p.frustumCulled = false;
    return { p, g, mat };
  }, []);
}

export function Bulkhead({ reduceMotion }: { reduceMotion: boolean }) {
  const rig = useRef<Group>(null);
  const size = useThree(s => s.size);
  const steam = useSteam();
  const age = useRef(99);
  useEffect(() => bus.on('doors:slam', ({ id }) => void (id === 'launch' && launchDoors.progress < 0.5 && (age.current = 0))), []);
  useEffect(
    () => () => {
      steam.g.dispose();
      steam.mat.dispose();
    },
    [steam],
  );
  useFrame((_, dt) => {
    const g = rig.current;
    if (!g) return;
    g.visible = bulkhead.active;
    if (!bulkhead.active) return;
    // pose from the director (pre-shake), doors centred on the view axis
    const d = bulkhead.dist;
    const fov = (director.fov * Math.PI) / 180;
    const V = 2 * d * Math.tan(fov / 2), W = V * (size.width / Math.max(1, size.height));
    // the view must sit INSIDE the panels' travel: closed they cover it, open
    // their toothed edges (travel - tooth depth = 7.96) clear it
    const HALF_W = DOOR.travel - DOOR.toothDepth - 0.36, HALF_H = DOOR.H / 2 - 0.2;
    const s = Math.max(W / (2 * HALF_W), V / (2 * HALF_H));
    fwd.subVectors(director.look, director.pos).normalize();
    // Matrix4.lookAt(eye, target): +z = eye - target. Target ahead => +z points
    // back at the viewer, the side the door panels face.
    look.copy(director.pos).add(fwd);
    m.lookAt(director.pos, look, up);
    q.setFromRotationMatrix(m);
    pos.copy(director.pos).addScaledVector(fwd, d);
    director.focus.copy(director.pos).addScaledVector(fwd, d + 0.04); // DOF on the doors
    g.position.copy(pos);
    g.quaternion.copy(q);
    g.scale.setScalar(s);
    // door local origin is the floor-centre of the seam: lift so y=6 sits on axis
    g.children[0].position.set(0, -DOOR.H / 2, 0);
    age.current += dt;
    steam.mat.uniforms.uAge.value = reduceMotion ? 99 : age.current;
    steam.mat.uniforms.uScale.value = size.height / 1080;
  });
  return (
    <group ref={rig} visible={false}>
      <group>
        <BlastDoors controller={launchDoors} fx={false} reduceMotion={reduceMotion} />
        <primitive object={steam.p} />
      </group>
    </group>
  );
}
