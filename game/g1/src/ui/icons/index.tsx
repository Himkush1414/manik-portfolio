// Angular line icons (drawn for the HUD language — no icon-font glyphs).
// 24-unit grid, 1.6 stroke, square caps; colour = currentColor.
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true };

export const IconUpgrade = () => (
  <svg {...base}>
    <path d="M5 13 L12 6 L19 13" />
    <path d="M5 19 L12 12 L19 19" />
  </svg>
);
export const IconSettings = () => (
  <svg {...base}>
    <path d="M12 2.5 L14 5.2 L17.4 4.6 L18.1 8 L21 9.8 L19.6 12 L21 14.2 L18.1 16 L17.4 19.4 L14 18.8 L12 21.5 L10 18.8 L6.6 19.4 L5.9 16 L3 14.2 L4.4 12 L3 9.8 L5.9 8 L6.6 4.6 L10 5.2 Z" />
    <path d="M9.5 9.5 H14.5 V14.5 H9.5 Z" />
  </svg>
);
export const IconAudio = ({ muted }: { muted: boolean }) => (
  <svg {...base}>
    <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" />
    {muted ? (
      <path d="M16 9 L21 15 M21 9 L16 15" />
    ) : (
      <>
        <path d="M16.5 9.5 Q18 12 16.5 14.5" />
        <path d="M18.8 7 Q21.8 12 18.8 17" />
      </>
    )}
  </svg>
);
export const IconFullscreen = ({ on }: { on: boolean }) => (
  <svg {...base}>
    {on ? <path d="M9 4 V9 H4 M15 4 V9 H20 M9 20 V15 H4 M15 20 V15 H20" /> : <path d="M4 9 V4 H9 M20 9 V4 H15 M4 15 V20 H9 M20 15 V20 H15" />}
  </svg>
);
export const IconLock = () => (
  <svg {...base}>
    <path d="M6 11 H18 V20 H6 Z" />
    <path d="M8.5 11 V8 L10 5.5 H14 L15.5 8 V11" />
    <path d="M12 14.5 V16.5" />
  </svg>
);
export const IconRadar = () => (
  <svg {...base}>
    <path d="M12 3 L20.5 9.2 L17.3 19.3 H6.7 L3.5 9.2 Z" />
    <path d="M12 8 L16 11 L14.5 16 H9.5 L8 11 Z" />
  </svg>
);
export const IconBars = () => (
  <svg {...base}>
    <path d="M4 7 H20 M4 12 H15 M4 17 H18" />
  </svg>
);
export const IconCheck = () => (
  <svg {...base}>
    <path d="M5 12.5 L10 17 L19 7" />
  </svg>
);
