import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NeonStage, type StageCtl } from '../effects/neon/NeonStage'
import { prefersReducedMotion, useNearViewport } from '../lib/hooks'
import { GlassFooter } from '../footer/GlassFooter'
import { enhanceNavgrid } from '../skillsfun/navgrid'
// Read-only copies of the portfolio's Skills & Fun "Move Next" view, split
// so its first screen can be the thing the iris reveals.
import page2Html from '../skillsfun/page2.html?raw'
import restHtmlRaw from '../skillsfun/rest.html?raw'
import portraitPng from '../../skillsfun-portrait.png'
import portraitWebp from '../../skillsfun-portrait.webp'
import logoWhitePng from '../assets/logo-white.png'
import aboutMePng from '../assets/about-me.png'
import projectsPng from '../assets/projects.png'
// (styles: ../sf3.css, loaded by ../mount.tsx; fonts: the page's global fonts.css)

// the copied markup's image paths, pointed at Vite-processed assets
const restHtml = restHtmlRaw
  .replace('./skillsfun-portrait.webp', portraitWebp)
  .replace('./skillsfun-portrait.png', portraitPng)
  .replace('/logo-white.png', logoWhitePng)
  .replace('/navgrid/about-me.png', aboutMePng)
  .replace('/navgrid/projects.png', projectsPng)

// The section's Contact buttons. The site's lv6-transition.ts binds these ids
// once at page load, before this view is mounted, so route them the way every
// other Contact link on the site goes: through a[href="#contact"], which its
// document-level click handler turns into the Contact view.
const CONTACT_IDS = '#skillsfun-page2-contact, #skillsfun-about-cta, #skillsfun-navgrid-connect'
function goToContact(from: HTMLElement) {
  const a = document.createElement('a')
  a.href = '#contact'
  a.hidden = true
  from.appendChild(a)
  a.click()
  a.remove()
}

// scroll runway after the viewport pins, in viewport heights
const FADE_VH = 2.5 // the light dies
const HOLD_VH = 0.3 // pure black
const IRIS_VH = 2.0 // the iris opens
const IRIS_SETTLE = 0.84 // fully open at 84% of the iris runway
const SMOOTH = 0.14 // lerp per 60fps frame
const IRIS_ZOOM = 1.14
const IRIS_SCRIM = 0.34
const FEATHER = 0.14

const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

// 'neon': tube stage -> fade -> black hold -> iris (the scroll runway)
// 'section': the iris has fully opened; the neon stage, its runway and the
// black hold are gone, the page starts at the top of the real section, and
// scrolling up stops there. Only backToStart() (the logo) returns to 'neon'.
type Mode = 'neon' | 'section'

let sectionScriptsStarted = false
function startSectionScripts() {
  if (sectionScriptsStarted) return
  sectionScriptsStarted = true
  void import('../skillsfun/skillsfun-page2').then(m => m.startPage2())
  void import('../skillsfun/skillsfun-about').then(m => m.startAbout())
}

export function NeonToSkillsFun({ onRevealed, backRef }: { onRevealed: () => void; backRef: React.MutableRefObject<(() => void) | null> }) {
  const runwayRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const restRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const ctl = useRef<StageCtl>({ p: 0 })
  const near = useNearViewport(runwayRef, '40% 0px')
  const [mode, setMode] = useState<Mode>('neon')
  const [handedOff, setHandedOff] = useState(false)
  // scroll position to restore right after a mode switch (before paint)
  const pendingScroll = useRef<number | null>(null)

  useEffect(() => enhanceNavgrid(restRef.current!), [])

  useEffect(() => {
    const root = rootRef.current!
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(CONTACT_IDS)
      if (!btn || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      goToContact(root)
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  // the logo: back to the very start, from either mode
  useEffect(() => {
    backRef.current = () => {
      if (mode === 'section') {
        pendingScroll.current = 0
        setHandedOff(false)
        setMode('neon') // the stage remounts: black, then the full ignition
      } else {
        window.scrollTo(0, 0)
        ctl.current.relight?.()
      }
    }
  }, [mode, backRef])

  useLayoutEffect(() => {
    if (pendingScroll.current === null) return
    window.scrollTo(0, pendingScroll.current)
    pendingScroll.current = null
  }, [mode])

  // section mode: the first screen is simply the page
  useLayoutEffect(() => {
    if (mode !== 'section') return
    const slot = slotRef.current!
    const page = slot.querySelector<HTMLElement>('#skillsfun-page2')!
    const scrim = slot.querySelector<HTMLElement>('[data-scrim]')!
    slot.style.webkitMaskImage = 'none'
    slot.style.maskImage = 'none'
    slot.style.visibility = 'visible'
    slot.style.pointerEvents = ''
    page.style.transform = ''
    scrim.style.opacity = '0'
  }, [mode])

  useEffect(() => {
    if (mode !== 'neon') return
    const runway = runwayRef.current!
    const slot = slotRef.current!
    const page = slot.querySelector<HTMLElement>('#skillsfun-page2')!
    const scrim = slot.querySelector<HTMLElement>('[data-scrim]')!
    const reduced = prefersReducedMotion()
    let raf = 0
    let last = 0
    let p = -1
    let e = -1
    let done = false

    const targets = () => {
      const r = runway.getBoundingClientRect()
      const vh = window.innerHeight
      const scrolled = -r.top
      const pT = Math.min(1, Math.max(0, scrolled / (FADE_VH * vh)))
      const irisRaw = (scrolled - (FADE_VH + HOLD_VH) * vh) / (IRIS_VH * vh)
      return { pT, eT: Math.min(1, Math.max(0, irisRaw / IRIS_SETTLE)) }
    }

    const applyIris = (v: number) => {
      const W = slot.clientWidth
      const H = slot.clientHeight
      const full = Math.hypot(W / 2, H / 2) / (1 - FEATHER) + 2
      if (v <= 0.0001) {
        slot.style.visibility = 'hidden'
        slot.style.pointerEvents = 'none'
        return
      }
      const radius = full * easeInOutCubic(Math.min(1, v))
      const f = Math.max(2, radius * FEATHER)
      const mask = `radial-gradient(circle at 50% 50%, #000 ${Math.max(0, radius - f).toFixed(1)}px, transparent ${radius.toFixed(1)}px)`
      slot.style.visibility = 'visible'
      slot.style.pointerEvents = 'none'
      slot.style.webkitMaskImage = mask
      slot.style.maskImage = mask
      page.style.transform = `scale(${(IRIS_ZOOM + (1 - IRIS_ZOOM) * v).toFixed(4)})`
      scrim.style.opacity = String(IRIS_SCRIM * (1 - v))
    }

    const tick = (now: number) => {
      raf = 0
      if (done) return
      const { pT, eT } = targets()
      // real elapsed time, so a long frame never stalls the scrub
      const dt = last ? Math.min(0.5, (now - last) / 1000) : 1 / 60
      last = now
      const k = 1 - Math.pow(1 - SMOOTH, dt * 60)
      p = p < 0 || reduced ? pT : p + (pT - p) * k
      e = e < 0 || reduced ? eT : e + (eT - e) * k
      if (Math.abs(pT - p) < 0.0005) p = pT
      if (Math.abs(eT - e) < 0.0005) e = eT
      ctl.current.p = p
      // the section's own scripts start once the light is dying, never during the reveal
      if (pT > 0.6) startSectionScripts()
      ctl.current.wake?.()
      if (import.meta.env.DEV) (window as unknown as { __scrub?: number[] }).__scrub = [p, e]
      if (e >= 0.9999) {
        // fully open: hand off for good. Keep the page where it is on screen,
        // minus everything above it that is about to be removed.
        done = true
        const k2 = Math.max(0, -page.getBoundingClientRect().top)
        pendingScroll.current = runway.getBoundingClientRect().top + window.scrollY + k2
        setHandedOff(true)
        setMode('section')
        return
      }
      applyIris(e)
      if (p !== pT || e !== eT) raf = requestAnimationFrame(tick)
      else last = 0
    }
    const kick = () => {
      if (!raf && !done) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', kick, { passive: true })
    window.addEventListener('resize', kick)
    kick()
    return () => {
      done = true
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', kick)
      window.removeEventListener('resize', kick)
    }
  }, [mode])

  const neon = mode === 'neon'
  return (
    // the page's own #skillsfun-root is the view container (lv6-transition.ts toggles it)
    <div ref={rootRef} className="sf3" data-sf3-root data-mode={mode}>
      <div
        ref={runwayRef}
        className="relative bg-black"
        style={{ height: neon ? `${(1 + FADE_VH + HOLD_VH + IRIS_VH) * 100}vh` : '100vh' }}
        data-testid="runway"
      >
        {/* one pinned viewport for both layers, so they unpin together at the hand-off */}
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
          {neon && <NeonStage ctl={ctl} active={near && !handedOff} onRevealed={onRevealed} />}
          <div
            ref={slotRef}
            className="lab-page2-slot absolute inset-0 z-[2] overflow-hidden"
            style={{ visibility: 'hidden', pointerEvents: 'none' }}
            data-testid="iris-slot"
          >
            <div dangerouslySetInnerHTML={{ __html: page2Html }} className="contents" />
            <div data-scrim className="pointer-events-none absolute inset-0 z-[30] bg-black" style={{ opacity: IRIS_SCRIM }} />
          </div>
        </div>
      </div>
      <div ref={restRef} dangerouslySetInnerHTML={{ __html: restHtml }} />
      <GlassFooter />
    </div>
  )
}
