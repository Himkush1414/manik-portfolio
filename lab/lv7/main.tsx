import { createRoot } from 'react-dom/client';
import { SiReact, SiNextdotjs, SiTypescript, SiTailwindcss, SiSupabase, SiVite, SiVercel } from 'react-icons/si';
import LogoLoop, { type LogoItem } from './LogoLoop';
import './lv7-transition';
import './lv7-nav';
import './lv7-projects';
import './lv7-cursor-trail';

console.log('%clab/lv7 build 2026-09-12 (Projects page)', 'color:#111;font-weight:600;background:#E3E1DC;padding:2px 6px');

// ---- Logo strip: the honest tech-stack set inferred from Manik's own repos
// (see chat reply — this is a suggested default, not a confirmed list).
// Recoloured flat #111111 (react-icons defaults to size:1em, so it already
// inherits LogoLoop's own --logoloop-logoHeight via font-size). ----
const ICON_COLOR = '#111111';
const techLogos: LogoItem[] = [
  { node: <SiReact color={ICON_COLOR} />, title: 'React', ariaLabel: 'React' },
  { node: <SiNextdotjs color={ICON_COLOR} />, title: 'Next.js', ariaLabel: 'Next.js' },
  { node: <SiTypescript color={ICON_COLOR} />, title: 'TypeScript', ariaLabel: 'TypeScript' },
  { node: <SiTailwindcss color={ICON_COLOR} />, title: 'Tailwind CSS', ariaLabel: 'Tailwind CSS' },
  { node: <SiSupabase color={ICON_COLOR} />, title: 'Supabase', ariaLabel: 'Supabase' },
  { node: <SiVite color={ICON_COLOR} />, title: 'Vite', ariaLabel: 'Vite' },
  { node: <SiVercel color={ICON_COLOR} />, title: 'Vercel', ariaLabel: 'Vercel' },
];

const logoLoopMount = document.getElementById('lv7-logoloop-mount');
if (logoLoopMount) {
  createRoot(logoLoopMount).render(
    <LogoLoop
      logos={techLogos}
      speed={55}
      direction="left"
      logoHeight={72}
      gap={64}
      hoverSpeed={0}
      scaleOnHover
      fadeOut
      fadeOutColor="#E3E1DC"
      ariaLabel="Tech stack"
    />
  );
}

// ==========================================================================
// Contact form — no backend exists anywhere on the site (the same kind of
// client-only, no-op pattern the rest of the site's forms use), so this
// matches that rather than inventing a fake endpoint: validate, then show a
// confirmation state.
// ==========================================================================
const contactForm = document.getElementById('lv7-contact-form') as HTMLFormElement | null;
if (contactForm) {
  const submitBtn = contactForm.querySelector<HTMLButtonElement>('.lv7-form__submit');
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!contactForm.reportValidity()) return;
    contactForm.classList.add('is-sent');
    if (submitBtn) submitBtn.textContent = "Thanks — I'll be in touch.";
    setTimeout(() => {
      contactForm.reset();
      contactForm.classList.remove('is-sent');
      if (submitBtn) submitBtn.textContent = 'Send message';
    }, 3200);
  });
}
