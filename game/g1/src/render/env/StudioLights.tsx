// Direct lights for the studio rig: ONE shadow-casting key (warm, slightly
// Ignition-tinted, top-front-left), two unshadowed rim spots (Nebula, Ice) and a
// low fill. The key is a SPOT cone aimed at the pad (not a directional light)
// so it never lights the bay doors' outer face. Bias tuned against acne.
import { useLayoutEffect, useRef } from 'react';
import { Object3D, type SpotLight } from 'three';
import { HEX } from '../palette';

type Props = { shadowMapSize?: number; keyIntensity?: number };

export function StudioLights({ shadowMapSize = 2048, keyIntensity = 4.2 }: Props) {
  const key = useRef<SpotLight>(null);
  const target = useRef(new Object3D());
  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    target.current.position.set(0, 1, 0);
    l.target = target.current;
    l.shadow.camera.near = 8;
    l.shadow.camera.far = 70;
    l.shadow.bias = -0.00025;
    l.shadow.normalBias = 0.035;
    l.shadow.radius = 5;
    l.shadow.blurSamples = 16;
  }, []);
  return (
    <>
      <spotLight
        ref={key}
        castShadow
        position={[-14, 22, 16]}
        angle={0.42}
        penumbra={0.75}
        distance={0}
        decay={0}
        intensity={keyIntensity}
        color="#ffe8d9"
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
      />
      <primitive object={target.current} />
      {/* rims are narrow, STEEP spots on the pad (not directional): a
          directional rim grazed the whole deck + walls and tinted the bay
          lilac; steep cones spend what passes the ship on the dark pad */}
      <spotLight position={[-9, 21, -19]} target={target.current} angle={0.27} penumbra={0.85} distance={0} decay={0} intensity={1.5} color={HEX.nebula} />
      <spotLight position={[10, 19, -18]} target={target.current} angle={0.27} penumbra={0.85} distance={0} decay={0} intensity={1.3} color={HEX.ice} />
      <hemisphereLight args={['#1a2040', '#04050A', 0.12]} />
    </>
  );
}
