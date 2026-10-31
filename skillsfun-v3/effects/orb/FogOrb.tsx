import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Program, drawFullscreen } from '../../gl/gl'
import { FOG_DEFAULTS, fogShader } from './fogShader'
import { hexToRgb, lin, type RGB } from '../neon/colors'

// A sphere of swirling, banded fog (WebGL2, one small transparent canvas); the
// shader is in fogShader.ts. The shell's distance function is a weighted blend
// of sphere / cube / tetrahedron / torus, which is how it morphs (the
// turbulence keeps running, so no shape ever looks solid).

const SHAPES = ['sphere', 'cube', 'pyramid', 'ring'] as const

export interface FogOrbHandle {
  rect: () => DOMRect
  focus: () => void
}

interface Props {
  color: string // tube color, hex
  size: number // visible sphere, css px (64 desktop / 52 mobile)
  paused: boolean
  reduced: boolean
  hidden?: boolean
  tabbable: boolean
  onOpen: () => void
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)]
}

/** core = the tube color; glow = +18deg hue, lighter (neutral tubes get a faint cool gray) -- both linear */
function orbColors(hex: string): { core: RGB; glow: RGB } {
  const c = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(c)
  let g = hslToRgb((h + 18 / 360) % 1, s, Math.min(0.92, l + (1 - l) * 0.45))
  if (s < 0.12) {
    const cool: RGB = [0.8, 0.84, 0.9]
    const k = 1 - s / 0.12
    g = g.map((v, i) => v + (cool[i] - v) * 0.5 * k) as RGB
  }
  return { core: c.map(lin) as RGB, glow: g.map(lin) as RGB }
}

export const FogOrb = forwardRef<FogOrbHandle, Props>(function FogOrb({ color, size, paused, reduced, hidden, tabbable, onOpen }, ref) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const st = useRef({ hover: false, pointer: [0, 0] as [number, number], paused, reduced, color, kick: () => {}, setShape: (_s: number) => {}, shape: 0 })
  st.current.paused = paused
  st.current.reduced = reduced
  st.current.color = color
  // the canvas is bigger than the sphere so the glow is never clipped
  const canvasSize = size < 60 ? 80 : 96
  const hit = size + 16 // hit area: the sphere circle plus ~8px around it

  useImperativeHandle(ref, () => ({
    rect: () => btnRef.current!.getBoundingClientRect(),
    focus: () => btnRef.current?.focus({ preventScroll: true }),
  }))

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
    if (!gl) return
    const mobile = size < 60
    const prog = new Program(gl, fogShader({ ...FOG_DEFAULTS, ...(mobile ? { steps: 14, iters: 3 } : {}) }))
    let raf = 0
    let last = 0
    let time = 3.7
    let orbit = 0.6
    let speed = 1
    const lean: [number, number] = [0, 0.18]
    const w = [1, 0, 0, 0]
    const wv = [0, 0, 0, 0]
    let target = 0
    let K = 60
    let C = 13
    let visible = true
    let disposed = false
    const start = orbColors(st.current.color)
    let core: RGB = start.core
    let glow: RGB = start.glow

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      canvas.width = Math.round(canvasSize * dpr)
      canvas.height = Math.round(canvasSize * dpr)
    }
    const setShape = (s: number) => {
      if (st.current.reduced || s === target) return
      target = s
      st.current.shape = s
      ;[K, C] = s === 0 ? [75, 15] : [60, 13]
      canvas.dataset.shape = SHAPES[s]
      kick()
    }
    st.current.setShape = setShape

    const frame = (now: number) => {
      raf = 0
      if (disposed) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      const s = st.current
      const want = orbColors(s.color)
      const kc = 1 - Math.exp(-dt / 0.13) // ~400ms to settle
      core = core.map((v, i) => v + (want.core[i] - v) * kc) as RGB
      glow = glow.map((v, i) => v + (want.glow[i] - v) * kc) as RGB
      if (!s.reduced) {
        speed += ((s.hover ? 1.8 : 1) - speed) * (1 - Math.exp(-dt * 5))
        time += dt * 0.35 * speed
        orbit += dt * 0.1 * speed
        const lx = s.hover ? s.pointer[0] * 0.45 : 0
        const ly = 0.18 + (s.hover ? -s.pointer[1] * 0.35 : 0)
        lean[0] += (lx - lean[0]) * (1 - Math.exp(-dt * 6))
        lean[1] += (ly - lean[1]) * (1 - Math.exp(-dt * 6))
        // per-shape weights spring toward the target: smooth even if retargeted mid-morph
        for (let i = 0; i < 4; i++) {
          const goal = i === target ? 1 : 0
          wv[i] += (K * (goal - w[i]) - C * wv[i]) * dt
          w[i] = Math.max(0, w[i] + wv[i] * dt)
        }
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      prog
        .use()
        .f('uRes', canvas.width, canvas.height)
        .f('uTime', time)
        .f('uOrbit', orbit)
        .f('uLean', lean[0], lean[1])
        .f('uW', w[0], w[1], w[2], w[3])
        .f('uCore', ...core)
        .f('uGlow', ...glow)
        .f('uSphere', size / canvasSize)
      drawFullscreen(gl)
      canvas.dataset.weights = w.map(v => v.toFixed(2)).join(',')
      const recoloring = Math.abs(want.core[0] - core[0]) + Math.abs(want.core[1] - core[1]) + Math.abs(want.core[2] - core[2]) > 0.002
      if (visible && !document.hidden && !s.paused && (!s.reduced || recoloring)) raf = requestAnimationFrame(frame)
      else last = 0
    }
    const kick = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(frame)
    }
    st.current.kick = kick
    resize()
    canvas.dataset.shape = 'sphere'
    const io = new IntersectionObserver(e => {
      visible = e[e.length - 1].isIntersecting
      if (visible) kick()
    })
    io.observe(canvas)
    const onVis = () => !document.hidden && kick()
    document.addEventListener('visibilitychange', onVis)
    kick()

    // touch-only devices: no hover, so it morphs to the next shape every 4s
    const auto = window.matchMedia('(hover: none)').matches
      ? window.setInterval(() => {
          if (!st.current.paused && !st.current.reduced) setShape((target + 1) % SHAPES.length)
        }, 4000)
      : 0
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(auto)
      // no loseContext(): StrictMode re-runs this effect on the same canvas, and a
      // lost context can't be re-acquired; the context is freed with the canvas
      prog.dispose()
    }
  }, [size, canvasSize])

  useEffect(() => {
    if (!paused) st.current.kick()
  }, [paused, color, reduced])

  // hover / keyboard focus: morph to the next shape and keep cycling while engaged
  const cycle = useRef(0)
  const engage = () => {
    const s = st.current
    if (s.hover) return
    s.hover = true
    s.kick()
    if (s.reduced) return
    s.setShape((s.shape + 1) % SHAPES.length || 1)
    window.clearInterval(cycle.current)
    cycle.current = window.setInterval(() => s.setShape((s.shape + 1) % SHAPES.length), 1600)
  }
  const release = () => {
    const s = st.current
    s.hover = false
    s.pointer = [0, 0]
    window.clearInterval(cycle.current)
    s.setShape(0)
  }
  useEffect(() => () => window.clearInterval(cycle.current), [])

  const pad = (canvasSize - hit) / 2
  return (
    <button
      ref={btnRef}
      type="button"
      aria-label="Choose light colors"
      tabIndex={tabbable ? 0 : -1}
      aria-hidden={!tabbable}
      // the button is the sphere circle + 8px: that is the hit area, the rest of the glow isn't
      className="relative block cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
      style={{ width: hit, height: hit, visibility: hidden ? 'hidden' : 'visible' }}
      onClick={e => {
        e.stopPropagation()
        onOpen()
      }}
      onPointerEnter={e => e.pointerType === 'mouse' && engage()}
      onPointerMove={e => {
        if (e.pointerType !== 'mouse') return
        const b = e.currentTarget.getBoundingClientRect()
        st.current.pointer = [((e.clientX - b.left) / b.width) * 2 - 1, ((e.clientY - b.top) / b.height) * 2 - 1]
      }}
      onPointerLeave={e => e.pointerType === 'mouse' && release()}
      onFocus={e => e.currentTarget.matches(':focus-visible') && engage()}
      onBlur={release}
      data-testid="color-orb"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute block"
        style={{ left: -pad, top: -pad, width: canvasSize, height: canvasSize }}
        aria-hidden="true"
        data-testid="orb-canvas"
      />
    </button>
  )
})
