// The selected ship on the display pad: ShipFactory instance + hover (bob
// +-0.08 u @ 0.22 Hz, +-0.6 deg roll drift, brief §10) + engine idle/flare.
// Ship swap = dissolve the current ship out (0.5 s), then the next one in
// (0.7 s) with the pad ring pulse + scan-plane sweep; instant under reduced motion. Locked ships project as a hologram.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import gsap from 'gsap';
import { ShipFactory } from '../../ships/ShipFactory';
import { useProfile } from '../../state/profile.store';
import { useSettings } from '../../state/settings.store';
import { useUi } from '../../state/ui.store';
import type { ShipId } from '../../data/ships';
import { unlockState } from '../../data/unlocks';
import { SPECS } from '../../ships/specs';
import { registerDebug } from '../../debug/debugApi';
import { padFx, padMaterialise } from './padFx';
import { sfx } from '../../audio/sfx';

// brief §10: ~0.5 s out, ~0.7 s in, with the pad pulse + scan plane
const OUT = 0.5;
const IN = 0.7;

export function ShipDisplay({ shipId, forceUnlocked = false }: { shipId: ShipId; forceUnlocked?: boolean }) {
  const [shown, setShown] = useState(shipId);
  const livery = useProfile(s => s.liveryByShip[shown] ?? 0);
  const locked = useProfile(s => !forceUnlocked && !unlockState(shown, s).unlocked);
  const reduceMotion = useSettings(s => s.accessibility.reduceMotion);
  const ctaHover = useUi(s => s.ctaHover);
  const root = useRef<Group>(null);
  const dis = useRef({ v: 0 }); // current dissolve of the shown ship (tweened)
  const ship = useMemo(() => {
    performance.mark('ship:build:start');
    const b = ShipFactory.build(shown, { livery, lod: 0, hologram: locked });
    performance.mark('ship:build:end');
    return b;
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => ship.dispose(), [ship]);
  useEffect(() => {
    ship.setLivery(livery, true);
  }, [ship, livery]);
  // locked -> unlocked on the same ship (a purchase): the hologram solidifies
  // with a dissolve-in, the pad shockwave and the materialise sweep
  const wasLocked = useRef({ ship, locked });
  useEffect(() => {
    const unlockedNow = wasLocked.current.ship === ship && wasLocked.current.locked && !locked;
    wasLocked.current = { ship, locked };
    ship.setHologram(locked);
    if (!unlockedNow || reduceMotion) return;
    const d = dis.current;
    d.v = 1;
    ship.setDissolve(1);
    padMaterialise(IN, false);
    sfx.play('materialise');
    const tw = gsap.to(d, { v: 0, duration: IN, ease: 'power2.out', onUpdate: () => ship.setDissolve(d.v) });
    return () => {
      tw.kill();
    };
  }, [ship, locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // dissolve in: only ships arriving through a swap (flag survives StrictMode
  // effect replays; cleared when the tween lands)
  const swapIn = useRef(false);
  useEffect(() => {
    if (!swapIn.current) return;
    const d = dis.current;
    d.v = 1;
    ship.setDissolve(1);
    padMaterialise(IN, reduceMotion);
    sfx.play('materialise');
    const tw = gsap.to(d, {
      v: 0,
      duration: IN,
      ease: 'power2.out',
      onUpdate: () => ship.setDissolve(d.v),
      onComplete: () => {
        swapIn.current = false;
      },
    });
    return () => {
      tw.kill();
    };
  }, [ship]); // eslint-disable-line react-hooks/exhaustive-deps

  // dissolve out, then swap
  useEffect(() => {
    if (shipId === shown) return;
    if (reduceMotion) {
      dis.current.v = 0;
      setShown(shipId);
      return;
    }
    // continue from wherever the current dissolve is (fast re-selection)
    const d = dis.current;
    gsap.killTweensOf(d); // an in-flight dissolve-in hands over mid-way
    const tw = gsap.to(d, {
      v: 1,
      duration: OUT * (1 - d.v),
      ease: 'power2.in',
      onUpdate: () => ship.setDissolve(d.v),
      onComplete: () => {
        swapIn.current = true;
        setShown(shipId);
      },
    });
    return () => {
      tw.kill();
    };
  }, [shipId, shown, ship, reduceMotion]);

  useEffect(() => {
    registerDebug('ship', {
      id: () => shown,
      tris: () => ship.tris,
      dissolve: (v: number) => ship.setDissolve(v),
      engine: (l: number) => ship.setEngineLevel(l),
      hologram: (on: boolean) => ship.setHologram(on),
      isHologram: () => ship.hologram,
      select: (id: ShipId) => useProfile.getState().selectShip(id),
    });
  }, [ship, shown]);

  const hover = SPECS[shown].hoverHeight;
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
    padFx.shadow = ship.hologram ? 0 : 1 - dis.current.v;
  });

  return (
    <group ref={root}>
      <primitive object={ship.group} />
    </group>
  );
}
