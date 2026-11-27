// Fullscreen + orientation helpers for the player. Every call is best effort: unsupported APIs
// (iPhone Safari has no element fullscreen; desktop has no orientation lock) resolve to false and the
// player falls back to its fixed 100dvh layer.
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

export function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Must be called synchronously inside the click handler (transient user activation). */
export function requestFullscreen(el: HTMLElement): Promise<boolean> {
  const e = el as FsElement;
  try {
    if (e.requestFullscreen) return e.requestFullscreen({ navigationUI: 'hide' }).then(() => true, () => false);
    if (e.webkitRequestFullscreen) return Promise.resolve(e.webkitRequestFullscreen()).then(() => true, () => false);
  } catch {
    /* fall through */
  }
  return Promise.resolve(false);
}

export function exitFullscreen(): void {
  const d = document as FsDocument;
  if (!fullscreenElement()) return;
  try {
    if (d.exitFullscreen) void d.exitFullscreen().catch(() => undefined);
    else void d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

/** Landscape lock (Android Chrome in fullscreen). Ignored everywhere it isn't supported. */
export function lockLandscape(): void {
  const o = screen.orientation as LockableOrientation | undefined;
  try {
    void o?.lock?.('landscape').catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function unlockOrientation(): void {
  const o = screen.orientation as LockableOrientation | undefined;
  try {
    o?.unlock?.();
  } catch {
    /* ignore */
  }
}

/** A touch-first device (phones / tablets): only these get the rotate prompt. */
export const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;
export const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;
