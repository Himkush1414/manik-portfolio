import { useEffect, useRef } from 'react';

// Shown over the game when the playable slice ends (the game posts { source: 'g1-demo', type: 'end' }
// right after the ship ejects). Back to library = Exit; Replay restarts the game from its first frame.
export function EndCard({ onBack, onReplay }: { onBack: () => void; onReplay: () => void }) {
  const replayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    replayRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="gm-end" role="region" aria-labelledby="gm-end-title" aria-live="polite">
      <div className="gm-end__card">
        <p className="gm-end__eyebrow">Early build · end of the slice</p>
        <h2 id="gm-end-title" className="gm-end__title">To be continued…</h2>
        <p className="gm-end__text">I’m still building this game, so this is only a small slice of it. Thanks for playing!</p>
        <div className="gm-end__actions">
          <button type="button" className="gm-end__btn gm-end__btn--ghost" onClick={onBack}>
            Back to library
          </button>
          <button ref={replayRef} type="button" className="gm-end__btn" onClick={onReplay}>
            Replay
          </button>
        </div>
      </div>
    </div>
  );
}
