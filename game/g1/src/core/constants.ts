// Global constants. Gameplay/visual tunables live in data/*.ts instead.

export const GAME_TITLE = 'SPACE WAR: DARK EDITION';
export const SAVE_KEY = 'spacewar.darkedition.save.v1';
export const SAVE_VERSION = 1;
export const IS_DEV = import.meta.env.DEV;

/** Query flags (QA harness + dev shortcuts). Parsed once at startup. */
export const QUERY = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const DEBUG = QUERY.get('debug') === '1';
