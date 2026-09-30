// HUD primitives (brief §12): reused by every phase. Every interactive one has
// hover / active / focus-visible / disabled states, a correct cursor and a UI
// sound. Styling lives in hud.module.css.
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import type React from 'react';
import s from './hud.module.css';
import { sfx, type SfxName } from '../../audio/sfx';
import { useUi } from '../../state/ui.store';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ panel */
export function HudPanel({ title, meta, className, style, children, corner = true }: { title?: ReactNode; meta?: ReactNode; className?: string; style?: CSSProperties; children?: ReactNode; corner?: boolean }) {
  return (
    <section className={cx(s.panel, className)} style={style} aria-label={typeof title === 'string' ? title : undefined}>
      {corner && <span className={s.panelCorner} aria-hidden />}
      <div className={s.panelInner}>
        {(title || meta) && (
          <header className={s.panelHead}>
            <h2 className={s.panelTitle}>{title}</h2>
            {meta && <span className={s.panelMeta}>{meta}</span>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

export function CornerBrackets({ color, style }: { color?: string; style?: CSSProperties }) {
  return (
    <span className={s.brackets} style={{ color: color ?? 'var(--steel-a60)', ...style }} aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/* ----------------------------------------------------------------- button */
type Variant = 'primary' | 'secondary' | 'icon' | 'ghost' | 'danger';
type HudButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; clickSound?: SfxName | null; tooltip?: string; tipUp?: boolean };

export const HudButton = forwardRef<HTMLButtonElement, HudButtonProps>(function HudButton(
  { variant = 'secondary', clickSound = 'confirm', tooltip, tipUp, className, onClick, onPointerEnter, onFocus, children, ...rest },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type="button"
      className={cx(s.btn, variant !== 'secondary' && s[variant], className)}
      onPointerEnter={e => {
        if (!rest.disabled) sfx.play('hover');
        onPointerEnter?.(e);
      }}
      onFocus={e => {
        sfx.play('hover');
        onFocus?.(e);
      }}
      onClick={e => {
        if (clickSound) sfx.play(clickSound);
        onClick?.(e);
      }}
      aria-label={rest['aria-label'] ?? (variant === 'icon' ? tooltip : undefined)}
      {...rest}
    >
      {children}
    </button>
  );
  return tooltip ? <Tooltip text={tooltip} up={tipUp}>{btn}</Tooltip> : btn;
});

export function Tooltip({ text, up, children }: { text: string; up?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <span className={s.tipWrap} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={cx(s.tip, up && s.tipUp)}>
        {text}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- seg bar */
/** 10-segment bar; `bonus` segments beyond `value` draw as Ice ghosts. */
export function SegBar({ value, bonus = 0, max = 10, hot = false, label }: { value: number; bonus?: number; max?: number; hot?: boolean; label?: string }) {
  const v = Math.round(value), b = Math.round(bonus);
  return (
    <span className={s.seg} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={v} aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={cx(i < v && (hot ? s.hot : s.on), i >= v && i < v + b && s.ghost)} style={{ transitionDelay: `${i * 30}ms` }} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ radar */
export function RadarChart({ values, bonus, labels, size = 150 }: { values: number[]; bonus?: number[]; labels: string[]; size?: number }) {
  const n = values.length, c = size / 2, r = size * 0.36;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * r * (v / 10), c + Math.sin(a) * r * (v / 10)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, Math.min(10, v)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label={labels.map((l, i) => `${l} ${values[i]}`).join(', ')}>
      {[2.5, 5, 7.5, 10].map(k => (
        <polygon key={k} points={poly(values.map(() => k))} fill="none" stroke="rgba(140,154,192,0.18)" strokeWidth={1} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, 10);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(140,154,192,0.14)" />;
      })}
      {bonus && <polygon points={poly(values.map((v, i) => v + (bonus[i] ?? 0)))} fill="rgba(127,209,255,0.08)" stroke="var(--ice)" strokeDasharray="3 3" strokeWidth={1} />}
      <polygon points={poly(values)} fill="rgba(255,90,31,0.18)" stroke="var(--ignition)" strokeWidth={1.5} />
      {labels.map((l, i) => {
        const [x, y] = pt(i, 12.6);
        return (
          <text key={l} x={x} y={y} fill="var(--steel)" fontSize={size * 0.07} fontFamily="var(--font-mono)" textAnchor="middle" dominantBaseline="middle" letterSpacing="0.1em">
            {l}
          </text>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------------- swatch */
/** Arrow-key navigation inside a radiogroup (roving tabindex: one Tab stop). */
export function radioKeys(e: React.KeyboardEvent<HTMLElement>): void {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
  const group = e.currentTarget.closest('[role="radiogroup"]');
  if (!group) return;
  const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
  const i = radios.indexOf(e.target as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const next = radios[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + radios.length) % radios.length];
  next.focus();
  next.click();
}

export function Swatch({ a, b, k, checked, disabled, label, onSelect }: { a: string; b: string; k: string; checked: boolean; disabled?: boolean; label: string; onSelect(): void }) {
  return (
    <Tooltip text={label} up>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        tabIndex={checked ? 0 : -1}
        onKeyDown={radioKeys}
        className={s.swatch}
        style={{ '--a': a, '--b': b, '--k': k } as CSSProperties}
        onPointerEnter={() => !disabled && sfx.play('hover')}
        onClick={() => {
          if (checked) return;
          sfx.play('livery');
          onSelect();
        }}
      >
        <span />
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------- tabs */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange(id: T): void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={s.tabs} role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={el => void (refs.current[i] = el)}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={t.id === value}
          aria-controls={`tabpanel-${t.id}`}
          tabIndex={t.id === value ? 0 : -1}
          className={s.tab}
          onPointerEnter={() => sfx.play('hover')}
          onClick={() => {
            if (t.id !== value) sfx.play('confirm');
            onChange(t.id);
          }}
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            refs.current[j]?.focus();
            onChange(tabs[j].id);
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- currency */
/** Credits with a per-digit roll whenever the value changes. */
export function CurrencyChip({ value }: { value: number }) {
  const text = value.toLocaleString('en-US');
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 600);
    return () => window.clearTimeout(id);
  }, [value]);
  return (
    <span className={cx(s.chip, flash && s.flash)} aria-live="polite" aria-label={`${text} credits`}>
      <span className={s.chipLabel}>CR</span>
      <span className={s.digits} aria-hidden>
        {text.split('').map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={text.length - i} className={s.digit}>
              <span className={s.digitStrip} style={{ transform: `translateY(${-Number(ch)}em)` }}>
                {'0123456789'.split('').map(d => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={`sep${text.length - i}`}>{ch}</span>
          ),
        )}
      </span>
    </span>
  );
}

/* ----------------------------------------------------------- scramble text */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#<>_';
/** Decodes into `text` on mount / when `trigger` changes (instant under reduced motion). */
export function ScrambleText({ text, trigger, duration = 520, className }: { text: string; trigger?: unknown; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduce) {
      setOut(text);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / duration);
      const shown = Math.floor(k * text.length);
      setOut(text.split('').map((ch, i) => (i < shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join(''));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, trigger, duration, reduce]);
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}

/* ----------------------------------------------------------------- keycap */
export function Keycap({ children }: { children: ReactNode }) {
  return <kbd className={s.key}>{children}</kbd>;
}

/* -------------------------------------------------------------- hold button */
/** Hold-to-confirm (pointer or Enter/Space) with a radial fill. */
export function HoldButton({ holdMs = 600, onConfirm, disabled, children, className, variant = 'primary', tooltip }: { holdMs?: number; onConfirm(): void; disabled?: boolean; children: ReactNode; className?: string; variant?: Variant; tooltip?: string }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);
  const begin = () => {
    if (disabled) return;
    cancelAnimationFrame(raf.current);
    start.current = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start.current) / holdMs);
      setP(k);
      if (k >= 1) {
        onConfirm();
        setP(0);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const end = () => {
    cancelAnimationFrame(raf.current);
    setP(0);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const r = 16, C = 2 * Math.PI * r;
  return (
    <HudButton
      variant={variant}
      clickSound={null}
      disabled={disabled}
      className={className}
      tooltip={tooltip}
      tipUp
      onPointerDown={begin}
      onPointerUp={end}
      onPointerLeave={end}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={e => (e.key === 'Enter' || e.key === ' ') && end()}
      onClick={() => disabled && sfx.play('deny')}
    >
      <svg className={s.holdRing} viewBox="0 0 40 40" preserveAspectRatio="none" aria-hidden style={{ opacity: p > 0 ? 1 : 0 }}>
        <circle cx="20" cy="20" r={r} strokeDasharray={C} strokeDashoffset={C * (1 - p)} />
      </svg>
      {children}
    </HudButton>
  );
}

/* ----------------------------------------------------------------- toasts */
export function Toasts() {
  const toasts = useUi(st => st.toasts);
  const dismiss = useUi(st => st.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    const t = toasts[0];
    const id = window.setTimeout(() => dismiss(t.id), 3200);
    return () => window.clearTimeout(id);
  }, [toasts, dismiss]);
  return (
    <div className={s.toasts} role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={s.toast} data-tone={t.tone}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ hooks */
export function useReducedMotion(): boolean {
  const [r, setR] = useState(() => document.documentElement.dataset.reduceMotion === 'true');
  useEffect(() => {
    const obs = new MutationObserver(() => setR(document.documentElement.dataset.reduceMotion === 'true'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduce-motion'] });
    return () => obs.disconnect();
  }, []);
  return r;
}
