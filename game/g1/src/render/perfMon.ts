// Performance instrumentation (brief §4 MEASUREMENT). Allocation-free per
// frame: section times (sim, renderSubmit, hud, audio) and frame deltas go
// into fixed typed rings; renderer.info + heap are sampled once a second;
// long tasks come from a PerformanceObserver. `perf.table()` reports the
// brief's columns for the window since `perf.reset(label)`.
// performance.mark/measure create an entry object per call (GC per frame),
// so they are only emitted with ?trace=1 (DevTools timelines).
import type { WebGLRenderer } from 'three';
import { QUERY } from '../core/constants';
import { registerDebug, debugEnabled } from '../debug/debugApi';

export type Section = 'sim' | 'render' | 'hud' | 'audio';
const SECTIONS: Section[] = ['sim', 'render', 'hud', 'audio'];
const RING = 1200; // 20 s at 60 fps
const TRACE = QUERY.get('trace') === '1';
/** ?debug=1&stats=1: the stats-gl overlay (CPU + GPU timer panels), lazy-loaded */
const OVERLAY = QUERY.get('stats') === '1';

type Overlay = { begin(): void; end(): void; update(): void; dom: HTMLElement };

class Ring {
  readonly v = new Float32Array(RING);
  n = 0;
  head = 0;
  push(x: number): void {
    this.v[this.head] = x;
    this.head = (this.head + 1) % RING;
    if (this.n < RING) this.n++;
  }
  clear(): void {
    this.n = 0;
    this.head = 0;
  }
}

const scratch = new Float32Array(RING);
function stats(r: Ring): { avg: number; p95: number; p99: number; max: number } {
  if (!r.n) return { avg: 0, p95: 0, p99: 0, max: 0 };
  let sum = 0;
  for (let i = 0; i < r.n; i++) {
    scratch[i] = r.v[i];
    sum += r.v[i];
  }
  const s = scratch.subarray(0, r.n);
  s.sort();
  return { avg: sum / r.n, p95: s[Math.floor(r.n * 0.95)], p99: s[Math.floor(r.n * 0.99)], max: s[r.n - 1] };
}

type Info = { drawCalls: number; triangles: number; programs: number; geometries: number; textures: number };

class PerfMonImpl {
  private frame = new Ring();
  private sec: Record<Section, Ring> = { sim: new Ring(), render: new Ring(), hud: new Ring(), audio: new Ring() };
  private t0: Record<Section, number> = { sim: 0, render: 0, hud: 0, audio: 0 };
  private acc: Record<Section, number> = { sim: 0, render: 0, hud: 0, audio: 0 };
  private longTasks: number[] = [];
  private label = 'session';
  private windowStart = 0;
  private heapStart = 0;
  private gl: WebGLRenderer | null = null;
  private infoMax: Info = { drawCalls: 0, triangles: 0, programs: 0, geometries: 0, textures: 0 };
  private infoNow: Info = { drawCalls: 0, triangles: 0, programs: 0, geometries: 0, textures: 0 };
  private lastSample = 0;
  private observer: PerformanceObserver | null = null;
  private overlay: Overlay | null = null;
  /** frame cadence from rAF timestamps (frame START, vsync-aligned). Timing at
   *  the end of each frame folded the varying render cost into every delta
   *  (p95 19-24 ms at a steady 60 fps). */
  frameMs = 16.7;
  private rafLast = 0;
  private rafOn = false;
  private readonly onRaf = (t: number): void => {
    if (this.rafLast) {
      this.frameMs = t - this.rafLast;
      if (this.frameMs < 1000) this.frame.push(this.frameMs);
    }
    this.rafLast = t;
    requestAnimationFrame(this.onRaf);
  };

  install(gl: WebGLRenderer): void {
    this.gl = gl;
    if (!this.observer && typeof PerformanceObserver !== 'undefined') {
      try {
        this.observer = new PerformanceObserver(list => {
          for (const e of list.getEntries()) if (e.startTime >= this.windowStart) this.longTasks.push(Math.round(e.duration));
        });
        this.observer.observe({ type: 'longtask', buffered: false });
      } catch {
        this.observer = null; // longtask unsupported (Firefox / Safari)
      }
    }
    registerDebug('perf', {
      table: () => this.table(),
      reset: (label: string) => this.reset(label),
    });
    if (OVERLAY && debugEnabled) void this.attachOverlay(gl);
    if (!this.rafOn) {
      this.rafOn = true;
      requestAnimationFrame(this.onRaf);
    }
  }

  private async attachOverlay(gl: WebGLRenderer): Promise<void> {
    try {
      const { default: Stats } = await import('stats-gl');
      const st = new Stats({ trackGPU: true, horizontal: true, logsPerSecond: 4, graphsPerSecond: 30 });
      await st.init(gl.getContext());
      Object.assign(st.dom.style, { position: 'fixed', left: '8px', top: '96px', bottom: 'auto', zIndex: '90' });
      document.body.appendChild(st.dom);
      this.overlay = st as unknown as Overlay;
    } catch (err) {
      console.error('[perf] stats-gl overlay failed', err);
    }
  }

  begin(s: Section): void {
    if (s === 'render') this.overlay?.begin();
    this.t0[s] = performance.now();
    if (TRACE) performance.mark(`${s}:b`);
  }

  end(s: Section): void {
    this.acc[s] += performance.now() - this.t0[s];
    if (s === 'render') this.overlay?.end();
    if (TRACE) performance.measure(s, `${s}:b`);
  }

  /** once per rendered frame (after submit) */
  frameEnd(): void {
    this.overlay?.update();
    const now = performance.now();
    for (let i = 0; i < SECTIONS.length; i++) {
      const s = SECTIONS[i];
      this.sec[s].push(this.acc[s]);
      this.acc[s] = 0;
    }
    if (now - this.lastSample > 1000 && this.gl) {
      this.lastSample = now;
      const inf = this.gl.info;
      const n = this.infoNow;
      n.drawCalls = inf.render.calls;
      n.triangles = inf.render.triangles;
      n.programs = inf.programs?.length ?? 0;
      n.geometries = inf.memory.geometries;
      n.textures = inf.memory.textures;
      const m = this.infoMax;
      if (n.drawCalls > m.drawCalls) m.drawCalls = n.drawCalls;
      if (n.triangles > m.triangles) m.triangles = n.triangles;
      m.programs = n.programs;
      m.geometries = n.geometries;
      m.textures = n.textures;
    }
  }

  /** start a new measurement window (scenario label) */
  reset(label: string): void {
    this.label = label;
    this.frame.clear();
    for (const s of SECTIONS) this.sec[s].clear();
    this.longTasks = [];
    this.windowStart = performance.now();
    this.heapStart = heapMB();
    this.infoMax = { drawCalls: 0, triangles: 0, programs: 0, geometries: 0, textures: 0 };
  }

  table() {
    const f = stats(this.frame);
    const sec = Object.fromEntries(SECTIONS.map(s => [s, round(stats(this.sec[s]))])) as Record<Section, ReturnType<typeof stats>>;
    return {
      scenario: this.label,
      seconds: +((performance.now() - this.windowStart) / 1000).toFixed(1),
      frames: this.frame.n,
      avgFps: f.avg ? +(1000 / f.avg).toFixed(1) : 0,
      p95: +f.p95.toFixed(1),
      p99: +f.p99.toFixed(1),
      maxFrame: +f.max.toFixed(1),
      longTasks: this.longTasks.slice(),
      sections: sec,
      ...this.infoMax,
      heapMB: heapMB(),
      heapDeltaMB: +(heapMB() - this.heapStart).toFixed(1),
    };
  }
}

function heapMB(): number {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return m ? +(m.usedJSHeapSize / 1048576).toFixed(1) : 0;
}

function round(o: { avg: number; p95: number; p99: number; max: number }) {
  return { avg: +o.avg.toFixed(2), p95: +o.p95.toFixed(2), p99: +o.p99.toFixed(2), max: +o.max.toFixed(2) };
}

export const perfMon = new PerfMonImpl();
