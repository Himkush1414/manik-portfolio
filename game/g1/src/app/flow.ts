// App-flow finite state machine (brief §5). Hand-rolled + typed: each state
// lists the ONLY events it accepts, which is also the double-trigger guard —
// once START_MISSION moves us to launch.doorsClose, a second START_MISSION is
// simply not accepted there. Choreography (GSAP) reports completion with the
// *_DONE events; nothing else can move the machine while one runs.
import { create } from 'zustand';
import { bus } from '../core/bus';

export type FlowState =
  | 'boot.black'
  | 'boot.logo'
  | 'boot.credit'
  | 'boot.tagline'
  | 'boot.loading'
  | 'boot.doors'
  | 'hangar.idle'
  | 'hangar.upgrades'
  | 'hangar.settings'
  | 'launch.doorsClose'
  | 'launch.reveal'
  | 'launch.briefing'
  | 'launch.cameraSelect'
  | 'launch.standby'
  | 'launch.returning';

export type FlowEvent =
  | 'BEAT_NEXT'
  | 'SKIP_TO_LOADING'
  | 'SKIP_ALL'
  | 'BOOT_DONE'
  | 'OPEN_UPGRADES'
  | 'OPEN_SETTINGS'
  | 'CLOSE_MODAL'
  | 'START_MISSION'
  | 'DOORS_CLOSED'
  | 'REVEAL_DONE'
  | 'BRIEFING_ACK'
  | 'CAMERA_CHOSEN'
  | 'LAUNCH'
  | 'ABORT_TO_HANGAR'
  | 'RETURNED';

type Table = { [S in FlowState]: Partial<Record<FlowEvent, FlowState>> };

export const TRANSITIONS: Table = {
  'boot.black': { BEAT_NEXT: 'boot.logo', SKIP_TO_LOADING: 'boot.loading', SKIP_ALL: 'hangar.idle' },
  'boot.logo': { BEAT_NEXT: 'boot.credit', SKIP_TO_LOADING: 'boot.loading', SKIP_ALL: 'hangar.idle' },
  'boot.credit': { BEAT_NEXT: 'boot.tagline', SKIP_TO_LOADING: 'boot.loading', SKIP_ALL: 'hangar.idle' },
  'boot.tagline': { BEAT_NEXT: 'boot.loading', SKIP_TO_LOADING: 'boot.loading', SKIP_ALL: 'hangar.idle' },
  'boot.loading': { BEAT_NEXT: 'boot.doors', SKIP_ALL: 'hangar.idle' },
  'boot.doors': { BOOT_DONE: 'hangar.idle', SKIP_ALL: 'hangar.idle' },
  'hangar.idle': { OPEN_UPGRADES: 'hangar.upgrades', OPEN_SETTINGS: 'hangar.settings', START_MISSION: 'launch.doorsClose' },
  'hangar.upgrades': { CLOSE_MODAL: 'hangar.idle', OPEN_SETTINGS: 'hangar.settings' },
  'hangar.settings': { CLOSE_MODAL: 'hangar.idle', OPEN_UPGRADES: 'hangar.upgrades' },
  'launch.doorsClose': { DOORS_CLOSED: 'launch.reveal' },
  'launch.reveal': { REVEAL_DONE: 'launch.briefing' },
  'launch.briefing': { BRIEFING_ACK: 'launch.cameraSelect', ABORT_TO_HANGAR: 'launch.returning' },
  'launch.cameraSelect': { CAMERA_CHOSEN: 'launch.standby', ABORT_TO_HANGAR: 'launch.returning' },
  // Phase 2 adds the real mission states behind LAUNCH.
  'launch.standby': { ABORT_TO_HANGAR: 'launch.returning' },
  'launch.returning': { RETURNED: 'hangar.idle' },
};

export const isBoot = (s: FlowState) => s.startsWith('boot.');
export const isHangar = (s: FlowState) => s.startsWith('hangar.');
export const isLaunch = (s: FlowState) => s.startsWith('launch.');

type FlowStore = {
  state: FlowState;
  history: FlowState[];
  send(event: FlowEvent): boolean;
  /** Test/QA only: jump directly (bypasses the table). */
  force(state: FlowState): void;
};

export function nextState(state: FlowState, event: FlowEvent): FlowState | null {
  return TRANSITIONS[state][event] ?? null;
}

export const useFlow = create<FlowStore>()((set, get) => ({
  state: 'boot.black',
  history: [],
  send(event) {
    const from = get().state;
    const to = nextState(from, event);
    if (!to) return false;
    set(s => ({ state: to, history: [...s.history.slice(-31), from] }));
    bus.emit('flow:state', { from, to });
    return true;
  },
  force(state) {
    const from = get().state;
    set(s => ({ state, history: [...s.history.slice(-31), from] }));
    bus.emit('flow:state', { from, to: state });
  },
}));

/** Non-React access (choreography, debug API). */
export const flow = {
  send: (e: FlowEvent) => useFlow.getState().send(e),
  get state() {
    return useFlow.getState().state;
  },
  force: (s: FlowState) => useFlow.getState().force(s),
};
