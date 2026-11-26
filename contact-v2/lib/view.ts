// Tiny external store for "is the Contact view on screen" plus a visit counter.
// lv6-transition.ts shows the view by adding .is-active to #proj-view-contact;
// mount.tsx watches that class and calls setActive(). The counter goes up on
// every entry, so each visit remounts the page and replays the intro.
type Snapshot = { active: boolean; visit: number };

let snap: Snapshot = { active: false, visit: 0 };
const subs = new Set<() => void>();

export function setActive(active: boolean) {
  if (active === snap.active) return;
  snap = { active, visit: active ? snap.visit + 1 : snap.visit };
  document.documentElement.classList.toggle('ctv2-on', active);
  subs.forEach(fn => fn());
}

export const viewStore = {
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  get: () => snap,
};
