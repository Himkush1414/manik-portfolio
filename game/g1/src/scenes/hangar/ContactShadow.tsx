// Soft contact shadow under the display ship (brief §11: "ContactShadows for
// soft grounding"). drei's ContactShadows re-renders the WHOLE scene; this one
// renders only the ship (SHIP_LAYER) from below with an override material
// whose darkness falls off with height, blurs it (separable, 2 passes) and
// lays it on the pad. Every other frame; skipped for holograms / mid-dissolve
// via padFx.shadow.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { stage } from '../Stage';
import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderTarget, type Fog, type FogExp2, type Material, type Texture } from 'three';
import { SHIP_LAYER } from '../../ships/ShipFactory';
import { padFx } from './padFx';

const SIZE = 22; // world units covered (pad diameter)
const FAR = 6; // capture height
const RES = 256;

export function ContactShadow({ y = 0.27, opacity = 0.85 }: { y?: number; opacity?: number }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const frame = useRef(0);
  const r = useMemo(() => {
    const a = new WebGLRenderTarget(RES, RES);
    const b = new WebGLRenderTarget(RES, RES);
    const cam = new OrthographicCamera(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, 0, FAR);
    // below the pad, looking up: the LOWEST surface wins the depth test and is darkest
    cam.position.set(0, 0.01, 0);
    cam.up.set(0, 0, 1);
    cam.lookAt(0, 1, 0);
    cam.layers.set(SHIP_LAYER);
    cam.updateMatrixWorld();
    const capture = new ShaderMaterial({
      uniforms: { uFar: { value: FAR } },
      vertexShader: /* glsl */ `
        varying float vY;
        void main() {
          vec4 p = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            p = instanceMatrix * p;
          #endif
          vec4 w = modelMatrix * p;
          vY = w.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFar; varying float vY;
        void main() { float a = 1.0 - clamp(vY / uFar, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a); }`,
      side: 2,
    });
    const blur = new ShaderMaterial({
      uniforms: { tSrc: { value: null as Texture | null }, uDir: { value: new Vector2() } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main(){
          float w[5]; w[0] = 0.2270; w[1] = 0.1946; w[2] = 0.1216; w[3] = 0.0541; w[4] = 0.0162;
          float a = texture2D(tSrc, vUv).a * w[0];
          for (int i = 1; i < 5; i++) {
            a += texture2D(tSrc, vUv + uDir * float(i)).a * w[i];
            a += texture2D(tSrc, vUv - uDir * float(i)).a * w[i];
          }
          gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new Scene();
    quad.add(new Mesh(new PlaneGeometry(2, 2), blur));
    const show = new ShaderMaterial({
      uniforms: { tShadow: { value: b.texture }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tShadow; uniform float uOpacity; varying vec2 vUv;
        void main(){ float a = texture2D(tShadow, vUv).a * uOpacity; if (a < 0.004) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    return { a, b, cam, capture, blur, quad, show, geo: new PlaneGeometry(SIZE, SIZE), quadCam: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);

  useEffect(
    () => () => {
      [r.a, r.b].forEach(t => t.dispose());
      [r.capture, r.blur, r.show].forEach(m => m.dispose());
      r.geo.dispose();
      (r.quad.children[0] as Mesh).geometry.dispose();
    },
    [r],
  );

  const clear = useMemo(() => new Color(), []);
  useFrame(() => {
    // the hall is hidden in the cockpit and in missions: no capture of the whole scene there
    if (stage.cockpit >= 0.5 || stage.mission >= 0.5) return;
    const strength = padFx.shadow;
    r.show.uniforms.uOpacity.value = strength * opacity;
    if (strength < 0.01 || frame.current++ % 2) return;
    const prev = {
      target: gl.getRenderTarget(),
      bg: scene.background,
      fog: scene.fog as Fog | FogExp2 | null,
      ovr: scene.overrideMaterial as Material | null,
      alpha: gl.getClearAlpha(),
      shadowAuto: gl.shadowMap.autoUpdate,
    };
    gl.getClearColor(clear);
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = r.capture;
    gl.shadowMap.autoUpdate = false;
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(r.a);
    gl.clear();
    gl.render(scene, r.cam);
    scene.overrideMaterial = prev.ovr;
    scene.background = prev.bg;
    scene.fog = prev.fog;
    gl.shadowMap.autoUpdate = prev.shadowAuto;
    // separable blur a -> b (h), b -> a (v), a -> b (h, wider)
    const pass = (src: WebGLRenderTarget, dst: WebGLRenderTarget, x: number, y2: number) => {
      r.blur.uniforms.tSrc.value = src.texture;
      r.blur.uniforms.uDir.value.set(x / RES, y2 / RES);
      gl.setRenderTarget(dst);
      gl.render(r.quad, r.quadCam);
    };
    pass(r.a, r.b, 1.4, 0);
    pass(r.b, r.a, 0, 1.4);
    pass(r.a, r.b, 2.6, 0);
    pass(r.b, r.a, 0, 2.6);
    pass(r.a, r.b, 0.7, 0.7);
    gl.setRenderTarget(prev.target);
    gl.setClearColor(clear, prev.alpha);
  });

  return <mesh geometry={r.geo} material={r.show} rotation-x={-Math.PI / 2} position-y={y} renderOrder={4} />;
}
