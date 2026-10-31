// Soft entry for the four nav-grid boxes: each fades and rises as it enters
// the view (staggered). Reduced motion: shown at once, no animation (CSS).
export function enhanceNavgrid(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('.skillsfun-navgrid')
  if (!grid) return
  const boxes = Array.from(grid.querySelectorAll<HTMLElement>('.skillsfun-navgrid__box'))
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    boxes.forEach(b => b.classList.add('is-in'))
    return
  }
  grid.classList.add('is-enhanced')
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        el.style.transitionDelay = `${boxes.indexOf(el) % 2 ? 110 : 0}ms`
        el.classList.add('is-in')
        io.unobserve(el)
      }
    },
    { threshold: 0.18 },
  )
  boxes.forEach(b => io.observe(b))
  return () => io.disconnect()
}
