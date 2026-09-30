// Settings that the DOM reads directly: reduce-motion (tokens.css shortens
// every duration under :root[data-reduce-motion]) and the UI scale (--ui-scale
// multiplies --u). Idempotent (StrictMode).
import { useSettings } from '../state/settings.store';

let installed = false;

export function installDomSettings(): void {
  if (installed) return;
  installed = true;
  const apply = () => {
    const a = useSettings.getState().accessibility;
    const root = document.documentElement;
    root.dataset.reduceMotion = String(!!a?.reduceMotion);
    root.dataset.reduceFlashing = String(!!a?.reduceFlashing);
    root.style.setProperty('--ui-scale', String(a?.uiScale ?? 1));
  };
  apply();
  useSettings.subscribe((s, prev) => {
    if (s.accessibility !== prev.accessibility) apply();
  });
}
