// LAUNCH SEQUENCE (brief §14): replaces STANDBY on flow LAUNCH.
//   3-2-1 with Sato -> clamps release -> catapult down the launch tunnel (FOV
//   punch, shake, streaking strip lights) -> bay mouth -> flash (FOV punch +
//   chromatic burst) -> the world. (Phase 2R: the Veil Gate vortex is gone;
//   W5 replaces the flash with the orbit dive + cloud break.)
// The cut into the mission frame happens at the flash peak. One GSAP
// timeline (shared ticker: pausable, seekable). Retries use the fast
// relaunch (~1.6 s) in the valley.
import gsap from 'gsap';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { cockpitFx } from '../../scenes/cockpit/displays';
import { launchTunnelRef } from '../../scenes/cockpit/LaunchTunnel';
import { mission } from '../../scenes/mission/missionRuntime';
import { postfx } from '../../render/fxController';
import { CameraShaker } from '../../render/CameraShaker';
import { useSettings } from '../../state/settings.store';
import { useLaunchUi } from '../../state/launch.store';
import { sfx } from '../../audio/sfx';
import { LAUNCH } from '../../data/mission';
import { LAUNCH_LINES } from '../../data/lore';

const _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), _p = new Vector3();
let tl: gsap.core.Timeline | null = null;

/** The catapult run in the cockpit frame; `swap` is called at the breach flash peak. */
export function runLaunch(swap: () => void): Promise<void> {
  tl?.kill();
  const reduce = useSettings.getState().accessibility.reduceMotion;
  const mode = useSettings.getState().camera.mode;
  cockpitFx.view = mode === 'cockpit' ? 'eye' : mode;
  cockpitFx.hudMode = 'launch';
  cockpitFx.count = 3;
  const tunnel = launchTunnelRef.group;
  // deep-space skybox on the cockpit frame (fixed relative to the static ship)
  const sky = mission.sky;
  const cockpitRoot = tunnel?.parent ?? null;
  if (sky && cockpitRoot && sky.parent !== cockpitRoot) cockpitRoot.add(sky);
  const ui = useLaunchUi.getState();
  const st = { travel: 0, speed: 0, kick: 0, last: 0 };
  return new Promise(resolve => {
    tl = gsap.timeline({ onComplete: () => resolve() });
    const C = LAUNCH.countdown;
    const beep = (n: number) => () => {
      cockpitFx.count = n;
      ui.set({ count: n });
      sfx.play(n > 0 ? 'mfdBlip1' : 'clunkHeavy');
    };
    tl.call(() => {
      beep(3)();
      ui.set({ line: LAUNCH_LINES.count });
    }, [], 0);
    tl.call(beep(2), [], C);
    tl.call(beep(1), [], C * 2);
    const t0 = C * 3;
    tl.call(() => {
      beep(0)();
      ui.set({ line: LAUNCH_LINES.release });
      postfx.pulse({ shake: reduce ? 0.08 : 0.35, ca: 0.01, duration: 0.5 });
      if (!reduce) CameraShaker.setRumble(0.35, 14);
      sfx.play('whoosh');
    }, [], t0);
    // catapult: accelerate the whole run (power2.in), FOV punches in with speed
    tl.to(st, {
      travel: LAUNCH.travel,
      duration: LAUNCH.catapult,
      ease: 'power2.in',
      onUpdate: () => {
        const now = tl ? tl.time() : 0;
        const dt = Math.max(1e-3, now - st.last);
        st.speed = st.speed * 0.7 + ((st.travel - (tunnel?.position.z ?? 0)) / dt) * 0.3;
        st.last = now;
        if (tunnel) tunnel.position.z = st.travel;
        cockpitFx.launchSpeed = st.speed;
        cockpitFx.fovKick = reduce ? 0 : LAUNCH.fovPunch * Math.min(1, st.travel / LAUNCH.travel) ** 1.5;
        stretchStrips(st.speed);
        // out of the bay: the window plane gives way to the full sky
        const out = st.travel > LAUNCH.mouthTravel;
        if (sky) {
          sky.visible = true;
          (sky.material as import('three').ShaderMaterial).uniforms.uTime.value = now;
        }
        if (launchTunnelRef.sky) launchTunnelRef.sky.visible = !out;
      },
    }, t0);
    tl.call(() => ui.set({ line: LAUNCH_LINES.gate, count: null }), [], t0 + LAUNCH.catapult * 0.55);
    // breach: chromatic burst + HDR white flash, cut at the peak
    const tb = t0 + LAUNCH.catapult - LAUNCH.flashIn;
    tl.call(() => {
      postfx.pulse({ ca: 0.03, shake: reduce ? 0 : 0.5, vignette: 0.2, duration: 0.6 });
      postfx.setExposure(LAUNCH.flash, LAUNCH.flashIn);
      sfx.play('zing');
    }, [], tb);
    tl.call(() => {
      CameraShaker.setRumble(0);
      swap();
      resetLaunchRig();
      postfx.setExposure(1, LAUNCH.flashOut);
      ui.set({ line: null, count: null });
    }, [], t0 + LAUNCH.catapult);
    tl.to({}, { duration: LAUNCH.flashOut * 0.6 });
  });
}

/** Retry: the fast relaunch inside the corridor (flash in, settle, go). */
export function runFastLaunch(): Promise<void> {
  tl?.kill();
  const ui = useLaunchUi.getState();
  return new Promise(resolve => {
    tl = gsap.timeline({ onComplete: () => resolve() });
    tl.call(() => {
      postfx.setExposure(LAUNCH.flash * 0.5, 0.12);
      ui.set({ line: LAUNCH_LINES.retry, count: null });
      sfx.play('zing');
    }, [], 0);
    tl.call(() => postfx.setExposure(1, LAUNCH.fast * 0.6), [], 0.2);
    tl.call(() => ui.set({ line: null }), [], LAUNCH.fast);
    tl.to({}, { duration: 0.01 }, LAUNCH.fast);
  });
}

/** put the cockpit-frame launch rig back (launch tunnel at rest, strips unstretched, sky hidden) */
export function resetLaunchRig(): void {
  if (launchTunnelRef.group) launchTunnelRef.group.position.z = 0;
  stretchStrips(0);
  if (mission.sky) mission.sky.visible = false;
  if (launchTunnelRef.sky) launchTunnelRef.sky.visible = true;
  cockpitFx.fovKick = 0;
  cockpitFx.launchSpeed = 0;
  cockpitFx.view = 'eye';
}

/** strip lights streak with speed (one matrix per strip, only during the catapult) */
function stretchStrips(speed: number): void {
  const strips = launchTunnelRef.strips, spots = launchTunnelRef.spots;
  if (!strips) return;
  const k = 1 + speed * LAUNCH.stripStretch;
  _s.set(1, 1, k);
  for (let i = 0; i < spots.length; i++) {
    _p.copy(spots[i]);
    strips.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  strips.instanceMatrix.needsUpdate = true;
}
