import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { hexToRgb, lightColor } from '../effects/neon/colors'
import { prefersReducedMotion } from '../lib/hooks'
import { useNeonColors } from '../state/neonColors'
import { RisingLines, type RisingLook } from './risingLines'
import navLogoPng from '../../nav-logo-mark.png'
import navLogoWebp from '../../nav-logo-mark.webp'

// The Skills & Fun footer, redesigned: foggy matte black with shooting stars
// rising out of a glowing horizon (risingLines.ts, WebGL2). The text is plain,
// styled like the portfolio's home footer (styles.css .col__label / .linklist /
// .bottom__*), and the content is the Skills & Fun footer's, unchanged.

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '#projects' },
  { label: 'About', href: '/about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Contact', href: '#contact', id: 'skillsfun-footer-contact' },
]
const SOCIAL = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/manik-rana-752154277', external: true },
  { label: 'GitHub', href: 'https://github.com/Himkush1414', external: true },
  { label: 'Gmail', href: 'mailto:manikrana831@gmail.com' },
]

// dev-only ?slow=N stretches the intro so its frames can be captured at their real timestamps
const INTRO_MS = 900 * (import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('slow') ?? 1) : 1)
const easeOutCubic = (u: number) => 1 - Math.pow(1 - u, 3)

export interface GlassFooterHandle {
  replay: () => void
}

export const GlassFooter = forwardRef<GlassFooterHandle, { onFrame?: (info: { lines: number; sparks: number }) => void }>(function GlassFooter(
  { onFrame },
  ref,
) {
  const rootRef = useRef<HTMLElement>(null)
  const fxHost = useRef<HTMLDivElement>(null)
  const colors = useNeonColors()
  const replayRef = useRef<() => void>(() => {})
  useImperativeHandle(ref, () => ({ replay: () => replayRef.current() }))

  // colors: the lines follow the tube, tails + haze the backlight
  const look = useMemo(() => {
    const light: RisingLook = { tube: lightColor(hexToRgb(colors.tube)), back: lightColor(hexToRgb(colors.back)) }
    return { light }
  }, [colors])
  const lookRef = useRef(look)
  lookRef.current = look

  useEffect(() => {
    const root = rootRef.current!
    const host = fxHost.current!
    const reduced = prefersReducedMotion()
    const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches
    let fx: RisingLines | null = null
    let canvas: HTMLCanvasElement | null = null
    let raf = 0
    let last = 0
    let visible = false
    let near = false
    let disposed = false
    let introStart = -1
    const ptr = { x: -1, k: 0, want: 0 }

    const dpr = () => Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)

    const mount = () => {
      if (fx) return
      canvas = document.createElement('canvas')
      canvas.className = 'absolute inset-0 block h-full w-full'
      canvas.setAttribute('aria-hidden', 'true')
      host.appendChild(canvas)
      fx = RisingLines.create(canvas, { mobile, reduced })
      if (!fx) return
      const b = root.getBoundingClientRect()
      fx.resize(b.width, b.height, dpr())
      if (reduced) {
        fx.open = 1
        fx.warm(3)
      }
      kick()
    }
    const unmount = () => {
      cancelAnimationFrame(raf)
      raf = 0
      fx?.dispose()
      fx?.gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas?.remove()
      fx = null
      canvas = null
    }

    const frame = (now: number) => {
      raf = 0
      if (disposed || !fx) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      if (!reduced) {
        if (introStart >= 0) fx.open = easeOutCubic(Math.min(1, (now - introStart) / INTRO_MS))
        ptr.k += (ptr.want - ptr.k) * (1 - Math.exp(-dt * 6))
        if (ptr.x >= 0) fx.ptrX = fx.ptrX < 0 ? ptr.x : fx.ptrX + (ptr.x - fx.ptrX) * (1 - Math.exp(-dt * 7))
        fx.ptrK = ptr.k
        fx.step(dt)
      }
      const info = fx.render(lookRef.current.light)
      onFrame?.(info)
      root.dataset.open = fx.open.toFixed(2)
      if (visible && !document.hidden && !reduced) raf = requestAnimationFrame(frame)
      else last = 0
    }
    const kick = () => {
      if (!raf && !disposed && fx) raf = requestAnimationFrame(frame)
    }

    // mount when near, run only while visible; the intro starts at ~30% visible
    const ioNear = new IntersectionObserver(
      e => {
        near = e[e.length - 1].isIntersecting
        if (near) mount()
        else unmount()
      },
      { rootMargin: '50% 0px' },
    )
    ioNear.observe(root)
    const ioVis = new IntersectionObserver(
      e => {
        const en = e[e.length - 1]
        visible = en.isIntersecting
        if (en.intersectionRatio >= 0.3 && introStart < 0) introStart = performance.now()
        if (visible) kick()
      },
      { threshold: [0, 0.3] },
    )
    ioVis.observe(root)
    const onVis = () => !document.hidden && kick()
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(() => {
      if (!fx) return
      const b = root.getBoundingClientRect()
      fx.resize(b.width, b.height, dpr())
      if (reduced) fx.warm(0.1)
      kick()
    })
    ro.observe(root)

    const local = (e: PointerEvent) => {
      const b = root.getBoundingClientRect()
      return [e.clientX - b.left, b.bottom - e.clientY] as const
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || reduced) return
      ptr.x = local(e)[0]
      ptr.want = 1
      kick()
    }
    const onLeave = () => {
      ptr.want = 0
    }
    const onDown = (e: PointerEvent) => {
      if (reduced || (e.target as Element).closest('a, button')) return
      fx?.volley(local(e)[0])
      kick()
    }
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointerdown', onDown)

    replayRef.current = () => {
      unmount()
      introStart = -1
      mount()
      introStart = performance.now()
    }

    return () => {
      disposed = true
      ioNear.disconnect()
      ioVis.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onDown)
      unmount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <footer
      ref={rootRef}
      id="skillsfun-footer"
      className="site-footer relative isolate h-[60vh] min-h-[420px] overflow-hidden bg-[#070707] md:h-[clamp(480px,70vh,760px)]"
      data-testid="glass-footer"
    >
      <div ref={fxHost} className="absolute inset-0" />

      <div className="relative z-10 flex items-start gap-6 px-5 pt-[clamp(28px,7vh,88px)] md:px-10">
        <picture className="shrink-0">
          <source srcSet={navLogoWebp} type="image/webp" />
          <img src={navLogoPng} alt="Manik Rana" width={220} height={147} className="footer-logo h-9 w-auto md:h-14" data-testid="footer-logo" />
        </picture>
        <div className="ml-auto grid w-full max-w-[860px] grid-cols-2 gap-x-[18px] md:w-[64%] md:gap-x-12">
          {[
            { title: 'Navigation', items: NAV },
            { title: 'Social', items: SOCIAL },
          ].map(col => (
            <div key={col.title} className="min-w-0">
              <p className="hf-label">{col.title}</p>
              <ul className="hf-list">
                {col.items.map(it => (
                  <li key={it.label}>
                    <a
                      href={it.href}
                      id={'id' in it ? it.id : undefined}
                      target={'external' in it && it.external ? '_blank' : undefined}
                      rel={'external' in it && it.external ? 'noopener' : undefined}
                    >
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* under the horizon */}
      <div className="hf-bottom absolute inset-x-0 bottom-0 z-10 flex h-[12%] items-center justify-between px-5 md:px-10">
        <p className="hf-copy">&copy; 2026 | Manik Rana</p>
        <div className="hf-legal">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Use</a>
        </div>
      </div>
    </footer>
  )
})
