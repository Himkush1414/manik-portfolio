// /lab/lv8 — hub bootstrap. Deliberately light: the only heavy import
// (three.js, via ./game) is dynamic, inside the "PLAY" click handler
// below, so it never loads just from visiting this page, let alone any
// other route on the site.
import { setHubActive } from './lv8-cursor-trail';
import type { WormholeGame as WormholeGameType, WormholeGameCallbacks } from './game';

// Freshness beacon, matching the convention every other route on this site uses.
console.log('%clab/lv8 build 2026-09-14 (Games Lab)', 'color:#4CE0E8;font-weight:600;background:#06060C;padding:2px 6px');

const backBtn = document.getElementById('lv8-nav-back');
backBtn?.addEventListener('click', () => {
  if (window.history.length > 1) window.history.back();
  else window.location.href = '/';
});

// ---------------------------------------------------------------
// Desktop-only gate for the game itself. WASD + Space has no sane touch
// equivalent to improvise here without shipping a half-working control
// scheme (flagged back explicitly, see the chat reply) — the hub/Bento
// section itself still renders and reads fine on a narrow/touch viewport,
// only the flagship tile's PLAY action is disabled there.
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
// Hub <-> game switch
// ---------------------------------------------------------------
const hub = document.getElementById('lv8-hub') as HTMLElement;
const overlay = document.getElementById('lv8-game-overlay') as HTMLElement;
const canvasWrap = document.getElementById('lv8-game-canvas-wrap') as HTMLElement;
const hud = document.getElementById('lv8-hud') as HTMLElement;
const scoreEl = document.getElementById('lv8-hud-score') as HTMLElement;
const livesEl = document.getElementById('lv8-hud-lives') as HTMLElement;
const flashEl = document.getElementById('lv8-flash') as HTMLElement;
const gameOverEl = document.getElementById('lv8-gameover') as HTMLElement;
const gameOverScoreEl = document.getElementById('lv8-gameover-score') as HTMLElement;
const exitBtn = document.getElementById('lv8-game-exit') as HTMLButtonElement;
const restartBtn = document.getElementById('lv8-restart-btn') as HTMLButtonElement;
const gameOverExitBtn = document.getElementById('lv8-gameover-exit') as HTMLButtonElement;

let activeGame: WormholeGameType | null = null;
let loadingGame = false;

function renderLives(lives: number) {
  livesEl.textContent = '●'.repeat(Math.max(lives, 0)) + '○'.repeat(Math.max(3 - lives, 0));
}

function showHub() {
  overlay.classList.remove('is-active');
  overlay.setAttribute('aria-hidden', 'true');
  hud.setAttribute('aria-hidden', 'true');
  gameOverEl.classList.remove('is-active');
  gameOverEl.setAttribute('aria-hidden', 'true');
  hub.hidden = false;
  setHubActive(true);
}

function showGame() {
  hub.hidden = true;
  setHubActive(false);
  overlay.classList.add('is-active');
  overlay.setAttribute('aria-hidden', 'false');
  hud.setAttribute('aria-hidden', 'false');
}

async function launchGame() {
  if (loadingGame || activeGame || !DESKTOP_MQ.matches) return;
  loadingGame = true;
  playBtn!.disabled = true;

  const { WormholeGame } = await import('./game');

  showGame();
  scoreEl.textContent = '0';
  renderLives(3);

  const callbacks: WormholeGameCallbacks = {
    onScoreChange: score => {
      scoreEl.textContent = String(score);
    },
    onLivesChange: lives => {
      renderLives(lives);
    },
    onGameOver: finalScore => {
      gameOverScoreEl.textContent = String(finalScore);
      gameOverEl.classList.add('is-active');
      gameOverEl.setAttribute('aria-hidden', 'false');
    },
    onHit: () => {
      flashEl.classList.remove('is-hit');
      void (flashEl as HTMLElement).offsetWidth; // restart the CSS animation
      flashEl.classList.add('is-hit');
    },
  };

  activeGame = new WormholeGame(canvasWrap, callbacks);
  activeGame.start();
  loadingGame = false;
  applyDesktopGate();
}

function exitToHub() {
  if (activeGame) {
    activeGame.dispose();
    activeGame = null;
  }
  showHub();
}

playBtn?.addEventListener('click', launchGame);
exitBtn?.addEventListener('click', exitToHub);
gameOverExitBtn?.addEventListener('click', exitToHub);
restartBtn?.addEventListener('click', () => {
  gameOverEl.classList.remove('is-active');
  gameOverEl.setAttribute('aria-hidden', 'true');
  activeGame?.restart();
});

// leaving the desktop breakpoint mid-game (e.g. devtools resize) shouldn't
// strand the player in a control scheme that no longer makes sense
DESKTOP_MQ.addEventListener('change', e => {
  if (!e.matches && activeGame) exitToHub();
});
