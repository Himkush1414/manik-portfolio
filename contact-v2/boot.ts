// Lazy loader for the Contact view (imported once by main.tsx). The view's
// code, CSS, font and image load on idle after the page's own load, or right
// away if the page opens on /#contact or the view is shown before that.
export {};

const host = document.getElementById('proj-view-contact');
if (host) {
  let started = false;
  const load = () => {
    if (started) return;
    started = true;
    void import('./mount');
  };

  if (location.hash === '#contact' || host.classList.contains('is-active')) load();
  const watcher = new MutationObserver(() => {
    if (host.classList.contains('is-active')) {
      watcher.disconnect();
      load();
    }
  });
  watcher.observe(host, { attributes: true, attributeFilter: ['class'] });

  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  const onLoad = () => (idle ? idle(load, { timeout: 2500 }) : window.setTimeout(load, 300));
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
}
