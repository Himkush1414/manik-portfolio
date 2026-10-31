import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { capDpr, isMobileViewport } from '../../gl/gl'
import { prefersReducedMotion } from '../../lib/hooks'
import { DEFAULT_COLORS, hexToRgb, hsvToRgb, normalizeHex, rgbToHex, rgbToHsv, type NeonColors } from './colors'
import { makeLook } from './look'
import { NeonRenderer, STAGE_BG } from './neonRenderer'

type Target = 'tube' | 'back'
type HSV = [number, number, number]

const TARGETS: { id: Target; label: string }[] = [
  { id: 'tube', label: 'Tube' },
  { id: 'back', label: 'Backlight' },
]

export const PICKER_PRESETS: { name: string; hex: string }[] = [
  { name: 'Warm white', hex: '#ffd9a8' },
  { name: 'Cool white', hex: '#d4e4ff' },
  { name: 'Red', hex: '#ff2a2a' },
  { name: 'Amber', hex: '#ffb020' },
  { name: 'Green', hex: '#22ff66' },
  { name: 'Cyan', hex: '#22e0ff' },
  { name: 'Blue', hex: '#2a6bff' },
  { name: 'Violet', hex: '#8a3dff' },
  { name: 'Magenta', hex: '#ff2ad4' },
]

const OPEN_MS = 600
const CLOSE_MS = 500
const RING = 14 // hue ring thickness, px

function hsvFromHex(hex: string, keepHue: number): HSV {
  const [h, s, v] = rgbToHsv(hexToRgb(hex))
  return [s < 0.002 || v < 0.002 ? keepHue : h, s, v]
}

/** the real stage, live, at reduced intensity, in the colors being picked */
function LiveStage({ colors }: { colors: React.MutableRefObject<NeonColors> }) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current!
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 block h-full w-full'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)
    const r = NeonRenderer.create(canvas, true)
    if (!r) return () => canvas.remove()
    const reduced = prefersReducedMotion()
    let raf = 0
    let disposed = false
    let lookKey = ''
    let look = makeLook(colors.current, 1, null)
    const size = () => {
      const b = host.getBoundingClientRect()
      r.resize(b.width, b.height, capDpr(isMobileViewport()))
      lookKey = ''
    }
    const frame = (now: number) => {
      raf = 0
      if (disposed) return
      const c = colors.current
      const key = `${c.tube}${c.back}`
      if (key !== lookKey) {
        lookKey = key
        look = makeLook(c, r.H, r.title)
      }
      const s = now / 1000
      const hum = reduced ? 1 : 1 + 0.015 * Math.sin(s * Math.PI * 2 * 0.4)
      const k = 0.62 // reduced intensity behind the panel
      r.render({ tube: hum * k, spill: hum * k, half: 1, tip: 0, done: true }, look.shader, {
        time: s,
        textFade: 0.7,
        bg: STAGE_BG,
        grain: 0.03,
      })
      raf = requestAnimationFrame(frame)
    }
    size()
    void document.fonts.load('900 100px Inter').then(() => {
      if (disposed) return
      r.uploadTitle()
      lookKey = ''
    })
    const ro = new ResizeObserver(size)
    ro.observe(host)
    raf = requestAnimationFrame(frame)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      r.dispose()
      canvas.remove()
    }
  }, [colors])
  return <div ref={hostRef} className="absolute inset-0" data-testid="picker-live-stage" />
}

/** hue ring (14px) with a saturation x brightness square inside it */
function WheelAndSquare({ hsv, onChange, size }: { hsv: HSV; onChange: (v: HSV) => void; size: number }) {
  const ringRef = useRef<HTMLDivElement>(null)
  const squareRef = useRef<HTMLDivElement>(null)
  const [h, s, v] = hsv
  const rMid = size / 2 - RING / 2
  const inner = size / 2 - RING - 10
  const side = Math.floor(inner * Math.SQRT2)
  const hueCss = `hsl(${Math.round(h * 360)} 100% 50%)`
  const current = rgbToHex(hsvToRgb(h, s, v))

  const fromRing = (e: React.PointerEvent) => {
    const b = ringRef.current!.getBoundingClientRect()
    const dx = e.clientX - (b.left + b.width / 2)
    const dy = e.clientY - (b.top + b.height / 2)
    let a = Math.atan2(dx, -dy) / (Math.PI * 2) // 0 at the top, clockwise (same as conic-gradient)
    if (a < 0) a += 1
    onChange([a, s, v])
  }
  const fromSquare = (e: React.PointerEvent) => {
    const b = squareRef.current!.getBoundingClientRect()
    const c = (n: number) => Math.min(1, Math.max(0, n))
    onChange([h, c((e.clientX - b.left) / b.width), c(1 - (e.clientY - b.top) / b.height)])
  }
  const drag = (fn: (e: React.PointerEvent) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      fn(e)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) fn(e)
    },
  })
  const thumb =
    'absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900'
  const stops = Array.from({ length: 37 }, (_, i) => `hsl(${i * 10} 100% 50%)`).join(',')
  const ringMask = `radial-gradient(farthest-side, transparent calc(100% - ${RING}px), #000 calc(100% - ${RING - 0.75}px))`

  return (
    <div className="relative mx-auto select-none" style={{ width: size, height: size }} data-testid="color-wheel">
      <div
        ref={ringRef}
        className="absolute inset-0 cursor-crosshair touch-none rounded-full"
        style={{ background: `conic-gradient(${stops})`, WebkitMask: ringMask, mask: ringMask }}
        {...drag(fromRing)}
        data-testid="hue-ring"
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(h * 360) % 360}
        aria-valuetext={`Hue ${Math.round(h * 360) % 360} degrees`}
        className={`${thumb} h-[20px] w-[20px]`}
        style={{ left: size / 2 + rMid * Math.sin(h * Math.PI * 2), top: size / 2 - rMid * Math.cos(h * Math.PI * 2), background: hueCss }}
        onKeyDown={e => {
          const d = e.shiftKey ? 10 / 360 : 1 / 360
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange([(h + d) % 1, s, v])
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange([(h - d + 1) % 1, s, v])
          else return
          e.preventDefault()
        }}
        data-testid="hue-thumb"
      />
      <div
        ref={squareRef}
        className="absolute cursor-crosshair touch-none rounded-[6px]"
        style={{
          width: side,
          height: side,
          left: (size - side) / 2,
          top: (size - side) / 2,
          background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${hueCss})`,
        }}
        {...drag(fromSquare)}
        data-testid="sv-square"
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(s * 100)}
          aria-valuetext={`Saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
          className={`${thumb} h-[18px] w-[18px]`}
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: current }}
          onKeyDown={e => {
            const c = (n: number) => Math.min(1, Math.max(0, n))
            const d = e.shiftKey ? 0.1 : 0.01
            if (e.key === 'ArrowRight') onChange([h, c(s + d), v])
            else if (e.key === 'ArrowLeft') onChange([h, c(s - d), v])
            else if (e.key === 'ArrowUp') onChange([h, s, c(v + d)])
            else if (e.key === 'ArrowDown') onChange([h, s, c(v - d)])
            else return
            e.preventDefault()
          }}
        />
      </div>
    </div>
  )
}

export interface FocusOrigin {
  x: number
  y: number
  size: number
}

export function ColorFocus({
  origin,
  initial,
  onDone,
}: {
  origin: FocusOrigin
  initial: NeonColors
  onDone: (result: NeonColors | null) => void
}) {
  const reduced = prefersReducedMotion()
  const [draft, setDraft] = useState<NeonColors>(initial)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [active, setActive] = useState<Target>('tube')
  const [hsv, setHsv] = useState<HSV>(() => hsvFromHex(initial.tube, 0))
  const [hexText, setHexText] = useState(initial.tube.slice(1).toUpperCase())
  const [hexBad, setHexBad] = useState(false)
  const [phase, setPhase] = useState<'enter' | 'open' | 'closing'>('enter')
  const rootRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)
  const [vw, setVw] = useState(window.innerWidth)

  const cover = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y)) + 4

  useLayoutEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')))
    rootRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function close(result: NeonColors | null) {
    if (closingRef.current) return
    closingRef.current = true
    setPhase('closing')
    window.setTimeout(() => onDone(result), reduced ? 0 : CLOSE_MS)
  }

  // ---- Esc cancels, Tab stays inside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(null)
      } else if (e.key === 'Tab') {
        const items = Array.from(
          rootRef.current!.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
        ).filter(el => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (!rootRef.current!.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = (hex: string, nextHsv?: HSV) => {
    setDraft(d => ({ ...d, [active]: hex }))
    setHexText(hex.slice(1).toUpperCase())
    setHexBad(false)
    setHsv(nextHsv ?? hsvFromHex(hex, hsv[0]))
  }
  const select = (id: Target) => {
    setActive(id)
    setHsv(hsvFromHex(draft[id], hsv[0]))
    setHexText(draft[id].slice(1).toUpperCase())
    setHexBad(false)
  }

  const open = phase === 'open'
  const dur = reduced ? 0 : phase === 'closing' ? CLOSE_MS : OPEN_MS
  const ease = phase === 'closing' ? 'cubic-bezier(0.65, 0, 0.35, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)'
  const wheel = vw < 600 ? 224 : 256

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Choose light colors"
      className="fixed inset-0 z-[80] overflow-hidden bg-[#050505] text-neutral-100"
      style={{
        clipPath: `circle(${open ? cover : origin.size / 2}px at ${origin.x}px ${origin.y}px)`,
        transition: `clip-path ${dur}ms ${ease}`,
        fontFamily: "'Sora', Inter, sans-serif",
      }}
      data-testid="focus-mode"
      data-phase={phase}
    >
      <LiveStage colors={draftRef} />
      {/* a light veil so the card reads over the live stage */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(0,0,0,0.5),rgba(0,0,0,0.15)_70%)]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-[392px] rounded-[24px] border border-white/10 bg-[rgba(18,18,20,0.72)] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl backdrop-saturate-150 md:p-6"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'none' : 'translateY(12px) scale(0.94)',
            transition: reduced
              ? 'none'
              : `opacity ${open ? 420 : 260}ms ease ${open ? 120 : 0}ms, transform ${dur}ms ${ease} ${open ? 80 : 0}ms`,
          }}
          data-testid="picker-card"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[12px] font-medium tracking-[0.16em] text-neutral-400 uppercase">Light colors</p>
            <button
              type="button"
              aria-label="Reset both colors to the default look"
              onClick={() => {
                setDraft(DEFAULT_COLORS)
                setHexText(DEFAULT_COLORS[active].slice(1).toUpperCase())
                setHexBad(false)
                setHsv(hsvFromHex(DEFAULT_COLORS[active], hsv[0]))
              }}
              className="cursor-pointer rounded-full px-3 py-1.5 text-[12px] text-neutral-400 transition-colors outline-none hover:bg-white/5 hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-white/70"
              data-testid="picker-reset"
            >
              Reset
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/8 bg-black/30 p-1" role="group" aria-label="Which light to edit">
            {TARGETS.map(t => (
              <button
                key={t.id}
                type="button"
                aria-pressed={active === t.id}
                data-autofocus={t.id === 'tube' ? '' : undefined}
                onClick={() => select(t.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                  active === t.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
                data-testid={`chip-${t.id}`}
              >
                <span className="h-7 w-7 shrink-0 rounded-full border border-white/25" style={{ background: draft[t.id] }} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium">{t.label}</span>
                  <span className="font-mono text-[11px] text-neutral-500 uppercase">{draft[t.id]}</span>
                </span>
              </button>
            ))}
          </div>

          <WheelAndSquare hsv={hsv} size={wheel} onChange={v => apply(rgbToHex(hsvToRgb(...v)), v)} />

          <div className="mt-5 flex items-center gap-2">
            <label
              className={`flex flex-1 items-center gap-1 rounded-xl border bg-black/30 px-3 py-2 focus-within:border-white/50 ${
                hexBad ? 'border-dashed border-white/45' : 'border-white/10'
              }`}
            >
              <span className="font-mono text-[13px] text-neutral-500">#</span>
              <input
                value={hexText}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                  setHexText(raw.toUpperCase())
                  const n = raw.length === 3 || raw.length === 6 ? normalizeHex(raw) : null
                  setHexBad(!n && raw.length > 0)
                  if (n) {
                    setDraft(d => ({ ...d, [active]: n }))
                    setHsv(hsvFromHex(n, hsv[0]))
                  }
                }}
                onBlur={() => {
                  setHexText(draft[active].slice(1).toUpperCase())
                  setHexBad(false)
                }}
                spellCheck={false}
                autoComplete="off"
                maxLength={7}
                aria-invalid={hexBad}
                aria-label={`Hex value of the ${active === 'tube' ? 'tube' : 'backlight'} color, 3 or 6 digits`}
                className="w-full bg-transparent font-mono text-[13px] tracking-[0.08em] text-white outline-none"
                data-testid="hex-input"
              />
            </label>
            <span className="w-[54px] text-right text-[11px] text-neutral-500" aria-live="polite">
              {hexBad ? '3 or 6' : ''}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap justify-between gap-y-2" role="group" aria-label="Presets">
            {PICKER_PRESETS.map(p => {
              const on = draft[active] === p.hex
              return (
                <button
                  key={p.hex}
                  type="button"
                  title={p.name}
                  aria-label={`Preset: ${p.name}`}
                  aria-pressed={on}
                  onClick={() => apply(p.hex)}
                  className={`h-[26px] w-[26px] cursor-pointer rounded-full border border-white/20 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-white ${
                    on ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121214]' : ''
                  }`}
                  style={{ background: p.hex }}
                />
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-label="Cancel and close"
              onClick={() => close(null)}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 text-[14px] text-neutral-200 transition-colors outline-none hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-white/70"
              data-testid="picker-cancel"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              Cancel
            </button>
            <button
              type="button"
              aria-label="Confirm colors"
              onClick={() => close(draftRef.current)}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-medium text-black transition-colors outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121214]"
              data-testid="picker-confirm"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>,
    // inside the section root (not <body>): the section's stylesheet is scoped to it
    document.getElementById('skillsfun-root') ?? document.body,
  )
}
