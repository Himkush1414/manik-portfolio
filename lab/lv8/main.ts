// /lab/lv8 — hub bootstrap. The strip-field hero background (three.js)
// loads eagerly, since it IS the hero's visible background — but ./game,
// the actual playable scene, stays a dynamic import inside the "PLAY"
// click handler below, so its own weight never loads just from visiting
// this page. Neither one loads for any other route on the site regardless.
//
// Only TYPES are imported from ./game at the top level (fully erased at
// compile time, per tsconfig's isolatedModules) — importing any actual
// VALUE from ./game here would drag the whole module (and three.js with
// it) into this file's own eager bundle, defeating the point of the
// dynamic import below entirely. DEFAULT_KEY_BINDINGS is therefore
// duplicated locally rather than imported.
import { setHeroActive } from './lv8-strip-field';
import type {
  WormholeGame as WormholeGameType,
  WormholeGameCallbacks,
  ControlScheme,
  Viewpoint,
  KeyBindings,
  GameSettings,
} from './game';

// Freshness beacon, matching the convention every other route on this site uses.
console.log('%clab/lv8 build 2026-09-14 (Games Lab)', 'color:#A83421;font-weight:600;background:#15100D;padding:2px 6px');

const backBtn = document.getElementById('lv8-nav-back');
backBtn?.addEventListener('click', () => {
  if (window.history.length > 1) window.history.back();
  else window.location.href = '/';
});

// ---------------------------------------------------------------
// Desktop-only gate for the game itself. WASD + Space (or a mouse) has no
// sane touch equivalent to improvise here without shipping a half-working
// control scheme (flagged back explicitly, see the chat reply) — the
// hub/Bento section itself still renders and reads fine on a narrow/touch
// viewport, only the flagship tile's PLAY action is disabled there.
// ---------------------------------------------------------------
const DESKTOP_MQ = window.matchMedia('(min-width: 861px) and (hover: hover) and (pointer: fine)');
const playBtn = document.getElementById('lv8-play-btn') as HTMLButtonElement | null;
const desktopNote = document.getElementById('lv8-desktop-note');

function applyDesktopGate() {
  const ok = DESKTOP_MQ.matches;
  if (playBtn) playBtn.disabled = !ok;
  if (desktopNote) desktopNote.hidden = ok;
}
applyDesktopGate();
DESKTOP_MQ.addEventListener('change', applyDesktopGate);

// ---------------------------------------------------------------
// Session state — in-memory only. No backend/persistence in this task
// (explicitly deferred — see chat reply); the name exists purely to
// personalise this session's own UI (e.g. the game-over screen).
// ---------------------------------------------------------------
const DEFAULT_KEY_BINDINGS: KeyBindings = { left: 'a', right: 'd', up: 'w', down: 's' };
const DIR_LABELS: Record<keyof KeyBindings, string> = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' };
// Mirrors game.ts's own HEARTS_FROM_LEVEL — duplicated for the same reason
// DEFAULT_KEY_BINDINGS is: main.ts can only import TYPES from ./game.
const HEARTS_FROM_LEVEL = 10;
const HEALTH_MAX = 100;

let playerName = 'PILOT';
let controlScheme: ControlScheme = 'keyboard';
let viewpoint: Viewpoint = 'cockpit';
let sensitivity = 1;
let keyBindings: KeyBindings = { ...DEFAULT_KEY_BINDINGS };

function currentSettings(): GameSettings {
  return { controlScheme, keyBindings: { ...keyBindings }, sensitivity };
}

// ---------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------
const hub = document.getElementById('lv8-hub') as HTMLElement;
const overlay = document.getElementById('lv8-game-overlay') as HTMLElement;
const canvasWrap = document.getElementById('lv8-game-canvas-wrap') as HTMLElement;
const hud = document.getElementById('lv8-hud') as HTMLElement;
const scoreEl = document.getElementById('lv8-hud-score') as HTMLElement;
const levelEl = document.getElementById('lv8-hud-level') as HTMLElement;
const speedEl = document.getElementById('lv8-hud-speed') as HTMLElement;
const livesEl = document.getElementById('lv8-hud-lives') as HTMLElement;
const healthWrapEl = document.getElementById('lv8-hud-health-wrap') as HTMLElement;
const healthFillEl = document.getElementById('lv8-hud-health-fill') as HTMLElement;
const bonusToastEl = document.getElementById('lv8-bonus-toast') as HTMLElement;
const flashEl = document.getElementById('lv8-flash') as HTMLElement;
const gameOverEl = document.getElementById('lv8-gameover') as HTMLElement;
const gameOverScoreEl = document.getElementById('lv8-gameover-score') as HTMLElement;
const gameOverKickerEl = document.querySelector('#lv8-gameover .lv8-gameover__kicker') as HTMLElement | null;
const gameOverQuipEl = document.getElementById('lv8-gameover-quip') as HTMLElement;
const exitBtn = document.getElementById('lv8-game-exit') as HTMLButtonElement;
const restartBtn = document.getElementById('lv8-restart-btn') as HTMLButtonElement;
const gameOverExitBtn = document.getElementById('lv8-gameover-exit') as HTMLButtonElement;
const pauseBtn = document.getElementById('lv8-game-pause') as HTMLButtonElement;

const setupEl = document.getElementById('lv8-setup') as HTMLElement;
const setupPanels = Array.from(setupEl.querySelectorAll<HTMLElement>('.lv8-setup__panel'));
const nameInput = document.getElementById('lv8-name-input') as HTMLInputElement;
const nameNextBtn = document.getElementById('lv8-name-next') as HTMLButtonElement;
const controlOptionsEl = document.getElementById('lv8-control-options') as HTMLElement;
const controlsNextBtn = document.getElementById('lv8-controls-next') as HTMLButtonElement;
const viewpointOptionsEl = document.getElementById('lv8-viewpoint-options') as HTMLElement;
const setupSettingsBtn = document.getElementById('lv8-setup-settings-btn') as HTMLButtonElement;
const setupPlayBtn = document.getElementById('lv8-setup-play-btn') as HTMLButtonElement;

const settingsEl = document.getElementById('lv8-settings') as HTMLElement;
const sensitivityInput = document.getElementById('lv8-sensitivity') as HTMLInputElement;
const settingsControlOptionsEl = document.getElementById('lv8-settings-control-options') as HTMLElement;
const settingsViewpointOptionsEl = document.getElementById('lv8-settings-viewpoint-options') as HTMLElement;
const settingsCloseBtn = document.getElementById('lv8-settings-close') as HTMLButtonElement;
const remapBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.lv8-remap-btn'));

const pauseEl = document.getElementById('lv8-pause') as HTMLElement;
const pauseResumeBtn = document.getElementById('lv8-pause-resume') as HTMLButtonElement;
const pauseSettingsBtn = document.getElementById('lv8-pause-settings') as HTMLButtonElement;
const portalEl = document.getElementById('lv8-portal') as HTMLElement;
const portalReadyBtn = document.getElementById('lv8-portal-ready') as HTMLButtonElement;
const pauseExitBtn = document.getElementById('lv8-pause-exit') as HTMLButtonElement;

let activeGame: WormholeGameType | null = null;
let loadingGame = false;
let settingsReturnTo: 'setup' | 'pause' = 'setup';
let listeningForKey: keyof KeyBindings | null = null;

function renderLives(lives: number) {
  livesEl.textContent = '●'.repeat(Math.max(lives, 0)) + '○'.repeat(Math.max(3 - lives, 0));
}

function renderHealth(health: number) {
  healthFillEl.style.width = `${Math.max(0, Math.min(100, (health / HEALTH_MAX) * 100))}%`;
}

// Two fail conditions never display at once: levels 1-9 show the health
// bar (miss-based damage), level 10+ switches entirely to the 3-heart
// display — driven by the game's own onLevelChange callback so it can
// never drift out of sync with which system is actually active.
function renderLevel(level: number) {
  levelEl.textContent = String(level);
  const heartsActive = level >= HEARTS_FROM_LEVEL;
  healthWrapEl.hidden = heartsActive;
  livesEl.hidden = !heartsActive;
}

let bonusToastTimer: number | undefined;
function showToast(text: string, durationMs = 2400) {
  bonusToastEl.textContent = text;
  bonusToastEl.classList.add('is-active');
  window.clearTimeout(bonusToastTimer);
  bonusToastTimer = window.setTimeout(() => bonusToastEl.classList.remove('is-active'), durationMs);
}
function showBonusToast(kind: 'life' | 'frenzy') {
  showToast(kind === 'life' ? 'SECRET FOUND — EXTRA LIFE' : 'SECRET FOUND — FRENZY MODE');
}
function showMilestoneToast(level: number, bonus: number) {
  showToast(`MILESTONE — LEVEL ${level} CLEARED — +${bonus}`, 3000);
}

// PIP's game-over lines — one picked at random per run. Kept light: the
// obstacle course is unforgiving, the narrator doesn't need to be.
const GAMEOVER_QUIPS = [
  'The void says hi.',
  "That's one way to end a run.",
  'Textbook navigational error. Very dramatic, 10/10.',
  'Skill issue, respectfully.',
  "On the bright side, you're very aerodynamic now.",
  "PIP has seen worse. PIP has also seen better.",
  'Congratulations, you have unlocked: gravity.',
  'That obstacle was rated PG. You were rated "oof."',
];
function randomQuip(): string {
  return GAMEOVER_QUIPS[Math.floor(Math.random() * GAMEOVER_QUIPS.length)];
}

// ---------------------------------------------------------------
// Hub <-> setup wizard <-> game switch
// ---------------------------------------------------------------
function showHub() {
  overlay.classList.remove('is-active');
  overlay.setAttribute('aria-hidden', 'true');
  hud.setAttribute('aria-hidden', 'true');
  gameOverEl.classList.remove('is-active');
  gameOverEl.setAttribute('aria-hidden', 'true');
  pauseEl.classList.remove('is-active');
  portalEl.classList.remove('is-active');
  portalEl.setAttribute('aria-hidden', 'true');
  setupEl.classList.remove('is-active');
  hub.hidden = false;
  setHeroActive(true);
}

function showGame() {
  hub.hidden = true;
  setHeroActive(false);
  setupEl.classList.remove('is-active');
  overlay.classList.add('is-active');
  overlay.setAttribute('aria-hidden', 'false');
  hud.setAttribute('aria-hidden', 'false');
}

function showSetupStep(step: string) {
  for (const panel of setupPanels) panel.classList.toggle('is-active', panel.dataset.step === step);
}

function openSetup() {
  hub.hidden = true;
  setHeroActive(false);
  setupEl.classList.add('is-active');
  setupEl.setAttribute('aria-hidden', 'false');
  nameInput.value = playerName === 'PILOT' ? '' : playerName;
  syncOptionButtons(controlOptionsEl, controlScheme);
  syncOptionButtons(viewpointOptionsEl, viewpoint);
  showSetupStep('name');
  nameInput.focus();
}

function syncOptionButtons(container: HTMLElement, value: string) {
  container.querySelectorAll<HTMLElement>('.lv8-setup__option').forEach(btn => {
    btn.classList.toggle('is-selected', btn.dataset.value === value);
  });
}

nameNextBtn.addEventListener('click', () => {
  const trimmed = nameInput.value.trim();
  playerName = trimmed.length > 0 ? trimmed.toUpperCase().slice(0, 18) : 'PILOT';
  showSetupStep('controls');
});
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') nameNextBtn.click();
});

controlOptionsEl.querySelectorAll<HTMLButtonElement>('.lv8-setup__option').forEach(btn => {
  btn.addEventListener('click', () => {
    controlScheme = btn.dataset.value as ControlScheme;
    syncOptionButtons(controlOptionsEl, controlScheme);
  });
});
controlsNextBtn.addEventListener('click', () => showSetupStep('viewpoint'));

viewpointOptionsEl.querySelectorAll<HTMLButtonElement>('.lv8-setup__option').forEach(btn => {
  btn.addEventListener('click', () => {
    viewpoint = btn.dataset.value as Viewpoint;
    syncOptionButtons(viewpointOptionsEl, viewpoint);
  });
});

setupSettingsBtn.addEventListener('click', () => openSettings('setup'));
setupPlayBtn.addEventListener('click', () => {
  void launchGame();
});

// ---------------------------------------------------------------
// Settings panel — shared between the setup wizard (pre-game) and the
// in-game pause menu (mid-session). Changes apply live to an active game
// immediately, satisfying "changeable mid-session" without needing a
// separate code path for each caller.
// ---------------------------------------------------------------
function renderSettingsPanel() {
  sensitivityInput.value = String(sensitivity);
  syncOptionButtons(settingsControlOptionsEl, controlScheme);
  syncOptionButtons(settingsViewpointOptionsEl, viewpoint);
  for (const btn of remapBtns) {
    const dir = btn.dataset.dir as keyof KeyBindings;
    btn.textContent = `${DIR_LABELS[dir]}: ${keyBindings[dir].toUpperCase()}`;
    btn.classList.toggle('is-listening', listeningForKey === dir);
  }
}

function openSettings(returnTo: 'setup' | 'pause') {
  settingsReturnTo = returnTo;
  renderSettingsPanel();
  settingsEl.classList.add('is-active');
  settingsEl.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  listeningForKey = null;
  settingsEl.classList.remove('is-active');
  settingsEl.setAttribute('aria-hidden', 'true');
  if (settingsReturnTo === 'pause') {
    pauseEl.classList.add('is-active');
    pauseEl.setAttribute('aria-hidden', 'false');
  }
}

sensitivityInput.addEventListener('input', () => {
  sensitivity = parseFloat(sensitivityInput.value) || 1;
  activeGame?.setSettings({ sensitivity });
});

settingsControlOptionsEl.querySelectorAll<HTMLButtonElement>('.lv8-setup__option').forEach(btn => {
  btn.addEventListener('click', () => {
    controlScheme = btn.dataset.value as ControlScheme;
    syncOptionButtons(settingsControlOptionsEl, controlScheme);
    syncOptionButtons(controlOptionsEl, controlScheme);
    activeGame?.setSettings({ controlScheme });
  });
});
settingsViewpointOptionsEl.querySelectorAll<HTMLButtonElement>('.lv8-setup__option').forEach(btn => {
  btn.addEventListener('click', () => {
    viewpoint = btn.dataset.value as Viewpoint;
    syncOptionButtons(settingsViewpointOptionsEl, viewpoint);
    syncOptionButtons(viewpointOptionsEl, viewpoint);
    activeGame?.setViewpoint(viewpoint);
  });
});

for (const btn of remapBtns) {
  btn.addEventListener('click', () => {
    listeningForKey = btn.dataset.dir as keyof KeyBindings;
    renderSettingsPanel();
  });
}
// captured on the panel itself while it's open — a single listener that
// only does anything while a remap button is actively "listening"
settingsEl.addEventListener('keydown', e => {
  if (!listeningForKey) return;
  e.preventDefault();
  if (e.key === 'Escape') {
    listeningForKey = null;
    renderSettingsPanel();
    return;
  }
  keyBindings = { ...keyBindings, [listeningForKey]: e.key.toLowerCase() };
  listeningForKey = null;
  renderSettingsPanel();
  activeGame?.setSettings({ keyBindings });
});

settingsCloseBtn.addEventListener('click', closeSettings);

// ---------------------------------------------------------------
// Pause menu
// ---------------------------------------------------------------
function openPause() {
  if (!activeGame) return;
  activeGame.pause();
  pauseEl.classList.add('is-active');
  pauseEl.setAttribute('aria-hidden', 'false');
}
function closePause() {
  pauseEl.classList.remove('is-active');
  pauseEl.setAttribute('aria-hidden', 'true');
  activeGame?.resume();
}

pauseBtn.addEventListener('click', openPause);
pauseResumeBtn.addEventListener('click', closePause);
pauseSettingsBtn.addEventListener('click', () => {
  pauseEl.classList.remove('is-active');
  openSettings('pause');
});
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !activeGame) return;
  if (pauseEl.classList.contains('is-active')) closePause();
  else if (
    !settingsEl.classList.contains('is-active') &&
    !gameOverEl.classList.contains('is-active') &&
    !portalEl.classList.contains('is-active')
  )
    openPause();
});

// ---------------------------------------------------------------
// Launch / exit
// ---------------------------------------------------------------
async function launchGame() {
  if (loadingGame || activeGame || !DESKTOP_MQ.matches) return;
  loadingGame = true;
  setupPlayBtn.disabled = true;

  const { WormholeGame } = await import('./game');

  showGame();
  scoreEl.textContent = '0';
  speedEl.textContent = '0';
  renderLives(3);
  renderHealth(HEALTH_MAX);
  renderLevel(1);

  const callbacks: WormholeGameCallbacks = {
    onScoreChange: score => {
      scoreEl.textContent = String(score);
    },
    onLivesChange: lives => {
      renderLives(lives);
    },
    onHealthChange: health => {
      renderHealth(health);
    },
    onLevelChange: level => {
      renderLevel(level);
    },
    onGameOver: (finalScore, level) => {
      if (gameOverKickerEl) gameOverKickerEl.textContent = `RUN TERMINATED, ${playerName} — LEVEL ${level}`;
      gameOverScoreEl.textContent = String(finalScore);
      gameOverQuipEl.textContent = randomQuip();
      gameOverEl.classList.add('is-active');
      gameOverEl.setAttribute('aria-hidden', 'false');
    },
    onHit: () => {
      flashEl.classList.remove('is-hit');
      void (flashEl as HTMLElement).offsetWidth; // restart the CSS animation
      flashEl.classList.add('is-hit');
    },
    onCrash: () => {
      flashEl.classList.remove('is-crash');
      void (flashEl as HTMLElement).offsetWidth;
      flashEl.classList.add('is-crash');
    },
    onBonus: kind => {
      showBonusToast(kind);
    },
    onPortal: () => {
      // game.ts has already paused itself before firing this — just show
      // the scripted checkpoint and hand control back to "Ready"
      portalEl.classList.add('is-active');
      portalEl.setAttribute('aria-hidden', 'false');
    },
    onMilestone: (level, bonus) => {
      showMilestoneToast(level, bonus);
    },
    onSpeedChange: speed => {
      speedEl.textContent = String(speed);
    },
  };

  activeGame = new WormholeGame(canvasWrap, callbacks, { viewpoint, settings: currentSettings() });
  activeGame.start();
  loadingGame = false;
  setupPlayBtn.disabled = false;
  applyDesktopGate();
}

function exitToHub() {
  if (activeGame) {
    activeGame.dispose();
    activeGame = null;
  }
  showHub();
}

playBtn?.addEventListener('click', openSetup);
exitBtn?.addEventListener('click', exitToHub);
gameOverExitBtn?.addEventListener('click', exitToHub);
pauseExitBtn?.addEventListener('click', () => {
  pauseEl.classList.remove('is-active');
  exitToHub();
});
restartBtn?.addEventListener('click', () => {
  gameOverEl.classList.remove('is-active');
  gameOverEl.setAttribute('aria-hidden', 'true');
  activeGame?.restart();
});
portalReadyBtn?.addEventListener('click', () => {
  portalEl.classList.remove('is-active');
  portalEl.setAttribute('aria-hidden', 'true');
  activeGame?.resume();
});

// leaving the desktop breakpoint mid-game (e.g. devtools resize) shouldn't
// strand the player in a control scheme that no longer makes sense
DESKTOP_MQ.addEventListener('change', e => {
  if (!e.matches && activeGame) exitToHub();
});
