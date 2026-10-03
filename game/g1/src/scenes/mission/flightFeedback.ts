// What terrain contact and the diegetic ceilings FEEL like (Control / Camera /
// Boundary addendum §3): the sim only emits events + state; this reads the
// event ring with its own cursor once per frame (after the sim steps) and
// turns scrapes / impacts / splashes / close calls into voices + camera
// trauma, and terrain contact into a sustained rumble. The HUD reads `flightFeedback.callout` for the close-call text.
// No allocation per frame.
import { Ev, type EventReader } from '../../game/core/events';
import type { Sim } from '../../game/sim';
import { CONTACT, FLIGHT_FX } from '../../data/mission';
import { CameraShaker } from '../../render/CameraShaker';
import { fovKick } from '../../render/rigs/rigState';
import { sfx } from '../../audio/sfx';

let reader: EventReader | null = null;
let readerSim: Sim | null = null;
let sim: Sim | null = null;

export const flightFeedback = {
  /** close-call callout: seconds left + the score it paid (HUD) */
  callout: 0,
  calloutValue: 0,
  /** extra rumble on top of the world's gusts this frame (MissionDriver adds it) */
  rumble: 0,

  /** per frame, after the sim stepped (the events of this frame); `live` = the sim is running (paused,
   *  dying or completing: no rumble) */
  update(s: Sim, dt: number, live: boolean): void {
    if (readerSim !== s) {
      reader = s.events.reader();
      readerSim = s;
    }
    sim = s;
    this.callout = Math.max(0, this.callout - dt);
    reader?.drain(onEvent);
    const p = s.player, on = live && p.alive;
    this.rumble = on ? p.contact * FLIGHT_FX.contactRumble : 0;
  },

  /** mission end / retry / hangar: drop the callout + rumble */
  reset(): void {
    this.callout = this.rumble = 0;
    reader?.skip();
  },
};

function onEvent(slot: number): void {
  const s = sim;
  if (!s) return;
  const E = s.events;
  switch (E.type[slot]) {
    case Ev.GroundScrape:
      if (E.b[slot] === 1) {
        const k = E.a[slot] / CONTACT.impactMax;
        CameraShaker.addTrauma(FLIGHT_FX.impactTrauma * k);
        sfx.play(k >= FLIGHT_FX.heavyAt ? 'impactHeavy' : 'impact');
      } else {
        CameraShaker.addTrauma(FLIGHT_FX.scrapeTrauma);
        sfx.play('grind');
      }
      break;
    case Ev.Splash:
      CameraShaker.addTrauma(FLIGHT_FX.splashTrauma);
      sfx.play('splash');
      break;
    case Ev.Roll:
      // the barrel roll: a whoosh + a subtle FOV punch (no flash; the vapour ribbons run off the wing tips)
      sfx.play('whoosh');
      fovKick.vel += FLIGHT_FX.rollFovKick;
      break;
    case Ev.CloseCall:
      flightFeedback.callout = FLIGHT_FX.calloutLife;
      flightFeedback.calloutValue = E.b[slot];
      sfx.play('closeCall');
      break;
  }
}
