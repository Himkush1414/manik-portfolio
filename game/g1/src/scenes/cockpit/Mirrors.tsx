// Three cockpit mirrors with REAL render targets (brief §15): a larger centre
// mirror above the dash (512x256) and two canopy-bow mirrors (256x160), each
// a rear-facing camera rendered at 30 fps only while in the cockpit. The
// cameras see the world + the own ship (MIRROR_LAYER); the mirror surfaces
// live on their own layer so no mirror ever samples a target it writes.
// Look: slight convex barrel + fresnel + vignette + faint scanlines, bezel.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, Group, HalfFloatType, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, ShaderMaterial, WebGLRenderTarget } from 'three';
import { MIRRORS } from './cockpitSpec';
import { MIRROR_LAYER, MIRROR_SURFACE_LAYER } from '../sceneBridge';
import { stage } from '../Stage';
import { cockpitFx } from './displays';

const LOOK_BACK: Record<string, [number, number, number]> = {
  centre: [0, 0.3, 0.02],
  left: [-0.55, 0.12, -0.45],
  right: [0.55, 0.12, -0.45],
};

export function Mirrors({ parent }: { parent: Group | null }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const m = useMemo(() => {
    const bezelMat = new MeshStandardMaterial({ color: '#1c2029', roughness: 0.5, metalness: 0.7 });
    return MIRRORS.map(def => {
      const rt = new WebGLRenderTarget(def.rt[0], def.rt[1], { type: HalfFloatType, samples: 2 });
      const cam = new PerspectiveCamera(def.id === 'centre' ? 34 : 40, def.w / def.h, 0.1, 900);
      cam.layers.set(0);
      cam.layers.enable(MIRROR_LAYER);
      const [x, y, z] = LOOK_BACK[def.id];
      cam.position.set(x, y, z);
      // rear-facing: look along +z (behind the pilot), outward for the side mirrors
      cam.lookAt(x + (def.id === 'left' ? -0.35 : def.id === 'right' ? 0.35 : 0), y - 0.08, z + 1);
      const mat = new ShaderMaterial({
        uniforms: { tMap: { value: rt.texture }, uTime: { value: 0 }, uPower: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tMap; uniform float uTime, uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            vec2 p = vUv * 2.0 - 1.0;
            float r2 = dot(p, p);
            vec2 uv = vec2(1.0 - vUv.x, vUv.y);                  // mirrored
            uv = (uv - 0.5) * (1.0 - 0.09 * r2) + 0.5;            // slight convex barrel
            vec3 c = texture2D(tMap, uv).rgb;
            float vig = smoothstep(1.35, 0.35, length(p * vec2(0.8, 1.0)));
            float scan = 0.96 + 0.04 * sin(vUv.y * 420.0);
            float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0);
            c = c * vig * scan + vec3(0.6, 0.7, 0.85) * fres * 0.25;
            gl_FragColor = vec4(c * uPower, 1.0);
          }`,
      });
      const surface = new Mesh(new PlaneGeometry(def.w, def.h), mat);
      surface.layers.set(MIRROR_SURFACE_LAYER);
      const bezel = new Mesh(new BoxGeometry(def.w + 0.018, def.h + 0.018, 0.012), bezelMat);
      bezel.position.z = -0.008;
      const holder = new Group();
      holder.position.set(def.pos[0], def.pos[1], def.pos[2]);
      holder.lookAt(0, 0, 0);
      holder.add(surface, bezel);
      return { def, rt, cam, mat, surface, bezel, holder };
    });
  }, []);

  useEffect(() => {
    if (!parent) return;
    m.forEach(x => parent.add(x.holder, x.cam));
    return () => {
      m.forEach(x => {
        parent.remove(x.holder, x.cam);
        x.rt.dispose();
        x.mat.dispose();
        x.surface.geometry.dispose();
        x.bezel.geometry.dispose();
      });
      (m[0].bezel.material as MeshStandardMaterial).dispose();
    };
  }, [parent, m]);

  const frame = useRef(0);
  useFrame(state => {
    if (stage.cockpit < 0.5 || !parent) return;
    const t = state.clock.elapsedTime;
    const power = Math.min(1, cockpitFx.power.dash * 1.2);
    m.forEach(x => {
      x.mat.uniforms.uTime.value = t;
      x.mat.uniforms.uPower.value = power;
    });
    if (frame.current++ % 2) return; // 30 fps
    const prevTarget = gl.getRenderTarget();
    const prevShadow = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    for (const x of m) {
      x.cam.updateMatrixWorld();
      gl.setRenderTarget(x.rt);
      gl.clear();
      gl.render(scene, x.cam);
    }
    gl.setRenderTarget(prevTarget);
    gl.shadowMap.autoUpdate = prevShadow;
  }, 0.5);

  return null;
}
