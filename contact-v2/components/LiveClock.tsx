import { memo, useEffect, useState } from 'react';
import { CONTACT_CONFIG } from '../config';
import { formatClock } from '../lib/time';

// Isolated on purpose: this is the only thing that re-renders every second,
// so nothing else (above all the orb) ever re-renders because of the time.
export const LiveClock = memo(function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(new Date());
      // re-align to the next whole second so the display never drifts
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <time className={className} dateTime={now.toISOString()} title={`Local time (${CONTACT_CONFIG.timezone})`}>
      {formatClock(now)}
    </time>
  );
});
