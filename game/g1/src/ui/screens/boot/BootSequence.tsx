// Boot sequence DOM layers (brief §8). Pure view: renders the typography and
// loader, reads the loader store, and hands its element refs to the
// choreography via onMount. It never starts timelines itself.
import { useEffect, useRef } from 'react';
import styles from './BootSequence.module.css';
import { useLoader, CHECK_OF, type Check } from '../../../core/loader';
import { TAGLINE } from '../../../data/boot.config';
import { LoaderLog } from './LoaderLog';

export type BootRefs = {
  root: HTMLDivElement;
  logoLayer: HTMLDivElement;
  lockup: HTMLDivElement;
  titleWrap: HTMLDivElement;
  title: HTMLHeadingElement;
  glint: HTMLParagraphElement;
  reflection: HTMLParagraphElement;
  edition: HTMLSpanElement;
  bar: HTMLDivElement;
  signature: HTMLSpanElement;
  creditLayer: HTMLDivElement;
  hairline: HTMLDivElement;
  taglineLayer: HTMLDivElement;
  words: HTMLSpanElement[];
  lbTop: HTMLDivElement;
  lbBottom: HTMLDivElement;
  loaderLayer: HTMLDivElement;
  ring: SVGSVGElement;
  nominal: HTMLSpanElement;
  skip: HTMLDivElement;
};

const TICKS = 72;
const CHECKS: Check[] = ['FONTS', 'GEOMETRY', 'SHADERS', 'AUDIO', 'SAVE'];

function Digit({ value }: { value: number }) {
  return (
    <span className={styles.digit} aria-hidden="true">
      <span className={styles.digitStrip} style={{ transform: `translateY(${-value}em)` }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </span>
    </span>
  );
}

function Percent({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  const digits = v === 100 ? [1, 0, 0] : [Math.floor(v / 10), v % 10];
  return (
    <div className={styles.pct} role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <span className={styles.pctGroup}>
        {digits.map((d, i) => (
          <Digit key={`${digits.length}-${i}`} value={d} />
        ))}
        <span className={styles.pctSign}>%</span>
      </span>
    </div>
  );
}

export function BootSequence({ onMount, displayProgress }: { onMount: (refs: BootRefs) => () => void; displayProgress: number }) {
  const r = useRef<Partial<BootRefs>>({ words: [] });
  const completed = useLoader(s => s.completed);

  useEffect(() => {
    const refs = r.current as BootRefs;
    return onMount(refs);
    // mount once; the choreography owns everything after this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lit = Math.round(displayProgress * TICKS);
  const set = <K extends keyof BootRefs>(k: K) => (el: BootRefs[K] | null) => {
    if (el) (r.current as BootRefs)[k] = el;
  };

  return (
    <div ref={set('root')} className={styles.root} aria-label="SPACE WAR: DARK EDITION — boot sequence">
      <div ref={set('lbTop')} className={`${styles.letterbox} ${styles.lbTop}`} />
      <div ref={set('lbBottom')} className={`${styles.letterbox} ${styles.lbBottom}`} />

      {/* beat 1 — logo lockup */}
      <div ref={set('logoLayer')} className={styles.layer}>
        <div ref={set('lockup')} className={styles.lockup}>
          <div ref={set('titleWrap')} className={styles.titleWrap}>
            <h1 ref={set('title')} className={styles.title} aria-label="SPACE WAR">
              SPACE WAR
            </h1>
            <p ref={set('glint')} className={styles.glint} aria-hidden="true">
              SPACE WAR
            </p>
            <p ref={set('reflection')} className={styles.reflection} aria-hidden="true">
              SPACE WAR
            </p>
            <span ref={set('signature')} className={styles.signature}>
              a game by Manik Rana
            </span>
          </div>
          <div className={styles.editionRow}>
            <span ref={set('edition')} className={styles.edition}>
              Dark Edition
            </span>
            <div ref={set('bar')} className={styles.bar} />
          </div>
        </div>
      </div>

      {/* beat 2 — credit card */}
      <div ref={set('creditLayer')} className={styles.layer}>
        <div className={styles.hex} />
        <div className={styles.card}>
          <span className={`${styles.bracket} ${styles.bTL}`} />
          <span className={`${styles.bracket} ${styles.bTR}`} />
          <span className={`${styles.bracket} ${styles.bBL}`} />
          <span className={`${styles.bracket} ${styles.bBR}`} />
          <span className={styles.creditLabel}>DESIGNED &amp; DEVELOPED BY</span>
          <p className={styles.creditName}>Manik Rana</p>
          <div ref={set('hairline')} className={styles.hairline} />
        </div>
      </div>

      {/* beat 3 — tagline */}
      <div ref={set('taglineLayer')} className={styles.layer}>
        <p className={styles.tagline} aria-label={TAGLINE}>
          {TAGLINE.split(' ').map((w, i) => (
            <span key={i} ref={el => { if (el) (r.current.words as HTMLSpanElement[])[i] = el; }} className={styles.word} aria-hidden="true">
              {w}
            </span>
          ))}
        </p>
      </div>

      {/* beat 4 — loader */}
      <div ref={set('loaderLayer')} className={styles.layer}>
        <div className={styles.loader}>
          <div className={styles.ringWrap}>
            <svg className={styles.outer} viewBox="-150 -150 300 300" aria-hidden="true">
              <circle r="146" fill="none" stroke="rgba(140,154,192,0.28)" strokeWidth="1" strokeDasharray="2 10 34 10" />
              <circle r="138" fill="none" stroke="rgba(255,90,31,0.5)" strokeWidth="1" strokeDasharray="60 800" />
            </svg>
            <svg ref={set('ring')} className={styles.ring} viewBox="-150 -150 300 300" aria-hidden="true">
              {Array.from({ length: TICKS }, (_, i) => {
                const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
                const r0 = i % 6 === 0 ? 108 : 114;
                return (
                  <line
                    key={i}
                    className={`${styles.tick} ${i < lit ? styles.tickOn : ''}`}
                    x1={Math.cos(a) * r0}
                    y1={Math.sin(a) * r0}
                    x2={Math.cos(a) * 126}
                    y2={Math.sin(a) * 126}
                  />
                );
              })}
            </svg>
            <Percent value={displayProgress * 100} />
          </div>
          <div className={styles.loadCol}>
            <p className={styles.loadTitle}>INITIALIZING</p>
            <LoaderLog className={styles.log} lineClass={styles.logLine} caretClass={styles.caret} />
            <div className={styles.checks} aria-label="System checks">
              {CHECKS.map(c => {
                const ok = completed.includes(CHECK_OF[c]);
                return (
                  <div key={c} className={styles.check}>
                    <span>{c}</span>
                    <span className={ok ? styles.checkOk : styles.checkState}>{ok ? 'OK' : '···'}</span>
                  </div>
                );
              })}
            </div>
            <span ref={set('nominal')} className={styles.nominal} role="status">
              ALL SYSTEMS NOMINAL
            </span>
          </div>
        </div>
      </div>

      <div ref={set('skip')} className={styles.skip} aria-hidden="true">
        PRESS <span className={styles.key}>ANY KEY</span> TO SKIP
      </div>
    </div>
  );
}
