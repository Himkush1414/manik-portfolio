import { memo, useState } from 'react';
import CrystalizedBall from '../components/CrystalizedBall';

function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

// The orb, in its black dock to the left of the nav pill. memo + no props:
// nothing the page does (clock ticks, scroll, nav hover) can re-render it.
// Decorative (aria-hidden, pointer-events: none on the dock); the orb itself
// listens to window pointer events for its hover/click reactions.
// CrystalizedBall and its props below are used exactly as supplied; only the
// wrapper's height is adapted (100% instead of the demo 600px).
//
// Why the .ctv2-orb__stage around it: the orb's look depends on its pixel
// size. With the frozen particleCount (15000) in a 56–96 px dock, the dust
// is ~35x denser than in the 600 px demo and adds up to a flat white disc.
// The stage lays the orb out at 4x the dock (224–384 px, close to the
// demo's density) and scales it down with a CSS transform, so it reads as
// designed. Side effect: the orb maps pointer positions in its unscaled
// size, so its (decorative) hover reaction is off-centre on the small dock.
export const OrbDock = memo(function OrbDock() {
  const [webgl2] = useState(hasWebGL2);
  return (
    <div className="ctv2-orb" aria-hidden="true">
      {webgl2 ? (
        <div className="ctv2-orb__stage">
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <CrystalizedBall
            preset="plasma"
            color="#94a3b8"
            size={0.7}
            crackle={0.75}
            fill={0.5}
            interactive
            hoverStrength={0.7}
            strands={6}
            flares={0.65}
            glow={0.9}
            sparks={0.6}
            particleCount={15000}
            motion="rise"
            particleShape="square"
            depth={0.6}
            sway={0.5}
            twinkle={0.5}
            haze={0.7}
            dustSpeed={1}
            speed={1}
            intro
            paused={false}
        />
        </div>
        </div>
      ) : (
        <span className="ctv2-orb__fallback" />
      )}
    </div>
  );
});
