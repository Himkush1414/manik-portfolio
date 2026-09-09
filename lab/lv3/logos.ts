import type { InfiniteSpiralItem } from './InfiniteSpiral';

/* Simple monochrome (white) glyphs, hand-drawn as SVG so they need no network
   request and survive the production build. Each renders on a solid-black card
   (see .lv3-spiral styles in lv3.css), GitHub-style. */
const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body}</svg>`
  )}`;

const github = svg(
  '<path fill="#fff" d="M12 .6C5.4.6 0 6 0 12.6c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.6-1.4-5.6-6 0-1.3.5-2.4 1.3-3.3-.2-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.3a11.4 11.4 0 0 1 6 0c2.3-1.6 3.3-1.3 3.3-1.3.7 1.7.3 3 .1 3.3.8.9 1.3 2 1.3 3.3 0 4.6-2.9 5.7-5.6 6 .4.4.8 1.1.8 2.3v3.3c0 .3.2.7.8.6 4.8-1.6 8.2-6.1 8.2-11.4C24 6 18.6.6 12 .6z"/>'
);

const substack = svg(
  '<g fill="#fff"><rect x="3.6" y="3.8" width="16.8" height="3.1"/><rect x="3.6" y="9.4" width="16.8" height="3.1"/><path d="M3.6 15.1 12 20.2l8.4-5.1V15.1z"/></g>'
);

const nextjs = svg(
  '<circle cx="12" cy="12" r="10.3" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M8.3 16.9V7.5l8.2 10M15.9 15.4V7.4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
);

const react = svg(
  '<g fill="none" stroke="#fff" stroke-width="1"><ellipse cx="12" cy="12" rx="10.4" ry="4"/><ellipse cx="12" cy="12" rx="10.4" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10.4" ry="4" transform="rotate(120 12 12)"/></g><circle cx="12" cy="12" r="1.9" fill="#fff"/>'
);

const vite = svg('<path fill="#fff" d="M13.6 2 4 13.3h5.8L8.4 22 20 10.1h-5.9z"/>');

const typescript = svg(
  '<g fill="#fff"><path d="M3.2 5h10.1v2.5H9.5V19H7V7.5H3.2z"/><path d="M20.9 6.7c-.9-.7-2.1-1-3.3-1-1.6 0-2.8.7-2.8 2 0 1.3 1 1.8 2.9 2.4 2.1.6 4 1.4 4 3.8 0 2.1-1.9 3.4-4.5 3.4-1.9 0-3.4-.6-4.5-1.7l1.2-1.8c.9.8 2 1.3 3.3 1.3 1.3 0 2.2-.5 2.2-1.5s-.9-1.4-2.8-2c-2-.6-4-1.4-4-3.8 0-2 1.8-3.4 4.4-3.4 1.6 0 3.1.4 4.2 1.3z"/></g>'
);

const threejs = svg(
  '<path d="M12 2.6 21.2 20.4 2.8 20.4z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 2.6V20.4M12 8 6.6 20.4M12 8l5.4 12.4" fill="none" stroke="#fff" stroke-width="0.7"/>'
);

const nodejs = svg(
  '<path d="M12 2.2 20.6 7v10L12 21.8 3.4 17V7z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 7.3 16.5 10v4L12 16.7 7.5 14v-4z" fill="#fff" opacity="0.92"/>'
);

export const logos: InfiniteSpiralItem[] = [
  { id: 'github', src: github, alt: 'GitHub', label: 'GitHub' },
  { id: 'substack', src: substack, alt: 'Substack', label: 'Substack' },
  { id: 'nextjs', src: nextjs, alt: 'Next.js', label: 'Next.js' },
  { id: 'react', src: react, alt: 'React', label: 'React' },
  { id: 'vite', src: vite, alt: 'Vite', label: 'Vite' },
  { id: 'typescript', src: typescript, alt: 'TypeScript', label: 'TypeScript' },
  { id: 'threejs', src: threejs, alt: 'Three.js', label: 'Three.js' },
  { id: 'nodejs', src: nodejs, alt: 'Node.js', label: 'Node.js' }
];
