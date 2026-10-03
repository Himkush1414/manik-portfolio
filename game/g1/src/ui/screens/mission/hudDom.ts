// The mission HUD's DOM handles (plain object; filled by <MissionHUD/> once,
// written by the scene-side MissionHudDriver: transforms every frame, text /
// bars only when the sim's 20 Hz HUD refresh changed something).
export const hudDom = {
  root: null as HTMLElement | null,
  reticle: null as HTMLElement | null,
  pipper: null as HTMLElement | null,
  hit: null as HTMLElement | null,
  kill: null as HTMLElement | null,
  threats: [] as HTMLElement[],
  score: null as HTMLElement | null,
  combo: null as HTMLElement | null,
  comboRing: null as SVGCircleElement | null,
  progress: null as HTMLElement | null,
  progressPct: null as HTMLElement | null,
  credits: null as HTMLElement | null,
  shieldBlock: null as HTMLElement | null,
  shield: null as HTMLElement | null,
  shieldVal: null as HTMLElement | null,
  hullBlock: null as HTMLElement | null,
  hull: null as HTMLElement | null,
  hullVal: null as HTMLElement | null,
  boostBlock: null as HTMLElement | null,
  boost: null as HTMLElement | null,
  speed: null as HTMLElement | null,
  rollRing: null as SVGCircleElement | null,
  target: null as HTMLElement | null,
  targetName: null as HTMLElement | null,
  targetHp: null as HTMLElement | null,
  /** flight alerts (addendum §3) + tutorial prompt */
  whiteout: null as HTMLElement | null,
  flash: null as HTMLElement | null,
  alert: null as HTMLElement | null,
  callout: null as HTMLElement | null,
  streak: null as HTMLElement | null,
  prompt: null as HTMLElement | null,
  promptVerb: null as HTMLElement | null,
  promptKeys: null as HTMLElement | null,
};

/** circumference of the 2 small SVG rings (r = 15) */
export const RING_C = 2 * Math.PI * 15;
