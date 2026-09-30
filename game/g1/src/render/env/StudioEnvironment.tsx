// Product-shot studio reflections (art bible §3 lighting language): long strip
// Lightformers overhead and at the sides so hulls carry clean specular lines,
// a warm key card, Nebula + Ice rim cards, all rendered once into a PMREM
// cube. Not shown as background — the scene provides its own backdrop.
import { Environment, Lightformer } from '@react-three/drei';
import { HEX } from '../palette';

export function StudioEnvironment({ intensity = 0.65 }: { intensity?: number }) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={['#020309']} />
      {/* overhead strip softboxes: the long showroom lines */}
      {/* narrow strips = crisp specular lines, not a flood of reflection */}
      {[-8, -2.6, 2.6, 8].map((x, i) => (
        <Lightformer key={x} form="rect" intensity={i % 2 ? 1.8 : 2.4} color="#fff4ea" position={[x, 10, 0]} rotation-x={Math.PI / 2} scale={[0.55, 38, 1]} />
      ))}
      {/* side strips */}
      <Lightformer form="rect" intensity={2.4} color="#f3f5ff" position={[-18, 3, 0]} rotation-y={Math.PI / 2} scale={[36, 0.9, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#f3f5ff" position={[18, 5, 0]} rotation-y={-Math.PI / 2} scale={[36, 0.6, 1]} />
      {/* warm key card, top-front-left */}
      <Lightformer form="rect" intensity={4} color="#ffd9bf" position={[-10, 8, 14]} target={[0, 0, 0]} scale={[10, 6, 1]} />
      {/* rim cards behind: Nebula + Ice */}
      <Lightformer form="rect" intensity={3} color={HEX.nebula} position={[-12, 4, -16]} target={[0, 0, 0]} scale={[8, 12, 1]} />
      <Lightformer form="rect" intensity={2.4} color={HEX.ice} position={[13, 3, -15]} target={[0, 0, 0]} scale={[6, 10, 1]} />
      {/* Ignition floor bounce */}
      <Lightformer form="ring" intensity={0.6} color={HEX.ignition} position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={10} />
    </Environment>
  );
}
