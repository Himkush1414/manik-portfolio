// Small inline icons for the library (decorative: aria-hidden, the text next to them carries the meaning).
type P = { className?: string };

export const PlayIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" fill="currentColor" />
  </svg>
);

export const BackIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ExternalIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LockIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="5.5" y="10.5" width="13" height="9" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const CloseIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const AndroidIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M7 9.5h10a1 1 0 0 1 1 1V17a1.5 1.5 0 0 1-1.5 1.5H16V21a1 1 0 0 1-2 0v-2.5h-4V21a1 1 0 0 1-2 0v-2.5h-.5A1.5 1.5 0 0 1 6 17v-6.5a1 1 0 0 1 1-1zM7.2 8.5a4.9 4.9 0 0 1 9.6 0zM9.5 6.6a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2zm5 0a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2zM8.6 3.6l1 1.6m5.8-1.6-1 1.6M3.5 10.5v5m17-5v5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
