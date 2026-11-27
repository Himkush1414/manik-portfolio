import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_GAME, GAMES, LIBRARY_COPY, type Game } from './games.config';
import { FeaturedCover } from './components/FeaturedCover';
import { DetailsPanel } from './components/DetailsPanel';
import { Selector } from './components/Selector';
import { DevNote, MindtierExtras } from './components/Secondary';
import { GamesFooter } from './components/GamesFooter';
import { QrBlock } from './components/QrBlock';
import { BackIcon } from './components/icons';
import { GamePlayer, type ExitReason } from './player/GamePlayer';
import { EndCard } from './player/EndCard';
import { exitFullscreen, fullscreenElement, isTouchDevice, lockLandscape, requestFullscreen, unlockOrientation } from './player/screen';

// The selected game survives a reload / shared link as ?game=<slug> (replaceState: no history entries).
function initialSlug() {
  const q = new URLSearchParams(location.search).get('game');
  return GAMES.some(g => g.slug === q) ? (q as string) : DEFAULT_GAME;
}
function rememberSlug(slug: string) {
  const url = new URL(location.href);
  if (slug === DEFAULT_GAME) url.searchParams.delete('game');
  else url.searchParams.set('game', slug);
  history.replaceState(history.state, '', url);
}

export function GamesPage() {
  const [slug, setSlug] = useState(initialSlug);
  const game = GAMES.find(g => g.slug === slug) as Game;
  const playRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  const select = useCallback((s: string) => {
    setSlug(s);
    rememberSlug(s);
  }, []);

  // ---------- player ----------
  const [playing, setPlaying] = useState<Game | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const wasFullscreen = useRef(false);
  const restoreFocus = useRef(false);
  // the space game's slice has ended (it posts a message right after the ejection)
  const [ended, setEnded] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const onGameMessage = useCallback((data: unknown) => {
    const d = data as { source?: string; type?: string } | null;
    if (d?.source === 'g1-demo' && d.type === 'end') setEnded(true);
  }, []);
  const replay = useCallback(() => {
    setEnded(false);
    setRunKey(k => k + 1); // a fresh iframe: the game restarts from its first frame
  }, []);

  /** Play: open the dialog, then (same click) ask for real fullscreen; the fixed layer is the fallback. */
  const openPlayer = useCallback((g: Game) => {
    if (openRef.current) return;
    if (g.kind === 'external' && !g.embeddable) {
      playRef.current?.click(); // new tab (the site refuses to be framed)
      return;
    }
    openRef.current = true;
    wasFullscreen.current = false;
    setEnded(false);
    flushSync(() => setPlaying(g));
    history.pushState({ ...(history.state ?? {}), gmPlayer: g.slug }, '');
    const host = hostRef.current;
    if (host) {
      void requestFullscreen(host).then(ok => {
        wasFullscreen.current = ok && fullscreenElement() === host;
        if (ok && g.orientation === 'landscape' && isTouchDevice()) lockLandscape();
      });
    }
  }, []);

  const closePlayer = useCallback((reason: ExitReason) => {
    if (!openRef.current) return;
    openRef.current = false;
    restoreFocus.current = true;
    setEnded(false);
    setPlaying(null); // unmounts the iframe: the game's document, loops, audio and GL contexts go with it
    unlockOrientation();
    exitFullscreen();
    // leave the history entry the player pushed (Back already did that itself)
    if (reason !== 'back' && history.state?.gmPlayer) history.back();
  }, []);

  // Back, leaving fullscreen (browser Esc / gesture), Esc while the page has focus
  useEffect(() => {
    if (!playing) return undefined;
    const onPop = () => closePlayer('back');
    const onFs = () => {
      if (fullscreenElement()) return;
      if (wasFullscreen.current) closePlayer('fullscreen');
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    const html = document.documentElement;
    html.classList.add('gm-playing');
    // the page behind the dialog: not focusable, not read
    const behind = Array.from(document.querySelectorAll<HTMLElement>('#ctv2 > .gm-main, #ctv2 > .gm-footwrap'));
    behind.forEach(el => el.setAttribute('inert', ''));
    return () => {
      behind.forEach(el => el.removeAttribute('inert'));
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      html.classList.remove('gm-playing');
    };
  }, [playing, closePlayer]);

  // back on the library: same game selected, focus on its Play button
  useEffect(() => {
    if (playing || !restoreFocus.current) return;
    restoreFocus.current = false;
    // removing the focused iframe and leaving fullscreen both drop focus to <body> a moment later,
    // so focus the Play button again once that has settled
    const focusPlay = () => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) playRef.current?.focus({ preventScroll: false });
    };
    playRef.current?.focus({ preventScroll: false });
    const t1 = window.setTimeout(focusPlay, 120);
    const t2 = window.setTimeout(focusPlay, 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [playing]);

  const play = useCallback(() => openPlayer(game), [openPlayer, game]);

  useEffect(() => {
    document.documentElement.classList.add('gm-on');
    return () => document.documentElement.classList.remove('gm-on');
  }, []);

  const secondary = game.kind === 'local' ? <DevNote game={game} /> : <MindtierExtras game={game} qr={<QrBlock game={game} />} />;

  return (
    <div id="ctv2" className="ctv2 gm" style={{ '--gm-accent': game.accent, '--gm-on-accent': game.onAccent } as CSSProperties}>
      <main id="top" className="gm-main ctv2-grain">
        <header className="gm-head">
          <a className="gm-head__home" href="/">
            <BackIcon className="gm-head__back" />
            Back to portfolio
          </a>
          <p className="gm-head__count">
            {LIBRARY_COPY.eyebrow} <span aria-hidden="true">·</span> {String(GAMES.length).padStart(2, '0')} games
          </p>
        </header>
        <div className="gm-intro">
          <h1 className="gm-h1">{LIBRARY_COPY.heading}</h1>
          <p className="gm-intro__text">{LIBRARY_COPY.intro}</p>
        </div>
        <div className="gm-stage">
          <FeaturedCover games={GAMES} selected={slug} />
          <DetailsPanel game={game} onPlay={play} playRef={playRef} secondary={secondary} />
          <Selector games={GAMES} selected={slug} onSelect={select} onPlay={play} />
        </div>
      </main>
      <div className="gm-footwrap">
        <GamesFooter />
      </div>
      <GamePlayer
        ref={hostRef}
        game={playing}
        onExit={closePlayer}
        runKey={runKey}
        onGameMessage={onGameMessage}
        overlay={ended ? <EndCard onBack={() => closePlayer('end-card')} onReplay={replay} /> : null}
      />
    </div>
  );
}
