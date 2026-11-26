import { forwardRef } from 'react';
import { CONTACT_CONFIG as C } from '../config';
import { slotsLine } from '../lib/time';

export function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Fixed on every section of the Contact view. Dark glass with a darkening
// backdrop filter, so it stays legible over the white section too.
export const BookCard = forwardRef<HTMLAnchorElement>(function BookCard(_props, ref) {
  return (
    <a ref={ref} className="ctv2-card" href={C.booking}>
      <span className="ctv2-card__logo" aria-hidden="true">
        {C.initials}
      </span>
      <span className="ctv2-card__text">
        <span className="ctv2-card__title">Book a call</span>
        <span className="ctv2-card__sub">{slotsLine()}</span>
      </span>
      <ArrowUpRight className="ctv2-card__arrow" />
    </a>
  );
});
