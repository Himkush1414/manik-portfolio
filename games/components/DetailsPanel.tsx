import type { ReactNode, Ref } from 'react';
import type { Game } from '../games.config';
import { ExternalIcon, PlayIcon } from './icons';

// Right column on desktop, below the cover on phones: title, tagline, tags, specifications,
// description, the Play button and the game's secondary block.
export function DetailsPanel({ game, onPlay, playRef, secondary }: { game: Game; onPlay: () => void; playRef: Ref<HTMLButtonElement & HTMLAnchorElement>; secondary?: ReactNode }) {
  const external = game.kind === 'external' && !game.embeddable;
  return (
    <section id="gm-panel" className="gm-detail" role="tabpanel" aria-labelledby={`gm-tab-${game.slug}`} key={game.slug}>
      <h2 className="gm-title">{game.title}</h2>
      <p className="gm-tagline">{game.tagline}</p>
      <ul className="gm-tags" aria-label="Tags">
        {game.tags.map(t => (
          <li key={t} className={`gm-tag${t === 'Early build' ? ' gm-tag--accent' : ''}`}>
            {t}
          </li>
        ))}
      </ul>

      <dl className="gm-specs" aria-label="Specifications">
        {game.specs.map(s => (
          <div key={s.label} className="gm-specs__row">
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="gm-desc">
        {game.description.map(p => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>

      <div className="gm-playwrap">
        {external ? (
          <>
            <a ref={playRef} className="gm-play" href={game.playUrl} target="_blank" rel="noopener noreferrer" aria-describedby="gm-play-note">
              <PlayIcon className="gm-play__icon" />
              <span>Play {game.shortTitle}</span>
              <ExternalIcon className="gm-play__ext" />
            </a>
            <p id="gm-play-note" className="gm-play__note">
              Opens in a new tab
            </p>
          </>
        ) : (
          <>
            <button ref={playRef} type="button" className="gm-play" onClick={onPlay} aria-describedby="gm-play-note">
              <PlayIcon className="gm-play__icon" />
              <span>Play {game.shortTitle}</span>
            </button>
            <p id="gm-play-note" className="gm-play__note">
              {game.orientation === 'landscape' ? 'Plays fullscreen, best in landscape. Exit any time.' : 'Plays fullscreen. Exit any time.'}
            </p>
          </>
        )}
      </div>

      {secondary}
    </section>
  );
}
