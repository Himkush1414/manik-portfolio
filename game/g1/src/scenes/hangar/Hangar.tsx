// The hangar (brief §11): bay, deck, space vista, pad + turntable ship, and
// the hangar camera. Input binds to the canvas element only.
import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { Bay } from './bay/Bay';
import { BayLife } from './bay/BayLife';
import { ParkedFighters } from './bay/ParkedFighters';
import { ContactShadow } from './ContactShadow';
import { markContentReady, cockpitMount } from '../sceneBridge';
import { warmCockpit } from '../cockpit/cockpitPrebuild';
import { stage } from '../Stage';
import { Floor } from './bay/Floor';
import { SpaceVista } from './bay/SpaceVista';
import { Pad } from './Pad';
import { ShipDisplay } from './ShipDisplay';
import { turntable, updateTurntable, bindTurntable, stepShip } from './turntable';
import { hangarCam, updateHangarCamera, pushIn } from './hangarCamera';
import { useFlow } from '../../app/flow';
import { AudioBus } from '../../audio/AudioBus';
import { startHangarAmbience, stopHangarAmbience } from '../../audio/synth/ambience';
import { bus } from '../../core/bus';
import gsap from 'gsap';
import { useUi } from '../../state/ui.store';
import { useProfile } from '../../state/profile.store';
import { unlockState } from '../../data/unlocks';
import type { ShipId } from '../../data/ships';
import type { EffectiveQuality } from '../../render/perf';

const STAGES = 6;

export function Hangar({ shipId, forceUnlocked = false, q, reduceMotion, reduceFlashing }: { shipId: ShipId; forceUnlocked?: boolean; q: EffectiveQuality; reduceMotion: boolean; reduceFlashing: boolean }) {
  const gl = useThree(s => s.gl);
  const flowState = useFlow(s => s.state);
  const inHangar = flowState.startsWith('hangar.');
  const spin = useRef<Group>(null);
  const bay = useRef<Group>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STAGES) {
      markContentReady();
      return;
    }
    const id = requestAnimationFrame(() => setStep(s => s + 1));
    return () => cancelAnimationFrame(id);
  }, [step]);

  useEffect(() => {
    turntable.reduceMotion = reduceMotion;
  }, [reduceMotion]);
  useEffect(() => {
    turntable.enabled = flowState === 'hangar.idle' || flowState === 'hangar.upgrades';
    // Upgrades: ship slides left of the modal's track list
    gsap.to(hangarCam, { shift: flowState === 'hangar.upgrades' ? 1 : 0, duration: reduceMotion ? 0.01 : 0.9, ease: 'expo.inOut', overwrite: 'auto' });
  }, [flowState, reduceMotion]);

  // hangar ambience bed while in the hangar (starts once audio unlocks)
  useEffect(() => {
    if (!inHangar) return;
    if (AudioBus.running) startHangarAmbience();
    const off = bus.on('audio:unlocked', () => startHangarAmbience());
    return () => {
      off();
      stopHangarAmbience();
    };
  }, [inHangar]);

  // direct hangar entry (no boot dolly) gets the 1.5 s push-in
  const entered = useRef(false);
  useEffect(() => {
    if (!inHangar || entered.current) return;
    entered.current = true;
    const cameFromBoot = useFlow.getState().history.some(s => s.startsWith('boot.'));
    if (!cameFromBoot) pushIn(reduceMotion);
  }, [inHangar, reduceMotion]);

  useEffect(
    () =>
      bindTurntable(gl.domElement, {
        cycleShip: dir => {
          const ui = useUi.getState();
          const profile = useProfile.getState();
          const next = stepShip(ui.viewedShip ?? profile.selectedShip, dir);
          ui.setViewedShip(next);
          if (unlockState(next, profile).unlocked) profile.selectShip(next);
        },
        keysBlocked: () => {
          // any focused control (inventory list, tabs, sliders...) owns the arrows
          const a = document.activeElement;
          return useUi.getState().modal !== null || (a instanceof HTMLElement && a !== document.body && a.tagName !== 'CANVAS');
        },
      }),
    [gl],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      hangarCam.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      hangarCam.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  // pre-warm the cockpit a few seconds after the hangar first settles
  useEffect(() => {
    if (flowState !== 'hangar.idle' || cockpitMount.wanted) return;
    const idle = (window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))) as (cb: () => void, o?: { timeout: number }) => number;
    const t = window.setTimeout(() => idle(() => void warmCockpit(), { timeout: 3000 }), 2500);
    return () => window.clearTimeout(t);
  }, [flowState]);

  const hall = useRef<Group>(null);
  useFrame((state, dt) => {
    // the hangar is hidden while the pilot is in the cockpit (swapped behind the bulkhead)
    if (hall.current) hall.current.visible = stage.cockpit < 0.5;
    updateTurntable(dt);
    if (spin.current) spin.current.rotation.y = turntable.yaw;
    if (bay.current) bay.current.visible = !hangarCam.manual;
    if (inHangar && !hangarCam.manual) updateHangarCamera(state.clock.elapsedTime, dt, reduceMotion);
  });

  return (
    <group ref={hall} name="hangar">
      {/* staged mount: one part per frame so no single commit blocks a boot beat */}
      {step >= 0 && <Floor reflections={q.reflections} />}
      <group ref={bay}>
        {step >= 1 && <Bay />}
        {step >= 3 && <SpaceVista reduceMotion={reduceMotion} />}
        {step >= 4 && <BayLife particles={q.particles} reduceMotion={reduceMotion} reduceFlashing={reduceFlashing} />}
        {step >= 5 && <ParkedFighters />}
      </group>
      {step >= 2 && <Pad reduceMotion={reduceMotion} />}
      <group ref={spin}>{step >= 6 && <ShipDisplay shipId={shipId} forceUnlocked={forceUnlocked} />}</group>
      {step >= 6 && <ContactShadow />}
    </group>
  );
}
