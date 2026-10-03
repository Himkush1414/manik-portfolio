// Tutorial hints (LevelDef.tutorialHints): which prompt shows now. A hint shows
// from its atM until the player performs its action (or untilM passes); an
// action performed EARLIER retires its hint before it ever shows, so a pilot
// who already flies never sees a prompt. Pure + allocation-free per update.
import type { TutorialAction, TutorialHint } from '../../levels/types';

/** a hint with no untilM auto-dismisses this far past its start (m) */
export const TUTORIAL_SPAN = 900;

export type TutorialPerformed = Record<TutorialAction, boolean>;

export class TutorialTracker {
  private readonly done: TutorialPerformed = { move: false, aim: false, fire: false, roll: false, boost: false };
  private hints: readonly TutorialHint[] = [];
  /** the hint showing now (null = none) */
  current: TutorialHint | null = null;

  reset(hints: readonly TutorialHint[]): void {
    this.hints = hints;
    this.current = null;
    for (const k in this.done) this.done[k as TutorialAction] = false;
  }

  /** s: the player's rail position; performed: what the player did this frame */
  update(s: number, performed: TutorialPerformed): TutorialHint | null {
    for (const k in performed) if (performed[k as TutorialAction]) this.done[k as TutorialAction] = true;
    this.current = null;
    for (const h of this.hints) {
      if (this.done[h.action] || s < h.atM || s >= (h.untilM ?? h.atM + TUTORIAL_SPAN)) continue;
      this.current = h;
      break;
    }
    return this.current;
  }
}
