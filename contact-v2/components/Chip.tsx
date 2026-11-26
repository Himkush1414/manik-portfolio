// Small section label: a rounded square with a dot, then a bold label.
export function Chip({ label, tone = 'light' }: { label: string; tone?: 'light' | 'dark' }) {
  return (
    <p className={`ctv2-chip ctv2-chip--${tone}`}>
      <span className="ctv2-chip__box" aria-hidden="true">
        <span className="ctv2-chip__dot" />
      </span>
      <span className="ctv2-chip__label">{label}</span>
    </p>
  );
}
