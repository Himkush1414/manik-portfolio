import { forwardRef, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Game } from '../games.config';
import { CloseIcon } from '../components/icons';
import { isPortrait, isTouchDevice } from './screen';

export type ExitReason = 'button' | 'escape' | 'back' | 'fullscreen' | 'end-card';

type Props = {
  game: Game | null;
  onExit: (reason: ExitReason) => void;
  /** extra layers over the game (stage 3: the demo end card) */
  overlay?: ReactNode;
  /** bumping it remounts the game from scratch (Replay) */
  runKey?: number;
  /** messages posted by the game's own page (same origin) */
  onGameMessage?: (data: unknown) => void;
  /** the game's iframe (pause / resume messages) */
  frameRef?: React.MutableRefObject<HTMLIFrameElement | null>;
};

// The full-viewport player. The host element is always in the DOM (hidden while closed), so the page
// can call requestFullscreen() on it synchronously from the Play click. The game itself is an iframe
// that exists only while the player is open: removing it ends the game's document, which stops its
// animation frames, timers, audio, WebGL contexts and listeners in one step.
export const GamePlayer = forwardRef<HTMLDivElement, Props>(function GamePlayer({ game, onExit, overlay, runKey = 0, onGameMessage, frameRef }, hostRef) {
  const open = !!game;
  const exitRef = useRef<HTMLButtonElement>(null);
  const ownFrame = useRef<HTMLIFrameElement | null>(null);
  const frame = frameRef ?? ownFrame;
  const landscapeGame = game?.orientation === 'landscape';
  const local = game?.kind === 'local';
  const [portraitBlock, setPortraitBlock] = useState(false);
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  // rotate prompt: landscape games on touch devices wait for landscape before they start
  useEffect(() => {
    if (!open) {
      setStarted(false);
      setLoaded(false);
      setSlow(false);
      setPortraitBlock(false);
      return undefined;
    }
    const check = () => {
      const block = !!landscapeGame && isTouchDevice() && isPortrait();
      setPortraitBlock(block);
      if (!block) setStarted(true);
    };
    check();
    const mq = window.matchMedia('(orientation: portrait)');
    mq.addEventListener?.('change', check);
    window.addEventListener('resize', check);
    return () => {
      mq.removeEventListener?.('change', check);
      window.removeEventListener('resize', check);
    };
  }, [open, landscapeGame]);

  // pause while the rotate prompt covers a running game, resume on landscape (the game listens; see
  // game/g1/src/app/demo.ts)
  useEffect(() => {
    if (!started) return;
    frame.current?.contentWindow?.postMessage({ source: 'gm-player', cmd: portraitBlock ? 'pause' : 'resume' }, location.origin);
  }, [portraitBlock, started, frame]);

  // Replay / a fresh run: wait for the new document again
  useEffect(() => {
    setLoaded(false);
    setSlow(false);
  }, [runKey]);

  // slow-load note after 12 s (the game streams its assets; nothing is wrong, it is just big)
  useEffect(() => {
    if (!started || loaded) return undefined;
    const t = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(t);
  }, [started, loaded, runKey]);

  // messages from the game's page (same origin only)
  useEffect(() => {
    if (!open || !onGameMessage) return undefined;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      onGameMessage(e.data);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [open, onGameMessage, frame]);

  // Esc while the game has focus: the iframe is same origin, so listen in its window too
  const onFrameLoad = useCallback(() => {
    setLoaded(true);
    const win = frame.current?.contentWindow;
    if (!win) return;
    try {
      win.addEventListener(
        'keydown',
        e => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            onExit('escape');
          }
        },
        { capture: true },
      );
    } catch {
      /* cross-origin (embedded external game): Esc then reaches the page only when it has focus */
    }
    frame.current?.focus();
  }, [onExit, frame]);

  // focus trap inside the dialog (the iframe takes over Tab while it has focus)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onExit('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const host = e.currentTarget;
    const items = Array.from(host.querySelectorAll<HTMLElement>('button:not([disabled]), [href], iframe')).filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (open) exitRef.current?.focus({ preventScroll: true });
  }, [open]);

  const src = game ? (game.kind === 'local' ? game.src : game.playUrl) : '';
  const portraitFrame = !!game && game.kind === 'external';

  return (
    <div
      ref={hostRef}
      className={`gm-player${portraitFrame ? ' gm-player--portrait' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={game ? `${game.title}, playing` : 'Game player'}
      hidden={!open}
      onKeyDown={onKeyDown}
      style={game ? ({ ['--gm-accent' as string]: game.accent } as React.CSSProperties) : undefined}
    >
      {open && (
        <>
          <div className="gm-player__stage">
            {started && (
              <iframe
                key={runKey}
                ref={frame}
                className="gm-player__frame"
                src={src}
                title={game.title}
                allow={local ? 'autoplay; gamepad' : 'fullscreen; autoplay'}
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={onFrameLoad}
              />
            )}
            {started && !loaded && (
              <div className="gm-player__loading" role="status">
                <span className="gm-player__spinner" aria-hidden="true" />
                <span>{slow ? 'Still loading. The game is large, thanks for waiting.' : `Loading ${game.shortTitle}…`}</span>
              </div>
            )}
          </div>
          {portraitBlock && (
            <div className="gm-rotate" role="alert" aria-live="assertive">
              <span className="gm-rotate__phone" aria-hidden="true">
                <span className="gm-rotate__screen" />
              </span>
              <p className="gm-rotate__title">Rotate your phone</p>
              <p className="gm-rotate__text">{game.title} plays in landscape. {started ? 'The game is paused until you turn your phone sideways.' : 'It starts as soon as you turn your phone sideways.'}</p>
            </div>
          )}
          {overlay}
          <button ref={exitRef} type="button" className="gm-exit" onClick={() => onExit('button')}>
            <CloseIcon className="gm-exit__icon" />
            <span>Exit</span>
          </button>
        </>
      )}
    </div>
  );
});
