import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { NavCluster } from '../contact-v2/nav/FloatingNav';
import { DEFAULT_GAME, GAMES, GAMES_NAV, GAMES_NAV_ACTIVE, LIBRARY_COPY, type Game } from './games.config';
import { FeaturedCover } from './components/FeaturedCover';
import { DetailsPanel } from './components/DetailsPanel';
import { Selector } from './components/Selector';
import { DevNote, MindtierExtras } from './components/Secondary';
import { GamesFooter } from './components/GamesFooter';

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

  // the full-viewport player arrives with stage 2; until then Play only opens external games
  const play = useCallback(() => {
    playRef.current?.click();
  }, []);
  const onPlayLocal = useCallback(() => undefined, []);

  useEffect(() => {
    document.documentElement.classList.add('gm-on');
    return () => document.documentElement.classList.remove('gm-on');
  }, []);

  const secondary = game.kind === 'local' ? <DevNote game={game} /> : <MindtierExtras game={game} />;

  return (
    <div id="ctv2" className="ctv2 gm" style={{ '--gm-accent': game.accent, '--gm-on-accent': game.onAccent } as CSSProperties}>
      <NavCluster show items={GAMES_NAV} active={GAMES_NAV_ACTIVE} />
      <main id="top" className="gm-main ctv2-grain">
        <header className="gm-head">
          <a className="gm-head__home" href="/">
            Manik Rana
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
          <DetailsPanel game={game} onPlay={onPlayLocal} playRef={playRef} secondary={secondary} />
          <Selector games={GAMES} selected={slug} onSelect={select} onPlay={play} />
        </div>
      </main>
      <GamesFooter />
    </div>
  );
}
