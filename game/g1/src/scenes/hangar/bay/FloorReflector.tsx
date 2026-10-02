// Planar reflector for the hangar deck — drei's MeshReflectorMaterial
// wrapper (MIT, @react-three/drei 9.122, core/MeshReflectorMaterial.js)
// adapted with two changes it lacks: an `active` gate (drei re-renders the
// WHOLE scene + 5 blur passes every frame it is mounted, even while the hall
// is hidden — measured 1.8 ms/frame on the UHD 770 during a mission) and
// disposal of its render targets on unmount (drei never frees them). Uses
// drei's material + BlurPass classes unchanged; same defines = same program.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DepthFormat, DepthTexture, HalfFloatType, LinearFilter, Matrix4, PerspectiveCamera, Plane, UnsignedShortType, Vector3, Vector4, WebGLRenderTarget, type Mesh, type Texture, type Vector2 } from 'three';
import { BlurPass } from '@react-three/drei/materials/BlurPass.js';
import { MeshReflectorMaterial } from '@react-three/drei/materials/MeshReflectorMaterial.js';

export type FloorReflectorProps = {
  map: Texture;
  roughnessMap: Texture;
  normalMap: Texture;
  normalScale: Vector2;
  resolution: number;
  blur: readonly [number, number];
  /** false = skip the reflection render this frame (the hall is hidden) */
  active: () => boolean;
};

/** Reflection params of the deck (were the drei props in Floor.tsx). */
const LOOK = { metalness: 0.4, roughness: 1, envMapIntensity: 0.3, mixBlur: 1, mixStrength: 0.9, mixContrast: 1, mirror: 0.45, depthScale: 1.1, minDepthThreshold: 0.35, maxDepthThreshold: 1.3, depthToBlurRatioBias: 0.25, distortion: 1 } as const;

export function FloorReflector({ map, roughnessMap, normalMap, normalScale, resolution, blur, active }: FloorReflectorProps) {
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);
  const scene = useThree(s => s.scene);
  const parentRef = useRef<Mesh | null>(null);
  const r = useMemo(() => {
    const params = { minFilter: LinearFilter, magFilter: LinearFilter, type: HalfFloatType };
    const fbo1 = new WebGLRenderTarget(resolution, resolution, params);
    fbo1.depthBuffer = true;
    fbo1.depthTexture = new DepthTexture(resolution, resolution);
    fbo1.depthTexture.format = DepthFormat;
    fbo1.depthTexture.type = UnsignedShortType;
    const fbo2 = new WebGLRenderTarget(resolution, resolution, params);
    const blurpass = new BlurPass({ gl, resolution, width: blur[0], height: blur[1], minDepthThreshold: LOOK.minDepthThreshold, maxDepthThreshold: LOOK.maxDepthThreshold, depthScale: LOOK.depthScale, depthToBlurRatioBias: LOOK.depthToBlurRatioBias });
    const textureMatrix = new Matrix4();
    const mat = new MeshReflectorMaterial();
    Object.assign(mat, { map, roughnessMap, normalMap, normalScale, metalness: LOOK.metalness, roughness: LOOK.roughness, envMapIntensity: LOOK.envMapIntensity });
    Object.assign(mat, { mirror: LOOK.mirror, textureMatrix, mixBlur: LOOK.mixBlur, tDiffuse: fbo1.texture, tDepth: fbo1.depthTexture, tDiffuseBlur: fbo2.texture, hasBlur: blur[0] + blur[1] > 0, mixStrength: LOOK.mixStrength, minDepthThreshold: LOOK.minDepthThreshold, maxDepthThreshold: LOOK.maxDepthThreshold, depthScale: LOOK.depthScale, depthToBlurRatioBias: LOOK.depthToBlurRatioBias, distortion: LOOK.distortion, mixContrast: LOOK.mixContrast });
    mat.defines = { ...(mat.defines ?? {}), USE_BLUR: '', USE_DEPTH: '' };
    return {
      fbo1, fbo2, blurpass, textureMatrix, mat,
      cam: new PerspectiveCamera(), plane: new Plane(), normal: new Vector3(), reflPos: new Vector3(), camPos: new Vector3(), rot: new Matrix4(), look: new Vector3(), clip: new Vector4(), view: new Vector3(), target: new Vector3(), q: new Vector4(),
    };
    // textures / normalScale are stable for the deck's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, resolution, blur]);
  useEffect(
    () => () => {
      r.fbo1.depthTexture?.dispose();
      r.fbo1.dispose();
      r.fbo2.dispose();
      const bp = r.blurpass as unknown as { renderTargetA: WebGLRenderTarget; renderTargetB: WebGLRenderTarget; convolutionMaterial: { dispose(): void }; screen: Mesh };
      bp.renderTargetA.dispose();
      bp.renderTargetB.dispose();
      bp.convolutionMaterial.dispose();
      bp.screen.geometry.dispose();
      r.mat.dispose();
    },
    [r],
  );

  /** drei's beforeRender: mirrored virtual camera + oblique near plane on the deck plane */
  const place = (parent: Mesh): boolean => {
    const { cam, plane, normal, reflPos, camPos, rot, look, clip, view, target, q, textureMatrix } = r;
    reflPos.setFromMatrixPosition(parent.matrixWorld);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    rot.extractRotation(parent.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rot);
    view.subVectors(reflPos, camPos);
    if (view.dot(normal) > 0) return false; // facing away
    view.reflect(normal).negate().add(reflPos);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(reflPos, look).reflect(normal).negate().add(reflPos);
    cam.position.copy(view);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    cam.lookAt(target);
    cam.far = (camera as PerspectiveCamera).far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    textureMatrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(parent.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, reflPos).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = cam.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + e[8]) / e[0];
    q.y = (Math.sign(clip.y) + e[9]) / e[5];
    q.z = -1;
    q.w = (1 + e[10]) / e[14];
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1;
    e[14] = clip.w;
    return true;
  };

  useFrame(() => {
    const parent = (r.mat as unknown as { __r3f?: { parent?: Mesh } }).__r3f?.parent ?? parentRef.current;
    if (!parent || !active()) return;
    parent.visible = false;
    const xr = gl.xr.enabled, shadowAuto = gl.shadowMap.autoUpdate;
    place(parent);
    gl.xr.enabled = false;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(r.fbo1);
    gl.state.buffers.depth.setMask(true);
    if (!gl.autoClear) gl.clear();
    gl.render(scene, r.cam);
    r.blurpass.render(gl, r.fbo1, r.fbo2);
    gl.xr.enabled = xr;
    gl.shadowMap.autoUpdate = shadowAuto;
    parent.visible = true;
    gl.setRenderTarget(null);
  });

  return <primitive object={r.mat} attach="material" ref={(m: unknown) => void (parentRef.current = ((m as { __r3f?: { parent?: Mesh } } | null)?.__r3f?.parent ?? null))} />;
}
