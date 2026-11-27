import type { ReactNode } from 'react';
import type { ExternalGame, LocalGame } from '../games.config';

/** Space game: the honest in-development note. */
export function DevNote({ game }: { game: LocalGame }) {
  return (
    <div className="gm-note">
      <span className="gm-tag gm-tag--accent">Early build</span>
      <p>{game.devNote}</p>
    </div>
  );
}

/** Mindtier: the phone / Android area (the QR block is passed in as `qr`), then the disclaimer. */
export function MindtierExtras({ game, qr }: { game: ExternalGame; qr?: ReactNode }) {
  return (
    <div className="gm-extras">
      {qr}
      <p className="gm-disclaimer">{game.disclaimer}</p>
    </div>
  );
}
