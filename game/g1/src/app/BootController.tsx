// Mounts the boot overlay while the flow is in boot.*, hands its DOM refs to
// the master timeline, and eases the displayed loader progress toward the
// real progress (the ring never jumps, never runs ahead of reality).
import { useEffect, useRef, useState } from 'react';
import { BootSequence, type BootRefs } from '../ui/screens/boot/BootSequence';
import { runBoot } from './choreo/bootTimeline';
import { useLoader } from '../core/loader';
import { useSettings } from '../state/settings.store';
import { sfx } from '../audio/sfx';

export function BootController({ onDone }: { onDone: () => void }) {
  const [display, setDisplay] = useState(0);
  const shown = useRef(0);
  const lastTick = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = useLoader.getState();
      const real = s.total ? s.done / s.total : 0;
      const next = shown.current + (real - shown.current) * 0.12;
      shown.current = Math.abs(real - next) < 0.002 ? real : next;
      const ticks = Math.round(shown.current * 72);
      if (ticks !== lastTick.current) {
        lastTick.current = ticks;
        sfx.play('loaderTick');
      }
      setDisplay(shown.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMount = (refs: BootRefs) => {
    const st = useSettings.getState();
    const handle = runBoot(refs, {
      reduced: st.accessibility.reduceMotion,
      bootSeen: st.bootSeen,
      onDone: () => {
        useSettings.getState().setBootSeen();
        onDone();
      },
    });
    return () => handle.dispose();
  };

  return <BootSequence onMount={onMount} displayProgress={display} />;
}
