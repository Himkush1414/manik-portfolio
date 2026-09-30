// Direct lights for the studio rig: ONE shadow-casting key (warm, slightly
// Ignition-tinted, top-front-left), two unshadowed rims (Nebula, Ice) and a
// low fill. Tight shadow frustum around the pad; bias tuned against acne.
import { useLayoutEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { HEX } from '../palette';

type Props = { shadowMapSize?: number; keyIntensity?: number };

export function StudioLights({ shadowMapSize = 2048, keyIntensity = 3.2 }: Props) {
  const key = useRef<DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    const cam = l.shadow.camera;
    cam.left = -13;
    cam.right = 13;
    cam.top = 13;
    cam.bottom = -13;
    cam.near = 4;
    cam.far = 60;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.00025;
    l.shadow.normalBias = 0.035;
    l.shadow.radius = 5;
    l.shadow.blurSamples = 16;
  }, []);
  return (
    <>
      <directionalLight
        ref={key}
        castShadow
        position={[-14, 22, 16]}
        intensity={keyIntensity}
        color="#ffe8d9"
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
      />
      <directionalLight position={[-10, 6, -18]} intensity={1.3} color={HEX.nebula} />
      <directionalLight position={[12, 5, -16]} intensity={1.1} color={HEX.ice} />
      <hemisphereLight args={['#1a2040', '#04050A', 0.12]} />
    </>
  );
}
