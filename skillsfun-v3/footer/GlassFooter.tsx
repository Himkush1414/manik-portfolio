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
  // same file and in-page viewer (resume-viewer.ts, [data-resume]) as the other footers
  { label: 'Resume', href: '/resume.pdf', resume: true },
]
// brand glyphs, the same paths as the Home footer's (footer-links.css sizes them to the text)
const SOCIAL = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/manik-rana-752154277', external: true, icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z' },
  { label: 'GitHub', href: 'https://github.com/Himkush1414', external: true, icon: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
  { label: 'Gmail', href: 'mailto:manikrana831@gmail.com', icon: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.9.732-1.636 1.636-1.636h.749c.313 0 .618.113.856.32L12 10.09l8.303-6.09c.238-.207.543-.32.856-.32h.749c.904 0 1.636.732 1.636 1.636z' },
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
                      className={'icon' in it ? 'fl-social' : undefined}
                      data-resume={'resume' in it ? '' : undefined}
                      target={'external' in it && it.external ? '_blank' : undefined}
                      rel={'external' in it && it.external ? 'noopener' : undefined}
                    >
                      {'icon' in it && (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d={it.icon} />
                        </svg>
                      )}
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
