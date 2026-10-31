import { createRoot } from 'react-dom/client'
import './sf3.css'
import { SkillsFunV3 } from './SkillsFunV3'

// Mounts the Skills & Fun view into the page's #skillsfun-root, the view
// container lv6-transition.ts shows/hides (the Skills tab, its strip transition
// and every exit keep working through it). Lazy: main.tsx imports this module
// on idle, or straight away when the page opens on #skills / the Skills link is
// used first.
const host = document.getElementById('skillsfun-root')
if (host && !host.querySelector('[data-sf3-mount]')) {
  const mountEl = document.createElement('div')
  mountEl.dataset.sf3Mount = ''
  host.appendChild(mountEl)
  const backRef: { current: (() => void) | null } = { current: null }
  createRoot(mountEl).render(<SkillsFunV3 backRef={backRef} />)

  // every visit starts at the tube light: when the view is entered again
  // (lv6-transition.ts adds .is-active under its covered transition), go back to
  // the start, which replays the full ignition
  let active = host.classList.contains('is-active')
  new MutationObserver(() => {
    const now = host.classList.contains('is-active')
    if (now && !active) backRef.current?.()
    active = now
  }).observe(host, { attributes: true, attributeFilter: ['class'] })
}
