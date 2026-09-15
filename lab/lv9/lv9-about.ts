// /lab/lv9 — the light-theme About section below page 2 (see chat
// reply). Only behaviour it needs beyond plain CSS: the circular dial's
// ring of tick marks (generated once) and a real, continuously-updating
// clock for India/Kolkata (matching the "Himachal Pradesh, India" label
// beside the marker above it) — 12-hour with AM/PM, same default as
// lv8's own (dark-theme) version of this clock. The skills marquee is
// pure CSS (see lv9.css), nothing to wire here.
//
// Dynamically imported from main.ts's Move Next handler, alongside
// page2.ts — no reason to run this before the section is even visible.

let clockTimer: number | undefined;
let started = false;

export function startAbout() {
  if (started) return;
  started = true;
  buildDialTicks();
  updateClock();
  clockTimer = window.setInterval(updateClock, 1000);
}

export function stopAbout() {
  started = false;
  window.clearInterval(clockTimer);
}

const DIAL_TICK_COUNT = 48; // evenly spaced radial ticks around the 200x200 dial
const DIAL_SIZE = 200;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_OUTER_R = 96;
const DIAL_INNER_R = 84;

function buildDialTicks() {
  const svg = document.getElementById('lv9-about-ticks');
  if (!svg) return;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < DIAL_TICK_COUNT; i++) {
    const angle = (i / DIAL_TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
    const x1 = DIAL_CENTER + DIAL_INNER_R * Math.cos(angle);
    const y1 = DIAL_CENTER + DIAL_INNER_R * Math.sin(angle);
    const x2 = DIAL_CENTER + DIAL_OUTER_R * Math.cos(angle);
    const y2 = DIAL_CENTER + DIAL_OUTER_R * Math.sin(angle);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
    frag.appendChild(line);
  }
  svg.appendChild(frag);
}

function updateClock() {
  const timeEl = document.getElementById('lv9-about-clock');
  const meridiemEl = document.getElementById('lv9-about-meridiem');
  if (!timeEl || !meridiemEl) return;

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  timeEl.textContent = `${get('hour')}:${get('minute')}`;
  meridiemEl.textContent = get('dayPeriod').toUpperCase();
}
