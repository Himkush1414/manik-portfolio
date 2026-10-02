// Three cockpit mirrors with REAL render targets (brief §15): a larger centre
// mirror above the dash (512x256) and two canopy-bow mirrors (256x160), fed
// by a MirrorRig (render/MirrorRig.ts: rear-facing cameras, 30 fps, pluggable
// source) only while in the cockpit. The cameras see the world + the own ship
// (MIRROR_LAYER); the mirror surfaces live on their own layer so no mirror
// ever samples a target it writes. Look: slight convex barrel + fresnel +
// vignette + faint scanlines, in a bezel.
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import { MIRRORS } from './cockpitSpec';
import { MIRROR_LAYER, MIRROR_SURFACE_LAYER, MIRROR_WORLD_LAYER, cockpitInMission } from '../sceneBridge';
import { stage } from '../Stage';
import { cockpitFx } from './displays';
import { MirrorRig } from '../../render/MirrorRig';
import { registerDebug } from '../../debug/debugApi';

/** Rear-facing camera per mirror (cockpit-local): position + look target. */
const CAMS: Record<string, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  centre: { pos: [0, 0.3, 0.02], look: [0, 0.22, 1.02], fov: 34 },
  left: { pos: [-0.55, 0.12, -0.45], look: [-0.9, 0.04, 0.55], fov: 40 },
  right: { pos: [0.55, 0.12, -0.45], look: [0.9, 0.04, 0.55], fov: 40 },
};

const _full = new Vector4(0, 0, 1, 1);

/** Quality-preset mirror budget: the centre target's size + refresh rate;
 *  the side mirrors keep their 256x160 : 512x256 proportion. */
export type MirrorQuality = { w: number; h: number; fps: number };

export function Mirrors({ parent, quality }: { parent: Group | null; quality: MirrorQuality }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const m = useMemo(() => {
    const rig = new MirrorRig(
      MIRRORS.map(def => ({ size: def.rt, fov: CAMS[def.id].fov, aspect: def.w / def.h, pos: CAMS[def.id].pos, look: CAMS[def.id].look, layers: [MIRROR_LAYER] })),
    );
    const bezelMat = new MeshStandardMaterial({ color: '#1c2029', roughness: 0.5, metalness: 0.7 });
    const bezelGeos: BoxGeometry[] = [];
    const surfaces = MIRRORS.map((def, i) => {
      const mat = new ShaderMaterial({
        // uWin: the UV window of tMap this mirror shows (the whole texture, or its part of the shared render)
        uniforms: { tMap: { value: rig.textures[i] }, uWin: { value: new Vector4(0, 0, 1, 1) }, uTime: { value: 0 }, uPower: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tMap; uniform vec4 uWin; uniform float uTime, uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            vec2 p = vUv * 2.0 - 1.0;
            float r2 = dot(p, p);
            vec2 uv = vec2(1.0 - vUv.x, vUv.y);                  // mirrored
            uv = (uv - 0.5) * (1.0 - 0.09 * r2) + 0.5;            // slight convex barrel
            vec3 c = texture2D(tMap, uWin.xy + uv * uWin.zw).rgb;
            float vig = smoothstep(1.35, 0.35, length(p * vec2(0.8, 1.0)));
            float scan = 0.96 + 0.04 * sin(vUv.y * 420.0);
            float fres = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 3.0);
            c = c * vig * scan + vec3(0.6, 0.7, 0.85) * fres * 0.25;
            gl_FragColor = vec4(c * uPower, 1.0);
          }`,
      });
      const surface = new Mesh(new PlaneGeometry(def.w, def.h), mat);
      surface.layers.set(MIRROR_SURFACE_LAYER);
      const bg = new BoxGeometry(def.w + 0.018, def.h + 0.018, 0.012);
      bezelGeos.push(bg);
      const bezel = new Mesh(bg, bezelMat);
      bezel.position.z = -0.008;
      const holder = new Group();
      holder.position.set(def.pos[0], def.pos[1], def.pos[2]);
      holder.lookAt(0, 0, 0);
      holder.add(surface, bezel);
      return { mat, surface, holder };
    });
    return { rig, surfaces, bezelMat, bezelGeos, inMission: false };
  }, []);

  // attach / detach only: re-parenting must never dispose (the materials are
  // reused — disposing them here deleted live programs mid-compile)
  useEffect(() => {
    if (!parent) return;
    m.rig.attach(parent);
    m.rig.setSource(scene);
    gl.initRenderTarget(m.rig.sharedTarget); // allocated now, never on the first mission frame
    m.surfaces.forEach(s => parent.add(s.holder));
    registerDebug('mirrors', { rig: () => m.rig });
    return () => {
      m.surfaces.forEach(s => parent.remove(s.holder));
      m.rig.detach();
      m.rig.setSource(null);
    };
  }, [parent, scene, m, gl]);

  // GPU resources: released once, on unmount
  useEffect(
    () => () => {
      m.surfaces.forEach(s => {
        s.mat.dispose();
        s.surface.geometry.dispose();
      });
      m.bezelGeos.forEach(g => g.dispose());
      m.bezelMat.dispose();
      m.rig.dispose();
    },
    [m],
  );

  useEffect(() => {
    m.rig.fps = quality.fps;
    m.rig.resize(
      MIRRORS.map(def => {
        const k = quality.w / MIRRORS[0].rt[0];
        return [Math.round(def.rt[0] * k), Math.round(def.rt[1] * (quality.h / MIRRORS[0].rt[1]))] as const;
      }),
    );
  }, [m, quality]);

  useFrame((state, dt) => {
    if ((stage.cockpit < 0.5 && !cockpitInMission.on) || !parent) return; // skipped entirely outside the cockpit
    // in a mission the mirrors see the reduced set: own ship + the cheapest tunnel (MIRROR_WORLD_LAYER)
    if (m.inMission !== cockpitInMission.on) {
      m.inMission = cockpitInMission.on;
      m.rig.setLayers(m.inMission ? [MIRROR_LAYER, MIRROR_WORLD_LAYER] : [0, MIRROR_LAYER]);
      // and ONE shared wide render sampled through each mirror's window (the per-pass cost dominated
      // on the integrated GPU); the Phase 1 bay keeps its three cameras
      m.rig.setShared(m.inMission);
      m.surfaces.forEach((s, i) => {
        s.mat.uniforms.tMap.value = m.inMission ? m.rig.sharedTarget.texture : m.rig.textures[i];
        (s.mat.uniforms.uWin.value as Vector4).copy(m.inMission ? m.rig.windows[i] : _full);
      });
    }
    const power = Math.min(1, cockpitFx.power.dash * 1.2);
    m.surfaces.forEach(s => {
      s.mat.uniforms.uTime.value = state.clock.elapsedTime;
      s.mat.uniforms.uPower.value = power;
    });
    m.rig.render(gl, dt);
  }, 0.5);

  return null;
}
