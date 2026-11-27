import { useRef, type KeyboardEvent } from 'react';
import type { Game } from '../games.config';
import { LIBRARY_COPY } from '../games.config';
import { LockIcon } from './icons';

// The game picker: a tablist (arrow keys / Home / End move the selection, Enter plays the selected
// game) followed by the non-interactive "coming soon" placeholder. On phones and tablets the row is a
// horizontal snap carousel (CSS).
export function Selector({ games, selected, onSelect, onPlay }: { games: Game[]; selected: string; onSelect: (slug: string) => void; onPlay: () => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (slug: string) => {
    onSelect(slug);
    const tab = listRef.current?.querySelector<HTMLButtonElement>(`#gm-tab-${slug}`);
    tab?.focus();
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = games.findIndex(g => g.slug === selected);
    const last = games.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Enter') {
      e.preventDefault();
      onPlay();
      return;
    }
    if (next < 0) return;
    e.preventDefault();
    focusTab(games[next].slug);
  };

  return (
    <div className="gm-select">
      <p className="gm-select__line">{LIBRARY_COPY.moreLine}</p>
      <div className="gm-cards">
        <div ref={listRef} className="gm-cards__list" role="tablist" aria-label="Choose a game" onKeyDown={onKeyDown}>
          {games.map(g => {
            const on = g.slug === selected;
            return (
              <button
                key={g.slug}
                id={`gm-tab-${g.slug}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="gm-panel"
                tabIndex={on ? 0 : -1}
                className={`gm-card${on ? ' is-on' : ''}`}
                style={{ ['--card-accent' as string]: g.accent }}
                onClick={() => onSelect(g.slug)}
              >
                <picture className="gm-card__thumb">
                  <source type="image/avif" srcSet={g.cover.thumb.avif} />
                  <img src={g.cover.thumb.webp} alt="" width={640} height={400} loading="lazy" decoding="async" />
                </picture>
                <span className="gm-card__text">
                  <span className="gm-card__title">{g.shortTitle}</span>
                  <span className="gm-card__status">
                    <span className="gm-card__dot" aria-hidden="true" />
                    {g.status === 'live' ? 'Live' : 'Early build'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="gm-card gm-card--soon">
          <span className="gm-card__thumb gm-card__thumb--soon" aria-hidden="true">
            <LockIcon className="gm-card__lock" />
          </span>
          <span className="gm-card__text">
            <span className="gm-card__title">{LIBRARY_COPY.comingSoon}</span>
            <span className="gm-card__status">In the works</span>
          </span>
        </div>
      </div>
    </div>
  );
}
