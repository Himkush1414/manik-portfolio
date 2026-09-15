// / (the main site) — the "Skill & Fun" section's light-theme About
// block, ported unchanged (apart from file renames) from /lab/lv9's own
// copy. Behaviour it needs beyond plain CSS: the circular dial's ring of
// tick marks (generated once), a real, continuously-updating clock for
// India/Kolkata (matching the "Himachal Pradesh, India" label beside the
// marker above it) — 12-hour with AM/PM — and the icon-only skills
// marquee (see skillsfun-skill-icons.ts), built here rather than
// hand-duplicated as raw SVG markup in index.html.
//
// Dynamically imported from skillsfun.ts's Move Next handler, alongside
// skillsfun-page2.ts — no reason to run this before the section is even
// visible.
import { skillOrder, skillIconPaths, skillIconViewBox, customSkillIconMarkup } from './skillsfun-skill-icons';

let clockTimer: number | undefined;
let started = false;

export function startAbout() {
  if (started) return;
  started = true;
  buildDialTicks();
  updateClock();
  clockTimer = window.setInterval(updateClock, 1000);
  buildMarquee();
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
  const svg = document.getElementById('skillsfun-about-ticks');
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
  const timeEl = document.getElementById('skillsfun-about-clock');
  const meridiemEl = document.getElementById('skillsfun-about-meridiem');
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

function iconMarkup(name: string): string {
  const custom = customSkillIconMarkup[name];
  if (custom) return custom;
  return `<path fill="currentColor" d="${skillIconPaths[name]}"/>`;
}

function buildMarquee() {
  const lists = document.querySelectorAll('.skillsfun-about__marquee-list');
  if (!lists.length) return;

  const itemsHtml = skillOrder
    .map(name => `<li title="${name}"><svg viewBox="${skillIconViewBox}" aria-hidden="true">${iconMarkup(name)}</svg></li>`)
    .join('');

  lists.forEach(list => { list.innerHTML = itemsHtml; });
}
