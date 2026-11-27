// The library demo flag (?demo=eject) and the states it locks. Dependency-free on purpose: flow.ts
// imports it, so it must not pull in audio / stores. Behaviour lives in ./demo.ts.
import { QUERY } from '../core/constants';
import type { FlowState } from './flow';

/** The /games library plays the game only up to (and including) the catapult ejection. */
export const DEMO_END_AT_EJECT = QUERY.get('demo') === 'eject';

/** everything after the catapult run: never entered in the demo */
export const DEMO_LOCKED_STATES: ReadonlySet<FlowState> = new Set<FlowState>([
  'mission.playing',
  'mission.paused',
  'mission.bossIntro',
  'mission.dying',
  'mission.failed',
  'mission.completing',
  'mission.results',
]);
