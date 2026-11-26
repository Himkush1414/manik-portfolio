// The tube-light start-up schedule for the intro grid. Pure and seeded, so the
// same seed always gives the same sequence (reproducible in QA screenshots).
//
// Per cell: a hard "on" at its start time, then 2–4 irregular off/on pulses of
// 40–120 ms, then it locks on. Starts are spread over ~1.65 s in a shuffled
// order, so 3–5 cells are buzzing at any moment and the screen never changes
// all at once. A few early cells drop out once more and relight (second pass),
// and one bottom-row cell shows the accent colour for two frames.

export const COVER = 0; // black cover over the cell
export const LIT = 1; // cover removed: real page shows through
export const ACCENT = 2; // cover shows the accent colour

export type CellState = typeof COVER | typeof LIT | typeof ACCENT;
export type Track = { t: number; s: CellState }[];

export const BLACK_HOLD = 350;
const LAST_START = 2000;
const LOCK_DEADLINE = 2420;
const SECOND_PASS_DEADLINE = 2660;

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSchedule(cols: number, rows: number, seed = 20261126) {
  const random = rng(seed);
  const between = (a: number, b: number) => a + random() * (b - a);
  const n = cols * rows;

  // shuffled lighting order (Fisher–Yates), so neighbours don't light in sequence
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // the accent flash goes to a bottom-row cell that lights in the middle of the run
  const bottomRow = order.filter(c => Math.floor(c / cols) === rows - 1);
  const accentCell = bottomRow[Math.min(1, bottomRow.length - 1)];

  const tracks: Track[] = Array.from({ length: n }, () => []);
  const lockAt: number[] = new Array(n).fill(0);

  order.forEach((cell, rank) => {
    const spread = n > 1 ? (rank / (n - 1)) * (LAST_START - BLACK_HOLD) : 0;
    const start = Math.max(BLACK_HOLD, BLACK_HOLD + spread + between(-60, 60));
    // later cells get fewer pulses so everything locks on time
    let pulses = rank >= n * 0.75 ? 2 : 2 + Math.floor(random() * 3);
    // [on, off] durations per pulse; the accent pulse is two frames long
    const steps: [number, number][] = [];
    for (let p = 0; p < pulses; p++) {
      steps.push([cell === accentCell && p === 1 ? 34 : between(40, 120), between(40, 120)]);
    }
    const total = () => steps.reduce((sum, [a, b]) => sum + a + b, 0);
    while (start + total() > LOCK_DEADLINE && pulses > 1) {
      steps.pop();
      pulses--;
    }
    const over = start + total() - LOCK_DEADLINE;
    const squeeze = over > 0 ? Math.max(0.4, 1 - over / total()) : 1;

    const track = tracks[cell];
    let t = start;
    steps.forEach(([on, off], p) => {
      track.push({ t, s: cell === accentCell && p === 1 ? ACCENT : LIT });
      t += on * squeeze;
      track.push({ t, s: COVER });
      t += off * squeeze;
    });
    track.push({ t, s: LIT });
    lockAt[cell] = t;
  });

  // second pass: a few cells that locked early drop out and relight
  const early = order.filter(c => lockAt[c] < 1900);
  const relights = Math.max(2, Math.round(n * 0.25));
  for (let k = 0; k < relights && k < early.length; k++) {
    const cell = early[Math.floor((k / relights) * early.length)];
    let t = Math.max(lockAt[cell] + between(140, 320), 1850 + between(0, 450));
    const seq: Track = [];
    seq.push({ t, s: COVER });
    t += between(60, 140);
    seq.push({ t, s: LIT });
    t += between(40, 80);
    seq.push({ t, s: COVER });
    t += between(40, 90);
    seq.push({ t, s: LIT });
    if (t <= SECOND_PASS_DEADLINE) tracks[cell].push(...seq);
  }

  const end = Math.max(...tracks.map(tr => tr[tr.length - 1].t)) + 60;
  return { tracks, end };
}
