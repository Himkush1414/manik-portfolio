// Global constants. Gameplay/visual tunables live in data/*.ts instead.

export const GAME_TITLE = 'SPACE WAR: DARK EDITION';
export const SAVE_KEY = 'spacewar.darkedition.save.v1';
/** v2 (Phase 2R F1): controls.steering + reticle options, camera.attachment + rollStrength */
export const SAVE_VERSION = 2;
export const IS_DEV = import.meta.env.DEV;

/** Query flags (QA harness + dev shortcuts). Parsed once at startup. */
export const QUERY = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = QUERY.get('debug') === '1';
/** ?seed=<n>: runtime randomisation (bay life) for reproducible QA; 0 = the shipped look. */
export const SEED = Number.parseInt(QUERY.get('seed') ?? '0', 10) || 0;
