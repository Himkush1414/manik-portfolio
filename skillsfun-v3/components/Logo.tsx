// The MR mark in one flat matte off-white (#e8e8e8; a separate recoloured copy,
// logo-white.png, the original file is untouched). No blend modes, filters or
// section-based colour logic: the same colour on every background. A real
// button: back to the very start.
import logoWhitePng from '../assets/logo-white.png'
import logoWhiteWebp from '../assets/logo-white.webp'

export function Logo({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back to start"
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`site-logo fixed left-4 top-4 z-[60] block cursor-pointer rounded-md p-0 outline-none transition-[opacity,transform] duration-700 ease-out hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e8e8e8] md:left-6 md:top-6 ${
        show ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ transitionDuration: '700ms, 250ms' }}
      data-testid="site-logo"
      data-visible={show ? 'true' : 'false'}
    >
      <picture>
        <source srcSet={logoWhiteWebp} type="image/webp" />
        <img src={logoWhitePng} alt="" width={220} height={147} className="block h-8 w-auto md:h-10" draggable={false} />
      </picture>
    </button>
  )
}
