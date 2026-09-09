import { createRoot } from 'react-dom/client';
import RippleDistortion from './RippleDistortion';
import watermarkSource from './watermark-source.jpg';
import './lab.css';

// Freshness beacon — if you don't see this exact line in the console, your
// browser is running a cached/old bundle (the real cause of "nothing changed").
const LAB_BUILD = 'lab/lv1 build 2026-09-08-align4';
console.log(`%c${LAB_BUILD}`, 'color:#8fb8ea;font-weight:600');

// A stray service worker on localhost:5173 (from any earlier project) would
// serve a stale cached page at the bare URL while ?query variants load fresh —
// exactly the "?debug is fine, plain is not" symptom. Clear it.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length) {
      regs.forEach(r => r.unregister());
      console.warn(`[lab/lv1] unregistered ${regs.length} service worker(s) — reload once more for a clean load`);
    }
  });
  if (window.caches && caches.keys) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}

/* --------------------------------------------------------------------------
   Behaviour carried over verbatim from the homepage's script.js — smooth
   in-page scrolling and the no-op sign-up form.

   The old dashed-outline watermark cursor effect is NOT carried over:
   this page never loads script.js, its watermark SVG has no stroke/spot
   layers, and nothing here adds a pointer listener for it. RippleDistortion
   (below) is the only cursor interaction on the watermark now.
   -------------------------------------------------------------------------- */
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href') || '';
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const form = document.querySelector<HTMLFormElement>('.signup__form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector<HTMLInputElement>('.signup__input');
    if (input && input.value.trim()) {
      input.value = '';
      input.setAttribute('placeholder', "Thanks — I'll be in touch.");
      setTimeout(() => input.setAttribute('placeholder', 'Enter your email'), 2600);
    }
  });
}

/* --------------------------------------------------------------------------
   Pixel-align the ripple layer to the LIVE watermark SVG.

   The SVG is  viewBox="0 0 1920 400"  preserveAspectRatio="xMidYMax meet",
   so its rendered content box is  (1920s x 400s)  where s = min(cw/1920,
   ch/400), centred horizontally and bottom-aligned inside .watermark.

   The ripple source texture is a capture of exactly that 1920x400 content
   box (aspect 4.8). Sizing #ripple-root / #ripple-fade to the same box means
   the component's "cover" fit becomes a 1:1 map — the rippled letters land
   exactly on top of where the real letters are, at any viewport size.
   -------------------------------------------------------------------------- */
const VB_W = 1920;
const VB_H = 400;
const watermark = document.querySelector<HTMLElement>('.watermark');

function layoutRippleLayer() {
  if (!watermark) return;
  const cw = watermark.clientWidth;
  const ch = watermark.clientHeight;
  if (!cw || !ch) return;
  const s = Math.min(cw / VB_W, ch / VB_H);
  const w = VB_W * s;
  const h = VB_H * s;
  const left = (cw - w) / 2;
  for (const id of ['ripple-root', 'ripple-fade']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.left = `${left}px`;
    el.style.right = 'auto';
    el.style.bottom = '0';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }
}

layoutRippleLayer();
window.addEventListener('resize', layoutRippleLayer);
// re-run after fonts / layout settle (textLength metrics can shift on font swap)
requestAnimationFrame(() => requestAnimationFrame(layoutRippleLayer));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutRippleLayer);

/* --------------------------------------------------------------------------
   Manual horizontal alignment nudge.

   The ripple layer measures pixel-aligned to the live SVG here, but if it
   reads shifted on your display: hover the wordmark and tap  [  to move the
   effect LEFT (2px/step),  ]  to move it right. The value is logged and
   remembered (localStorage). It can also be forced via ?rx=-18 in the URL.
   Whatever value lines it up for you becomes the permanent default.
   -------------------------------------------------------------------------- */
const NUDGE_KEY = 'labRippleNudgeX';
const urlNudge = new URLSearchParams(location.search).get('rx');
let nudgeX =
  urlNudge != null
    ? parseFloat(urlNudge) || 0
    : parseFloat(localStorage.getItem(NUDGE_KEY) || '0') || 0;

function applyNudge() {
  for (const id of ['ripple-root', 'ripple-fade']) {
    document.getElementById(id)?.style.setProperty('--ripple-nudge-x', `${nudgeX}px`);
  }
}
applyNudge();

window.addEventListener('keydown', e => {
  if (e.key === '[' || e.key === ']') {
    nudgeX += e.key === '[' ? -2 : 2;
    try {
      localStorage.setItem(NUDGE_KEY, String(nudgeX));
    } catch {
      /* ignore */
    }
    applyNudge();
    console.log(`[lab/lv1] ripple nudge X = ${nudgeX}px  (tell this number to bake it in)`);
  }
});

/* ?debug — overlay the real SVG wordmark at 50% ON TOP of the ripple canvas.
   Aligned  -> you see one crisp wordmark, just a touch brighter.
   Offset   -> you see a clear double-image / edge doubling.
   No blend modes or filters, so there's no bloom to misread. */
if (new URLSearchParams(location.search).has('debug')) {
  const wm = document.querySelector<HTMLElement>('.watermark');
  if (wm) {
    const ghost = wm.cloneNode(true) as HTMLElement;
    ghost.setAttribute('data-debug-ghost', '');
    ghost.removeAttribute('id');
    ghost.style.cssText =
      `position:absolute;left:0;right:0;bottom:0;height:${wm.clientHeight}px;` +
      'z-index:20;pointer-events:none;opacity:.5;';
    wm.parentElement?.appendChild(ghost);
    console.log(
      '[lab/lv1] ?debug on — real SVG wordmark overlaid at 50%. ' +
        'One crisp wordmark = aligned. Double-image = offset.'
    );
  }
}

/* --------------------------------------------------------------------------
   RippleDistortion, scoped to the bottom "Manik Rana" / deep-sea section.
   src = a pre-render of that same band (fog + ocean + metal wordmark), so
   the cursor visibly disturbs that content like water.
   -------------------------------------------------------------------------- */
const mount = document.getElementById('ripple-root');
if (mount) {
  try {
    createRoot(mount).render(
      <RippleDistortion
        src={watermarkSource}
        trigger="hover"
        grayscale
        enabled
        quality="high"
        brushSize={185}
        strength={0.115}
        swirl={0.7}
        rings={3}
        spread={5}
        fade={2.6}
        spacing={13}
        dispersion={0.022}
        glint={0.08}
        tint="#8fb8ea"
        tintAmount={0.06}
        highlightColor="#e2efff"
        style={{ pointerEvents: 'none' }}
      />
    );
  } catch (err) {
    // If React itself fails, leave the fallback SVG wordmark visible.
    console.error('[lab/lv1] RippleDistortion failed to mount:', err);
    mount.style.display = 'none';
  }

  // Sanity check: if no <canvas> appeared (WebGL blocked/unavailable in this
  // browser), say so out loud instead of silently showing the plain wordmark.
  setTimeout(() => {
    if (!mount.querySelector('canvas')) {
      console.warn(
        '[lab/lv1] RippleDistortion did not mount a <canvas> — WebGL is ' +
          'likely disabled or blocked in this browser. Enable hardware ' +
          'acceleration / WebGL, or check for a canvas-blocking extension.'
      );
      const note = document.createElement('div');
      note.textContent = 'ripple effect needs WebGL — not available in this browser';
      note.style.cssText =
        'position:fixed;left:12px;bottom:12px;z-index:99;font:600 11px/1 system-ui;' +
        'letter-spacing:.06em;text-transform:uppercase;color:#9fb3c9;' +
        'background:rgba(6,13,26,.8);border:1px solid #33507a;border-radius:6px;padding:8px 10px';
      document.body.appendChild(note);
    }
  }, 2500);
}
