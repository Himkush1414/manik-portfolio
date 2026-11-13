import { useEffect } from 'react'

// EXPERIMENT: hanging strings across the top of the Skills & Fun figure hero
// (#skillsfun-page2). Fully self-contained. To remove it, delete this file
// and the one <HangingStrings /> line (plus its import) in
// sections/NeonToSkillsFun.tsx.
//
// - One Canvas 2D, inserted into the hero right after its ambient background
//   (z-index 0, later in the DOM), so it sits above the background and
//   below the CREATIVE DESIGN word (z 1) and the figure (z 2).
//   pointer-events: none, so it never blocks a click.
// - String length = the CREATIVE DESIGN block's own height (read from the
//   element, kept in sync by a ResizeObserver), ±10% per string.
// - Colour = the hero's light top tone, the ambient layer's --g0, nudged a
//   little lighter. Tips get a tiny white dot that twinkles slowly.
// - Motion: each tip is a damped spring with light coupling to its
//   neighbours, so a push travels sideways as a wave. A mouse/pen parts the
//   strings (pointermove on the hero). Touch: a gentle idle sway plus a push
//   while dragging, with no cursor logic.
// - One rAF loop, paused while the hero is off screen or the tab is hidden.
//   No shadowBlur, no per-frame allocations. prefers-reduced-motion: static.

const MAX_STRINGS = 320
const STIFFNESS = 38 // spring back to rest (1/s²)
const DAMPING = 4.6 // underdamped, so they sway back like grass
const COUPLING = 15 // pull towards the neighbours' offset: the wave
const PUSH = 950 // px/s² at the cursor, away from it
const DRAG = 0.85 // how much of the pointer's sideways speed is passed on
const MAX_FORCE = 2600
const IDLE_AMP = 2.2 // px, touch devices only
const TWINKLE_MIN = 0.35

type Rgb = [number, number, number]

function parseColor(raw: string): Rgb | null {
  const s = raw.trim()
  let m = /^#([0-9a-f]{3})$/i.exec(s)
  if (m) return [0, 1, 2].map(i => parseInt(m![1][i] + m![1][i], 16)) as Rgb
  m = /^#([0-9a-f]{6})/i.exec(s)
  if (m) return [0, 2, 4].map(i => parseInt(m![1].slice(i, i + 2), 16)) as Rgb
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s)
  if (m) return [+m[1], +m[2], +m[3]]
  return null
}

// a fixed pseudo-random sequence, so the strings look the same on every visit
function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function HangingStrings() {
  useEffect(() => {
    const hero = document.getElementById('skillsfun-page2')
    const ambient = document.getElementById('skillsfun-ambient-a')
    const word = hero?.querySelector<HTMLElement>('.skillsfun-page2__bigtext')
    if (!hero || !word) return
    const ctx2d = document.createElement('canvas').getContext('2d')
    if (!ctx2d) return
    const canvas = ctx2d.canvas
    const ctx: CanvasRenderingContext2D = ctx2d
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;z-index:0;pointer-events:none;display:block'
    // right after the hero's background wrapper (same z-index, later in the
    // DOM, so it paints above the background and below everything else)
    const backdrop = hero.querySelector(':scope > .skillsfun-page2__ambient')
    if (backdrop) backdrop.after(canvas)
    else hero.prepend(canvas)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)')

    // per-string state, allocated once for the maximum count
    const xs = new Float32Array(MAX_STRINGS)
    const len = new Float32Array(MAX_STRINGS)
    const off = new Float32Array(MAX_STRINGS) // tip offset, px
    const vel = new Float32Array(MAX_STRINGS)
    const acc = new Float32Array(MAX_STRINGS)
    const phase = new Float32Array(MAX_STRINGS)
    const speed = new Float32Array(MAX_STRINGS)
    for (let i = 0; i < MAX_STRINGS; i++) {
      phase[i] = rand(i + 1) * Math.PI * 2
      speed[i] = 0.5 + rand(i + 101) * 0.9
    }

    let n = 0
    let width = 0
    let height = 0
    let wordH = 0
    let dpr = 1
    let lineColor = 'rgba(214, 224, 245, 0.42)'

    const readColor = () => {
      const raw = ambient ? getComputedStyle(ambient).getPropertyValue('--g0') : ''
      const c = parseColor(raw)
      if (!c) return
      // a touch lighter than the background tone, and translucent, so the
      // strings are only faintly visible against it
      const mix = (v: number) => Math.round(v + (255 - v) * 0.28)
      lineColor = `rgba(${mix(c[0])}, ${mix(c[1])}, ${mix(c[2])}, 0.42)`
    }

    const layout = () => {
      const w = hero.clientWidth
      const h = word.offsetHeight
      if (!w || !h) return false
      width = w
      wordH = h
      // fewer strings on narrow screens: ~7px apart on phones, 5px on desktop
      const gap = w < 600 ? 7 : w < 1024 ? 6 : 5
      n = Math.min(MAX_STRINGS, Math.max(8, Math.round(w / gap)))
      const step = w / n
      for (let i = 0; i < n; i++) {
        xs[i] = Math.round((i + 0.5) * step) + 0.5 // crisp 1px lines
        len[i] = wordH * (0.9 + rand(i + 501) * 0.2) // ±10%
      }
      height = Math.ceil(wordH * 1.1 + 4)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.height = `${height}px`
      readColor()
      return true
    }

    // ---- input ----
    let px = -1e4
    let py = -1e4
    let pvx = 0
    let pointerOn = false
    let lastMoveT = 0
    let lastX = 0
    const toLocal = (clientX: number, clientY: number) => {
      const r = hero.getBoundingClientRect()
      return [clientX - r.left, clientY - r.top] as const
    }
    const track = (clientX: number, clientY: number, t: number) => {
      const [x, y] = toLocal(clientX, clientY)
      const dt = Math.max((t - lastMoveT) / 1000, 1 / 240)
      const v = pointerOn ? (x - lastX) / dt : 0
      pvx += (Math.max(-3000, Math.min(3000, v)) - pvx) * 0.5
      lastX = x
      lastMoveT = t
      px = x
      py = y
      pointerOn = true
      wake()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // touch is handled below, no cursor logic
      track(e.clientX, e.clientY, e.timeStamp)
    }
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') pointerOn = false
    }
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) track(t.clientX, t.clientY, e.timeStamp)
    }
    const onTouchEnd = () => {
      pointerOn = false
    }

    // ---- simulation + drawing ----
    const step = (dt: number, t: number) => {
      const idle = !hoverMq.matches
      const reach = width < 600 ? 52 : 72
      const fade = 34
      for (let i = 0; i < n; i++) {
        let f = -STIFFNESS * off[i] - DAMPING * vel[i]
        const l = i > 0 ? off[i - 1] : off[i]
        const r = i < n - 1 ? off[i + 1] : off[i]
        f += COUPLING * (l + r - 2 * off[i])
        if (idle) f += STIFFNESS * IDLE_AMP * Math.sin(t * 0.8 + xs[i] * 0.011)
        if (pointerOn) {
          const L = len[i]
          const dx = xs[i] + off[i] - px
          const ad = dx < 0 ? -dx : dx
          if (ad < reach && py > 0 && py < L + fade) {
            const along = py <= L ? 0.35 + 0.65 * (py / L) : 1 - (py - L) / fade
            const near = 1 - ad / reach
            const w = near * near * along
            let push = w * ((dx < 0 ? -1 : 1) * PUSH + pvx * DRAG)
            if (push > MAX_FORCE) push = MAX_FORCE
            else if (push < -MAX_FORCE) push = -MAX_FORCE
            f += push
          }
        }
        acc[i] = f
      }
      for (let i = 0; i < n; i++) {
        vel[i] += acc[i] * dt
        off[i] += vel[i] * dt
        const lim = len[i] * 0.42
        if (off[i] > lim) { off[i] = lim; vel[i] *= -0.3 }
        else if (off[i] < -lim) { off[i] = -lim; vel[i] *= -0.3 }
      }
      pvx *= 0.9
    }

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = 1
      ctx.strokeStyle = lineColor
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = xs[i]
        const L = len[i]
        const d = off[i]
        const ty = Math.sqrt(L * L - d * d) // keeps the string's length as it swings
        ctx.moveTo(x, 0)
        ctx.quadraticCurveTo(x, ty * 0.55, x + d, ty)
      }
      ctx.stroke()
      ctx.fillStyle = '#fff'
      for (let i = 0; i < n; i++) {
        const L = len[i]
        const d = off[i]
        const ty = Math.sqrt(L * L - d * d)
        const tw = reduced ? 0.7 : TWINKLE_MIN + (1 - TWINKLE_MIN) * (0.5 + 0.5 * Math.sin(t * speed[i] + phase[i]))
        ctx.globalAlpha = tw
        ctx.fillRect(xs[i] + d - 0.65, ty - 0.65, 1.3, 1.3)
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    let last = 0
    let visible = false
    let calmFrames = 0
    const frame = (now: number) => {
      raf = 0
      if (!visible || document.hidden) {
        last = 0
        return
      }
      const t = now / 1000
      let dt = last ? (now - last) / 1000 : 1 / 60
      if (dt > 1 / 30) dt = 1 / 30
      // settled with nothing touching it: only the twinkle is moving, so
      // drop to ~30fps
      let energy = 0
      for (let i = 0; i < n; i++) energy += off[i] * off[i] + vel[i] * vel[i]
      const calm = !pointerOn && hoverMq.matches && energy < 0.02 * n
      calmFrames = calm ? calmFrames + 1 : 0
      if (!(calm && calmFrames % 2 === 1)) {
        const sub = dt > 1 / 50 ? 2 : 1
        for (let s = 0; s < sub; s++) step(dt / sub, t)
        draw(t)
        last = now
      }
      raf = requestAnimationFrame(frame)
    }
    function wake() {
      if (!reduced && !raf && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }

    const refresh = () => {
      if (!layout()) return
      if (reduced) draw(0)
      else wake()
    }
    const ro = new ResizeObserver(refresh)
    ro.observe(hero)
    ro.observe(word)
    const io = new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting
      if (visible) {
        readColor()
        refresh()
      }
    })
    io.observe(hero)
    const onVis = () => wake()
    document.addEventListener('visibilitychange', onVis)
    if (!reduced) {
      hero.addEventListener('pointermove', onPointerMove, { passive: true })
      hero.addEventListener('pointerleave', onPointerLeave, { passive: true })
      hero.addEventListener('touchstart', onTouch, { passive: true })
      hero.addEventListener('touchmove', onTouch, { passive: true })
      hero.addEventListener('touchend', onTouchEnd, { passive: true })
      hero.addEventListener('touchcancel', onTouchEnd, { passive: true })
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      hero.removeEventListener('pointermove', onPointerMove)
      hero.removeEventListener('pointerleave', onPointerLeave)
      hero.removeEventListener('touchstart', onTouch)
      hero.removeEventListener('touchmove', onTouch)
      hero.removeEventListener('touchend', onTouchEnd)
      hero.removeEventListener('touchcancel', onTouchEnd)
      canvas.remove()
    }
  }, [])
  return null
}
