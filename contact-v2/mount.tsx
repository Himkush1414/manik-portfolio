import { createRoot } from 'react-dom/client';
import './contact.css';
import { ContactV2 } from './ContactV2';
import { setActive } from './lib/view';

// Mounts the Contact view into #proj-view-contact, the container
// lv6-transition.ts already shows/hides (it adds .is-active under its covered
// strip transition, or straight away on a direct /#contact load). Watching
// that class is the only hook needed: lv6-transition.ts is unchanged.
const host = document.getElementById('proj-view-contact');
if (host && !host.querySelector('[data-ctv2-mount]')) {
  const mountEl = document.createElement('div');
  mountEl.dataset.ctv2Mount = '';
  host.prepend(mountEl);
  createRoot(mountEl).render(<ContactV2 />);

  const sync = () => setActive(host.classList.contains('is-active'));
  new MutationObserver(sync).observe(host, { attributes: true, attributeFilter: ['class'] });
  sync();
}
