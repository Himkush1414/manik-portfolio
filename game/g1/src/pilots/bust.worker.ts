// Pilot busts off the main thread: owns the OffscreenCanvas transferred from
// PilotBusts.tsx and runs the bust renderer at ~30 fps.
import { createBustRenderer, type BustRenderer, type BustState } from './bustRenderer';

type Msg = { type: 'init'; canvas: OffscreenCanvas; state: BustState } | { type: 'update'; state: Partial<BustState> } | { type: 'tris' } | { type: 'dispose' };

let r: BustRenderer | null = null;
let last = 0;
let running = false;

const raf: (cb: (t: number) => void) => void =
  typeof self.requestAnimationFrame === 'function' ? cb => self.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);

function loop(now: number) {
  if (!running || !r) return;
  r.frame(last ? now - last : 16);
  last = now;
  raf(loop);
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type === 'init') {
    r = createBustRenderer(m.canvas, m.state);
    running = true;
    void r.ready.then(() => self.postMessage({ type: 'ready', tris: r?.tris() }));
    raf(loop);
  } else if (m.type === 'update') r?.update(m.state);
  else if (m.type === 'tris') self.postMessage({ type: 'tris', tris: r?.tris() });
  else if (m.type === 'dispose') {
    running = false;
    r?.dispose();
    r = null;
  }
};
