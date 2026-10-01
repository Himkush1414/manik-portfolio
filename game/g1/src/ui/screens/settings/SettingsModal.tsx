// SETTINGS (brief §14): CONTROLS / CAMERA / GRAPHICS / AUDIO / ACCESSIBILITY.
// Every change applies live and persists (save.ts subscribes to the store).
// Rebinding: press-a-key capture (keyboard codes + mouse buttons) with
// conflict detection (swap / cancel), per-action reset, reset all.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import s from './settings.module.css';
import { HoldButton, HudButton, HudPanel, Keycap, Modal, Segmented, Slider, Toggle } from '../../primitives';
import { useSettings } from '../../../state/settings.store';
import { useProfile } from '../../../state/profile.store';
import { useUi } from '../../../state/ui.store';
import { ACTION_ORDER, ACTION_LABEL, type InputAction } from '../../../input/actions';
import { DEFAULT_BINDINGS, RESERVED_CODES, assignBinding, cloneBindings, findConflict } from '../../../input/bindings';
import { keyLabel, loadKeyboardLayout } from '../../../input/keyLabels';
import { PRESETS, type Preset } from '../../../render/quality';
import { resetProgress } from '../../../state/save';
import { DEBUG } from '../../../core/constants';
import { sfx } from '../../../audio/sfx';
import { closeModal } from '../hangar/hangarActions';
import type { CameraMode } from '../../../render/cameraRig';

type Tab = 'controls' | 'camera' | 'graphics' | 'audio' | 'access';
const TABS: { id: Tab; label: string }[] = [
  { id: 'controls', label: 'CONTROLS' },
  { id: 'camera', label: 'CAMERA' },
  { id: 'graphics', label: 'GRAPHICS' },
  { id: 'audio', label: 'AUDIO' },
  { id: 'access', label: 'ACCESSIBILITY' },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <span className={s.label}>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <div className={s.ctl}>{children}</div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/* ---------------------------------------------------------------- controls */
function Controls() {
  const c = useSettings(st => st.controls);
  const patch = useSettings(st => st.patch);
  const setBindings = useSettings(st => st.setBindings);
  const [capture, setCapture] = useState<{ action: InputAction; slot: 0 | 1 } | null>(null);
  const [conflict, setConflict] = useState<{ action: InputAction; slot: 0 | 1; code: string; other: InputAction } | null>(null);
  const [, relabel] = useState(0);
  useEffect(() => void loadKeyboardLayout().then(() => relabel(n => n + 1)), []);

  useEffect(() => {
    if (!capture) return;
    const take = (code: string, e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (code === 'Escape') {
        setCapture(null);
        sfx.play('deny');
        return;
      }
      if (RESERVED_CODES.has(code)) {
        useUi.getState().toast(`${keyLabel(code)} is reserved by the browser`, 'danger');
        sfx.play('deny');
        return;
      }
      const hit = findConflict(c.bindings, code, capture);
      setCapture(null);
      if (hit) {
        setConflict({ ...capture, code, other: hit.action });
        sfx.play('locked');
        return;
      }
      setBindings(assignBinding(c.bindings, capture, code));
      sfx.play('confirm');
    };
    const key = (e: KeyboardEvent) => take(e.code, e);
    const mouse = (e: MouseEvent) => take(`Mouse${e.button}`, e);
    // capture phase: the modal's own Esc / Tab handling must not see these
    window.addEventListener('keydown', key, true);
    const t = window.setTimeout(() => window.addEventListener('mousedown', mouse, true), 50);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('mousedown', mouse, true);
      window.clearTimeout(t);
    };
  }, [capture, c.bindings, setBindings]);

  return (
    <>
      <h3 className={s.section}>Key bindings</h3>
      <div className={s.binds}>
        <span className={s.bindHead}>Action</span>
        <span className={s.bindHead}>Primary</span>
        <span className={s.bindHead}>Alternate</span>
        <span />
        {ACTION_ORDER.map(a => (
          <div key={a} style={{ display: 'contents' }}>
            <span className={s.bindName}>{ACTION_LABEL[a]}</span>
            {([0, 1] as const).map(slot => {
              const capturing = capture?.action === a && capture.slot === slot;
              const code = c.bindings[a][slot];
              return (
                <button
                  key={slot}
                  type="button"
                  className={s.keyBtn}
                  data-capturing={capturing}
                  data-empty={!code}
                  aria-label={`${ACTION_LABEL[a]} ${slot ? 'alternate' : 'primary'}: ${capturing ? 'press a key' : keyLabel(code)}`}
                  onPointerEnter={() => sfx.play('hover')}
                  onClick={() => {
                    setConflict(null);
                    setCapture({ action: a, slot });
                    sfx.play('confirm');
                  }}
                >
                  {capturing ? 'PRESS A KEY…' : keyLabel(code)}
                </button>
              );
            })}
            <button
              type="button"
              className={s.resetSmall}
              aria-label={`Reset ${ACTION_LABEL[a]}`}
              title="Reset to default"
              onPointerEnter={() => sfx.play('hover')}
              onClick={() => {
                const next = cloneBindings(c.bindings);
                next[a] = [...DEFAULT_BINDINGS[a]];
                setBindings(next);
                sfx.play('confirm');
              }}
            >
              ↺
            </button>
            {conflict && conflict.action === a && (
              <div className={s.conflict} role="alert">
                <span>
                  {keyLabel(conflict.code)} is bound to {ACTION_LABEL[conflict.other]}
                </span>
                <HudButton
                  variant="primary"
                  data-autofocus
                  onClick={() => {
                    setBindings(assignBinding(c.bindings, { action: conflict.action, slot: conflict.slot }, conflict.code, 'swap'));
                    setConflict(null);
                  }}
                >
                  SWAP
                </HudButton>
                <HudButton variant="ghost" onClick={() => setConflict(null)}>
                  CANCEL
                </HudButton>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'calc(var(--u) * 14)' }}>
        <HudButton variant="ghost" onClick={() => setBindings(cloneBindings(DEFAULT_BINDINGS))}>
          RESET ALL BINDINGS
        </HudButton>
      </div>
      <h3 className={s.section}>Mouse</h3>
      <Row label="Sensitivity" hint="0.1 – 3.0×. Move over the box to test.">
        <Slider value={c.sensitivity} min={0.1} max={3} step={0.05} onChange={v => patch('controls', { sensitivity: v })} label="Mouse sensitivity" />
        <ReticlePreview />
      </Row>
      <Row label="Invert Y">
        <Toggle checked={c.invertY} onChange={v => patch('controls', { invertY: v })} label="Invert Y" />
      </Row>
      <Row label="Deadzone">
        <Slider value={c.deadzone} min={0} max={0.5} step={0.01} onChange={v => patch('controls', { deadzone: v })} label="Deadzone" format={pct} numeric={false} />
      </Row>
      <Row label="Smoothing">
        <Slider value={c.smoothing} min={0} max={1} step={0.01} onChange={v => patch('controls', { smoothing: v })} label="Smoothing" format={pct} numeric={false} />
      </Row>
      <p className={s.hint}>Keyboard and mouse always work together — never either-or.</p>
    </>
  );
}

/** Reticle that follows the mouse inside the box with the live sensitivity,
 *  invert-Y, deadzone and smoothing applied. */
function ReticlePreview() {
  const box = useRef<HTMLDivElement>(null);
  const ret = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = box.current!;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      const c = useSettings.getState().controls;
      const dz = (v: number) => (Math.abs(v) < c.deadzone ? 0 : Math.sign(v) * ((Math.abs(v) - c.deadzone) / (1 - c.deadzone)));
      target.x = Math.max(-1, Math.min(1, dz(nx) * c.sensitivity));
      target.y = Math.max(-1, Math.min(1, dz(ny) * c.sensitivity * (c.invertY ? -1 : 1)));
    };
    const leave = () => {
      target.x = target.y = 0;
    };
    const tick = () => {
      const k = 1 - useSettings.getState().controls.smoothing * 0.92;
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      if (ret.current) ret.current.style.transform = `translate(${cur.x * (el.clientWidth / 2 - 12)}px, ${cur.y * (el.clientHeight / 2 - 12)}px)`;
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    raf = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={box} className={s.reticleBox} aria-label="Sensitivity preview">
      <span ref={ret} className={s.reticle} />
      <span className={s.reticleHint}>LIVE PREVIEW</span>
    </div>
  );
}

/* ------------------------------------------------------------------ camera */
function Camera() {
  const cam = useSettings(st => st.camera);
  const patch = useSettings(st => st.patch);
  const setMode = useSettings(st => st.setCameraMode);
  return (
    <>
      <h3 className={s.section}>Flight camera</h3>
      <Row label="Default mode" hint="Switchable any time in mission.">
        <Segmented<CameraMode>
          label="Default camera"
          value={cam.mode}
          onChange={setMode}
          options={[
            { id: 'third', label: 'THIRD PERSON' },
            { id: 'chase', label: 'CHASE' },
            { id: 'cockpit', label: 'COCKPIT' },
          ]}
        />
      </Row>
      <Row label="Field of view">
        <Slider value={cam.fov} min={60} max={100} step={1} onChange={v => patch('camera', { fov: v })} label="Field of view" />
      </Row>
      <Row label="Camera shake">
        <Slider value={cam.shake} min={0} max={1} step={0.01} onChange={v => patch('camera', { shake: v })} label="Camera shake" format={pct} numeric={false} />
      </Row>
      <Row label="Helmet frame" hint="Dark visor rim in cockpit view.">
        <Segmented
          label="Helmet frame"
          value={cam.helmetFrame}
          onChange={v => patch('camera', { helmetFrame: v })}
          options={[
            { id: 'off', label: 'OFF' },
            { id: 'subtle', label: 'SUBTLE' },
            { id: 'full', label: 'FULL' },
          ]}
        />
      </Row>
    </>
  );
}

/* ---------------------------------------------------------------- graphics */
function Graphics() {
  const g = useSettings(st => st.graphics);
  const patch = useSettings(st => st.patch);
  const setPreset = useSettings(st => st.setPreset);
  const toggle = (k: 'bloom' | 'chromatic' | 'grain' | 'vignette' | 'dof' | 'ao' | 'reflections', label: string, hint?: string) => (
    <Row key={k} label={label} hint={hint}>
      <Toggle checked={g[k]} onChange={v => patch('graphics', { [k]: v })} label={label} />
    </Row>
  );
  return (
    <>
      <h3 className={s.section}>Quality</h3>
      <Row label="Preset" hint={g.autoPicked ? 'Auto-selected for this GPU on first run.' : undefined}>
        <Segmented<Preset> label="Quality preset" value={g.preset} onChange={p => setPreset(p)} options={PRESETS.map(p => ({ id: p, label: p.toUpperCase() }))} />
      </Row>
      <Row label="Resolution scale">
        <Slider value={g.resScale} min={0.5} max={1} step={0.05} onChange={v => patch('graphics', { resScale: v })} label="Resolution scale" format={pct} numeric={false} />
      </Row>
      <Row label="FPS cap">
        <Segmented<0 | 60 | 30>
          label="FPS cap"
          value={g.fpsCap}
          onChange={v => patch('graphics', { fpsCap: v })}
          options={[
            { id: 0, label: 'UNCAPPED' },
            { id: 60, label: '60' },
            { id: 30, label: '30' },
          ]}
        />
      </Row>
      <Row label="Show FPS">
        <Toggle checked={g.showFps} onChange={v => patch('graphics', { showFps: v })} label="Show FPS" />
      </Row>
      <h3 className={s.section}>Effects</h3>
      {toggle('bloom', 'Bloom')}
      {toggle('chromatic', 'Chromatic aberration')}
      {toggle('grain', 'Film grain')}
      {toggle('vignette', 'Vignette')}
      {toggle('dof', 'Depth of field', 'HIGH and ULTRA presets.')}
      {toggle('ao', 'Ambient occlusion', 'HIGH and ULTRA presets.')}
      {toggle('reflections', 'Floor reflections', 'Off on LOW.')}
    </>
  );
}

/* ------------------------------------------------------------------- audio */
function Audio() {
  const a = useSettings(st => st.audio);
  const patch = useSettings(st => st.patch);
  const slider = (k: 'master' | 'music' | 'sfx' | 'ui', label: string) => (
    <Row key={k} label={label}>
      <Slider value={a[k]} min={0} max={1} step={0.01} onChange={v => patch('audio', { [k]: v })} label={`${label} volume`} format={pct} numeric={false} />
    </Row>
  );
  return (
    <>
      <h3 className={s.section}>Mix</h3>
      <Row label="Mute all">
        <Toggle checked={a.mute} onChange={v => patch('audio', { mute: v })} label="Mute all audio" />
      </Row>
      {slider('master', 'Master')}
      {slider('music', 'Music & ambience')}
      {slider('sfx', 'Effects')}
      {slider('ui', 'Interface')}
    </>
  );
}

/* ----------------------------------------------------------- accessibility */
function Access() {
  const a = useSettings(st => st.accessibility);
  const patch = useSettings(st => st.patch);
  return (
    <>
      <h3 className={s.section}>Comfort</h3>
      <Row label="Reduce motion" hint="Cuts camera moves, shake, parallax and long transitions.">
        <Toggle checked={a.reduceMotion} onChange={v => patch('accessibility', { reduceMotion: v })} label="Reduce motion" />
      </Row>
      <Row label="Reduce flashing" hint="Caps flashes below 3 per second.">
        <Toggle checked={a.reduceFlashing} onChange={v => patch('accessibility', { reduceFlashing: v })} label="Reduce flashing" />
      </Row>
      <Row label="UI scale" hint="80 – 130%.">
        <Slider value={a.uiScale} min={0.8} max={1.3} step={0.05} onChange={v => patch('accessibility', { uiScale: v })} label="UI scale" format={pct} numeric={false} />
      </Row>
    </>
  );
}

/* ------------------------------------------------------------------- modal */
export function SettingsModal() {
  const [tab, setTab] = useState<Tab>('controls');
  const [confirmReset, setConfirmReset] = useState(false);
  const profile = useProfile();
  return (
    <Modal title="SETTINGS" kicker="SYSTEM // CONFIG" onClose={closeModal}>
      <div className={s.body}>
        <nav className={s.nav} aria-label="Settings sections">
          {/* the tablist holds ONLY tabs (reset / cheats live in the nav, outside it) */}
          <div className={s.navTabs} role="tablist" aria-orientation="vertical" aria-label="Settings sections">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={s.navBtn}
                onPointerEnter={() => sfx.play('hover')}
                onClick={() => {
                  if (tab !== t.id) sfx.play('confirm');
                  setTab(t.id);
                }}
              >
                {t.label}
                <span aria-hidden>›</span>
              </button>
            ))}
          </div>
          <div className={s.navFoot}>
            <small>Profile · {profile.credits.toLocaleString('en-US')} CR · level {profile.highestLevelCleared}</small>
            {confirmReset ? (
              <div className={s.confirm} role="alert">
                <span>Erase credits, unlocks and upgrades? Settings are kept.</span>
                <HoldButton
                  variant="danger"
                  holdMs={900}
                  onConfirm={() => {
                    resetProgress();
                    setConfirmReset(false);
                    sfx.play('clunk');
                    useUi.getState().setViewedShip('halcyon');
                    useUi.getState().toast('Progress reset', 'danger');
                  }}
                >
                  HOLD TO RESET
                </HoldButton>
                <HudButton variant="ghost" onClick={() => setConfirmReset(false)}>
                  CANCEL
                </HudButton>
              </div>
            ) : (
              <HudButton variant="danger" onClick={() => setConfirmReset(true)}>
                RESET PROGRESS
              </HudButton>
            )}
            {DEBUG && (
              <>
                <small>Dev cheats (debug only)</small>
                <div className={s.cheats}>
                  <HudButton variant="ghost" onClick={() => profile.grantCredits(10000)}>
                    +10,000 CR
                  </HudButton>
                  <HudButton variant="ghost" onClick={() => profile.unlockAll()}>
                    UNLOCK ALL
                  </HudButton>
                  <HudButton variant="ghost" onClick={() => profile.setLevelCleared(profile.highestLevelCleared + 10)}>
                    LEVEL +10
                  </HudButton>
                </div>
              </>
            )}
          </div>
        </nav>
        <HudPanel title={TABS.find(t => t.id === tab)!.label} meta="applies live · saved automatically" className={s.pane}>
          <div className={s.scroll} role="tabpanel">
            {tab === 'controls' && <Controls />}
            {tab === 'camera' && <Camera />}
            {tab === 'graphics' && <Graphics />}
            {tab === 'audio' && <Audio />}
            {tab === 'access' && <Access />}
          </div>
        </HudPanel>
      </div>
      <span style={{ position: 'absolute', right: 'calc(var(--u) * 48)', bottom: 'calc(var(--u) * 16)' }} className={s.hint}>
        <Keycap>ESC</Keycap> CLOSE · <Keycap>TAB</Keycap> NAVIGATE
      </span>
    </Modal>
  );
}
