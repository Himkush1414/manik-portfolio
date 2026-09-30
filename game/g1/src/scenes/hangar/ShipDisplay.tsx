// The selected ship on the display pad: ShipFactory instance + hover (bob
// +-0.08 u @ 0.22 Hz, +-0.6 deg roll drift, brief §10) + engine idle/flare.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { ShipFactory } from '../../ships/ShipFactory';
import { useProfile } from '../../state/profile.store';
import { useUi } from '../../state/ui.store';
import type { ShipId } from '../../data/ships';
import { SPECS } from '../../ships/specs';
import { registerDebug } from '../../debug/debugApi';

export function ShipDisplay({ shipId }: { shipId: ShipId }) {
  const livery = useProfile(s => s.liveryByShip[shipId] ?? 0);
  const ctaHover = useUi(s => s.ctaHover);
  const root = useRef<Group>(null);
  const ship = useMemo(() => {
    performance.mark('ship:build:start');
    const b = ShipFactory.build(shipId, { livery, lod: 0 });
    performance.mark('ship:build:end');
    return b;
  }, [shipId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => ship.dispose(), [ship]);
  useEffect(() => {
    ship.setLivery(livery, true);
  }, [ship, livery]);
  useEffect(() => {
    registerDebug('ship', {
      tris: () => ship.tris,
      dissolve: (v: number) => ship.setDissolve(v),
      engine: (l: number) => ship.setEngineLevel(l),
    });
  }, [ship]);

  const hover = SPECS[shipId].hoverHeight;
  useFrame(state => {
    const t = state.clock.elapsedTime;
    const g = root.current;
    if (g) {
      g.position.y = hover + Math.sin(t * Math.PI * 2 * 0.22) * 0.08;
      g.rotation.z = Math.sin(t * 0.37) * 0.0105;
      g.rotation.x = Math.sin(t * 0.29 + 1.3) * 0.004;
    }
    ship.setEngineLevel(ctaHover ? 1 : 0.25);
    ship.update(t);
  });

  return (
    <group ref={root}>
      <primitive object={ship.group} />
    </group>
  );
}
