import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { capDpr, isMobileViewport } from '../../gl/gl'
import { damp, prefersReducedMotion, smoothstep, useReducedMotion } from '../../lib/hooks'
import { FogOrb, type FogOrbHandle } from '../orb/FogOrb'
import { ColorFocus, type FocusOrigin } from './ColorFocus'
import type { NeonColors } from './colors'
import { neonColors, useNeonColors } from '../../state/neonColors'
import { makeLook } from './look'
import { NeonRenderer, STAGE_BG, lightReach, titleLayout, type TitleLayout } from './neonRenderer'
import { NeonTimeline } from './neonTimeline'
import { DyingFlicker, extrasFadeFor, fadeState, orbFadeFor, textFadeFor } from './scrollFade'

// Real copy from the portfolio's Skills & Fun page (index.html, read-only):
// the hero kicker and the hero headline.
const EYEBROW = 'Manik Rana // Skill & Fun'
const SUBLINE = 'The run never ends. Neither should you.'

export interface StageCtl {
  p: number // scroll fade progress 0..1
  wake?: () => void
  relight?: () => void // back to full black, then the whole ignition again
}

export function NeonStage({
  ctl,
  active,
  onRevealed,
}: {
  ctl: React.MutableRefObject<StageCtl>
  active: boolean
  onRevealed: () => void
}) {
  const reduced = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const timeline = useRef<NeonTimeline | null>(null)
  const extras = useRef<(HTMLElement | null)[]>([])
  const orbFadeRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<FogOrbHandle>(null)
  const colors = useNeonColors()
  const [revealed, setRevealed] = useState(false)
  const [layout, setLayout] = useState<{ W: number; H: number; title: TitleLayout } | null>(null)
  const [focus, setFocus] = useState<FocusOrigin | null>(null)
  const [orbFaded, setOrbFaded] = useState(false)
  const pausedRef = useRef(false)
  const snapRef = useRef(false)
  const onRevealedRef = useRef(onRevealed)
  onRevealedRef.current = onRevealed

  // ---- colors -> what the shader and the DOM text use ---------------------
  const look = useMemo(
    () => makeLook(colors, layout?.H ?? window.innerHeight, layout?.title ?? null),
    [colors, layout],
  )
  const lookRef = useRef(look)
  lookRef.current = look

  // ---- layout of the DOM text around the GL title ---------------------------
  useLayoutEffect(() => {
    const stage = stageRef.current!
    const measure = () => {
      const W = stage.clientWidth
      const H = stage.clientHeight
      setLayout({ W, H, title: titleLayout(W, H) })
    }
    measure()
    void document.fonts.load('900 100px Inter').then(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  // keep the reveal clock running when the canvas isn't drawing (scrolled away)
  useEffect(() => {
    const id = window.setInterval(() => {
      const tl = timeline.current
      if (tl && !tl.revealDone) tl.sample(performance.now())
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  const startTimeline = (now: number) => {
    timeline.current = new NeonTimeline(now, prefersReducedMotion(), () => {
      setRevealed(true)
      onRevealedRef.current()
    })
  }

  // ---- the render loop (mounted only while the stage is near the viewport) ---
  useEffect(() => {
    if (!active) return
    const host = hostRef.current!
    const stage = stageRef.current!
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 block h-full w-full'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)
    const r = NeonRenderer.create(canvas, true)
    if (!r) return () => canvas.remove()
    const isReduced = reduced
    const flicker = new DyingFlicker()
    const cover = new Array<number>(8).fill(0) // smoothed (staggered) light coverage per text element
    let raf = 0
    let last = 0
    let visible = true
    let disposed = false
    let lastOrbFaded: boolean | null = null

    const size = () => {
      const b = stage.getBoundingClientRect()
      r.resize(b.width, b.height, capDpr(isMobileViewport()))
    }

    const frame = (now: number) => {
      raf = 0
      if (disposed) return
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60
      last = now
      if (!timeline.current) startTimeline(now)
      const s0 = timeline.current!.sample(now)
      const p = ctl.current.p
      const s = fadeState(s0, p, flicker.sample(now, p, window.scrollY, isReduced), isReduced)
      const black = p >= 0.999
      const fadeBg = 1 - smoothstep(0.85, 1, p)
      if (import.meta.env.DEV) {
        const w = window as unknown as { __neonTrace?: number[][]; __flicker?: number[] }
        ;(w.__neonTrace ??= []).push([Math.round(now), +s.tube.toFixed(3), +s.spill.toFixed(3), +s.half.toFixed(3), +p.toFixed(3)])
        if (w.__neonTrace.length > 4000) w.__neonTrace.splice(0, 1000)
        w.__flicker = flicker.history
      }
      stage.style.backgroundColor = `rgb(${Math.round(10 * fadeBg)},${Math.round(10 * fadeBg)},${Math.round(10 * fadeBg)})`
      // the same tube intensity the shader gets: the DOM text shadows flicker with it
      const tubeI = Math.min(1, Math.max(0, s.tube))
      stage.style.setProperty('--tube-i', tubeI.toFixed(3))
      canvas.style.visibility = black ? 'hidden' : 'visible'
      if (!black) {
        r.render(s, lookRef.current.shader, {
          time: now / 1000,
          textFade: textFadeFor(p),
          bg: STAGE_BG * fadeBg,
          grain: 0.035 * fadeBg,
        })
      }

      // DOM text: revealed by the light that reaches its own left/right edges, slightly staggered
      const W = r.W
      const H = r.H
      const sb = stage.getBoundingClientRect()
      const ef = extrasFadeFor(p)
      extras.current.forEach((el, i) => {
        if (!el) return
        const b = el.getBoundingClientRect()
        const y = b.top + b.height / 2 - sb.top
        // coverage (how far the lit tube has spread over it) is smoothed for the stagger;
        // the light level itself is applied instantly, so the text flickers with the tube
        const full = { ...s, spill: 1 }
        const c = Math.min(lightReach(b.left - sb.left, y, W, H, full), lightReach(b.right - sb.left, y, W, H, full))
        cover[i] = isReduced || snapRef.current ? c : damp(cover[i], c, Math.max(4, 16 - i * 1.6), dt)
        el.style.opacity = (smoothstep(0.02, 0.75, cover[i] * Math.min(1, s.spill)) * ef).toFixed(3)
      })
      snapRef.current = false
      if (orbFadeRef.current) orbFadeRef.current.style.opacity = orbFadeFor(p).toFixed(3)
      const faded = p > 0.3
      if (faded !== lastOrbFaded) {
        lastOrbFaded = faded
        setOrbFaded(faded)
      }

      if (visible && !black && !pausedRef.current && !isReduced) raf = requestAnimationFrame(frame)
      else last = 0
    }
    const kick = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(frame)
    }
    ctl.current.wake = kick
    size()
    void document.fonts.load('900 100px Inter').then(() => {
      if (disposed) return
      r.uploadTitle()
      kick()
    })
    const ro = new ResizeObserver(() => {
      size()
      kick()
    })
    ro.observe(stage)
    const io = new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting
      if (visible) kick()
    })
    io.observe(stage)
    // reduced motion: a still frame, redrawn whenever the timeline or the scroll changes
    const poke = isReduced ? window.setInterval(kick, 300) : 0
    kick()
    return () => {
      disposed = true
      ctl.current.wake = undefined
      cancelAnimationFrame(raf)
      window.clearInterval(poke)
      ro.disconnect()
      io.disconnect()
      r.dispose()
      canvas.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced])

  useEffect(() => {
    const c = ctl.current
    c.relight = () => {
      setRevealed(false)
      snapRef.current = true
      timeline.current?.relight(performance.now(), 400)
      c.wake?.()
    }
    return () => {
      c.relight = undefined
    }
  }, [ctl])

  const openFocus = () => {
    const b = orbRef.current!.rect()
    setFocus({ x: b.left + b.width / 2, y: b.top + b.height / 2, size: b.width })
    // the stage is fully covered once the iris has opened: stop drawing it
    window.setTimeout(() => (pausedRef.current = true), 650)
  }

  const closeFocus = (result: NeonColors | null) => {
    pausedRef.current = false
    ctl.current.wake?.()
    setFocus(null)
    orbRef.current?.focus()
    if (!result) return
    neonColors.set(result)
    setRevealed(false)
    snapRef.current = true
    // stage black for 0.4s, then the whole ignition again in the new colors
    timeline.current?.relight(performance.now(), 400)
    ctl.current.wake?.()
  }

  const t = layout?.title
  const fs = t?.fontSize ?? 80
  const orbVisible = revealed && !orbFaded
  const orbSize = (layout?.W ?? 1024) < 768 ? 52 : 64 // visible sphere; its canvas is 80 / 96
  const label = 'lit-shadow pointer-events-none select-none font-[Sora] uppercase'

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 overflow-hidden bg-[#0a0a0a] select-none"
      onClick={() => {
        if (ctl.current.p < 0.05 && !focus) timeline.current?.click(performance.now())
        ctl.current.wake?.()
      }}
      style={{ ['--shadow-rgb' as string]: look.shadowRgb }}
      data-testid="neon-stage"
      data-cap-top={t?.capTop}
      data-baseline={t?.baseline}
    >
      <div ref={hostRef} className="absolute inset-0" />
      <h1 className="sr-only">Skills &amp; Fun</h1>

      {t && (
        <>
          <p
            ref={el => {
              extras.current[0] = el
            }}
            className={`${label} absolute inset-x-0 text-center text-[10px] font-semibold tracking-[0.42em] [padding-left:0.42em] md:text-[11px]`}
            style={{ top: t.capTop - Math.max(22, fs * 0.36), transform: 'translateY(-100%)', color: look.sub, opacity: 0 }}
            data-testid="neon-eyebrow"
          >
            {EYEBROW}
          </p>
          <p
            ref={el => {
              extras.current[1] = el
            }}
            className={`${label} absolute inset-x-4 text-center text-[clamp(11px,1.05vw,15px)] font-normal tracking-[0.14em]`}
            style={{ top: t.baseline + Math.max(18, fs * 0.3), color: look.sub, opacity: 0 }}
            data-testid="neon-subline"
          >
            {SUBLINE}
          </p>
        </>
      )}


      <div
        ref={el => {
          extras.current[6] = el
        }}
        className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 md:bottom-8"
        style={{ color: look.low, opacity: 0 }}
        aria-hidden="true"
        data-testid="neon-scroll"
      >
        <span className="lit-shadow font-[Sora] text-[10px] font-medium tracking-[0.45em] uppercase [margin-right:-0.45em]">Scroll</span>
        <span className="relative block h-10 w-px overflow-hidden bg-current/20">
          <span className="scroll-cue__dot absolute left-0 top-0 block h-1/2 w-px bg-current" />
        </span>
      </div>

      {/* fog-sphere orb: the sphere sits ~20px from the edges (its 8px hit margin and glow overhang) */}
      <div ref={orbFadeRef} className="absolute bottom-3 right-3">
        <div className={`transition-opacity duration-700 ease-out ${orbVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          {active && (
            <FogOrb
              ref={orbRef}
              color={colors.tube}
              size={orbSize}
              paused={!orbVisible || !!focus}
              reduced={reduced}
              hidden={!!focus}
              tabbable={orbVisible}
              onOpen={openFocus}
            />
          )}
        </div>
      </div>

      {focus && <ColorFocus origin={focus} initial={colors} onDone={closeFocus} />}
    </div>
  )
}
