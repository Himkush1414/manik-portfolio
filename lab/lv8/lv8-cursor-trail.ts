// /lab/lv8 — decorative cursor comet trail: a handful of soft glowing
// particles emitted along the cursor's recent path, drifting and fading
// out. A new, genre-appropriate treatment for this tab (not a reuse of
// lv7's row-hover/cursor-follow-box mechanic) — glow via additive-blended
// radial gradients drawn straight on canvas, no blur filters, no DOM
// nodes per particle, so this stays cheap regardless of how long the hub
// sits idle.
//
// Confined to the hub: main.ts flips `hubActive` to false the instant the
// game overlay takes over, which stops this from emitting or drawing at
// all — the game has its own input/visual language and shouldn't have hub
// chrome layered over it. Flipping back to true (returning from a run)
// starts clean since the particle pool just resumes from empty.
const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const canvas = document.getElementById('lv8-cursor-trail') as HTMLCanvasElement | null;

let hubActive = true;
// called from main.ts the instant the game overlay takes over (and again
// on return to the hub) — see the file header for why this needs to exist.
export function setHubActive(v: boolean) {
  hubActive = v;
}

if (canvas && !coarsePointer) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const MAX_PARTICLES = 40;
    const EMIT_PER_FRAME = 2; // while the cursor is actively moving
    const LIFE_MS = 650;
    const VIOLET_CHANCE = 0.16; // secondary accent, used sparingly — see palette

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let lastMouseX = mouseX;
    let lastMouseY = mouseY;
    let moved = false;

    window.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      moved = true;
    });

    type Particle = {
      active: boolean;
      x: number;
      y: number;
      vx: number;
      vy: number;
      born: number;
      violet: boolean;
      size: number;
    };
    const pool: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      born: 0,
      violet: false,
      size: 0,
    }));
    let cursor = 0; // ring-buffer write head — oldest slot is always reused next

    function spawn(x: number, y: number, dirX: number, dirY: number, now: number) {
      const p = pool[cursor];
      cursor = (cursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 4;
      p.y = y + (Math.random() - 0.5) * 4;
      // a little inherited drift from the cursor's own movement, plus a
      // gentle upward bias so the tail reads as "comet," not just noise
      p.vx = dirX * 0.06 + (Math.random() - 0.5) * 14;
      p.vy = dirY * 0.06 + (Math.random() - 0.5) * 14 - 6;
      p.born = now;
      p.violet = Math.random() < VIOLET_CHANCE;
      p.size = 2.2 + Math.random() * 2.4;
    }

    function frame(now: number) {
      requestAnimationFrame(frame);
      ctx!.clearRect(0, 0, canvas!.width / dpr, canvas!.height / dpr);
      if (!hubActive) return;

      if (moved) {
        const dx = mouseX - lastMouseX;
        const dy = mouseY - lastMouseY;
        for (let i = 0; i < EMIT_PER_FRAME; i++) spawn(mouseX, mouseY, dx, dy, now);
        lastMouseX = mouseX;
        lastMouseY = mouseY;
        moved = false;
      }

      ctx!.globalCompositeOperation = 'lighter';
      for (const p of pool) {
        if (!p.active) continue;
        const age = now - p.born;
        if (age >= LIFE_MS) {
          p.active = false;
          continue;
        }
        const t = age / LIFE_MS; // 0 -> 1 over the particle's life
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.vx *= 0.94;
        p.vy *= 0.94;

        const alpha = 1 - t;
        const radius = p.size * (1 - t * 0.5) * 3.4;
        const [r, g, b] = p.violet ? [168, 92, 240] : [76, 224, 232];
        const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.9).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(frame);
  }
}
