// Shared scroll-lock coordinator. More than one independent feature on this
// page needs to lock the root document's own scroll while it's active — the
// mobile hamburger menu, and the About<->Home transition — and each was
// independently setting document.documentElement.style.overflow directly,
// with no idea the other existed. Selecting "About" from the hamburger menu
// auto-closes that menu a beat later (main.tsx's own click handler,
// `setTimeout(() => toggle.click(), 10)`), which fires the menu's own
// onMenuClose -> lockScroll(false) — landing AFTER the About transition's
// own lockRootScroll(true) and silently undoing it, leaving the root
// scrollable (and vulnerable to the scroll-chaining bug this exists to
// prevent) even though About is now open.
//
// Reference-counted by a string key instead: the root only ever actually
// unlocks once every locker that asked for it has released its own hold,
// so one feature's unlock can never undo a lock another feature still
// needs.
const locks = new Set<string>();

export function setScrollLock(key: string, on: boolean) {
  if (on) locks.add(key);
  else locks.delete(key);
  document.documentElement.style.overflow = locks.size > 0 ? 'hidden' : '';
}
