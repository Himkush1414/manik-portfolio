import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CONTACT_CONFIG as C, COPY } from '../config';
import { Chip } from '../components/Chip';
import { ArrowUpRight } from '../hero/BookCard';
import { useCurrency, type Currency } from './useCurrency';

const OPTIONS = [
  { id: 'websites', num: '01', name: 'Websites', sub: 'Web pages that convert' },
  { id: 'apps', num: '02', name: 'Apps', sub: 'Mobile & web apps' },
] as const;
type OptionId = (typeof OPTIONS)[number]['id'];

const WEBSITE_ROWS = [
  { label: '3–4 pages', desc: 'Portfolio, landing page or small business site', tier: 'tier1' },
  { label: '5–6 pages', desc: 'Multi-page business site with richer content', tier: 'tier2' },
  { label: '10+ pages', desc: 'Full multi-page website, blog or larger structure', tier: 'tier3' },
] as const;

const APP_FACTORS = [
  { title: 'Platforms', text: 'iOS, Android, the web, or all three.' },
  { title: 'Features', text: 'Accounts, payments, offline use, real-time updates and how many screens it needs.' },
  { title: 'Integrations', text: 'The APIs, payment providers, maps or tools it has to talk to.' },
];

// Matte charcoal section: two options on a vertical hairline with a sliding
// square marker (a WAI-ARIA tablist), and the matching panel on the right.
// Phones: two full-width segments on a horizontal hairline, panel below.
export function Services() {
  const uid = useId();
  const [active, setActive] = useState<OptionId>('websites');
  const tabsRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const hasINR = !!C.prices.INR;
  const { currency, choose } = useCurrency(hasINR);

  const placeMarker = useCallback(() => {
    const tabs = tabsRef.current;
    const marker = markerRef.current;
    const tab = tabs?.querySelector<HTMLElement>(`[data-option="${active}"]`);
    if (!tabs || !marker || !tab) return;
    const horizontal = getComputedStyle(tabs).getPropertyValue('--ctv2-tabs-axis').trim() === 'x';
    marker.style.transform = horizontal
      ? `translate3d(${tab.offsetLeft + tab.offsetWidth / 2 - 7}px, 0, 0)`
      : `translate3d(0, ${tab.offsetTop + tab.offsetHeight / 2 - 7}px, 0)`;
  }, [active]);

  useLayoutEffect(placeMarker, [placeMarker]);
  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return undefined;
    const ro = new ResizeObserver(placeMarker);
    ro.observe(tabs);
    document.fonts?.ready.then(placeMarker).catch(() => undefined);
    return () => ro.disconnect();
  }, [placeMarker]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = OPTIONS.findIndex(o => o.id === active);
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % OPTIONS.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + OPTIONS.length) % OPTIONS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = OPTIONS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(OPTIONS[next].id);
    tabsRef.current?.querySelector<HTMLElement>(`[data-option="${OPTIONS[next].id}"]`)?.focus();
  };

  return (
    <section className="ctv2-svc ctv2-grain" data-ctv2-section="services" aria-labelledby={`${uid}-title`}>
      <header className="ctv2-svc__head">
        <Chip label="Services" tone="dark" />
        <h2 id={`${uid}-title`} className="ctv2-svc__title">
          Pick what you’re building.
        </h2>
      </header>

      <div className="ctv2-svc__grid">
        <div ref={tabsRef} className="ctv2-svc__tabs" role="tablist" aria-label="Services" onKeyDown={onKeyDown}>
          <span className="ctv2-svc__rail" aria-hidden="true">
            <span ref={markerRef} className="ctv2-svc__marker" />
          </span>
          {OPTIONS.map(o => {
            const on = o.id === active;
            return (
              <button
                key={o.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${o.id}`}
                data-option={o.id}
                aria-selected={on}
                aria-controls={`${uid}-panel`}
                tabIndex={on ? 0 : -1}
                className={`ctv2-svc__tab${on ? ' is-on' : ''}`}
                onClick={() => setActive(o.id)}
              >
                <span className="ctv2-svc__num">{o.num}</span>
                <span className="ctv2-svc__name">{o.name}</span>
                <span className="ctv2-svc__sub">{o.sub}</span>
              </button>
            );
          })}
        </div>

        <div
          key={active}
          id={`${uid}-panel`}
          role="tabpanel"
          aria-labelledby={`${uid}-tab-${active}`}
          className="ctv2-svc__panel"
          tabIndex={0}
        >
          {active === 'websites' ? (
            <WebsitePanel currency={currency} hasINR={hasINR} choose={choose} />
          ) : (
            <AppsPanel currency={currency} />
          )}
        </div>
      </div>
    </section>
  );
}

function CurrencyToggle({ currency, choose }: { currency: Currency; choose: (c: Currency) => void }) {
  return (
    <div className="ctv2-seg" role="group" aria-label="Currency">
      {(['USD', 'INR'] as const).map(c => (
        <button key={c} type="button" className={`ctv2-seg__btn${c === currency ? ' is-on' : ''}`} aria-pressed={c === currency} onClick={() => choose(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

function PriceRow({ label, desc, amount, currency }: { label: string; desc: string; amount: string; currency: Currency }) {
  return (
    <li className="ctv2-price__row">
      <div className="ctv2-price__what">
        <p className="ctv2-price__label">{label}</p>
        <p className="ctv2-price__desc">{desc}</p>
      </div>
      {/* keyed by currency, so a change cross-fades instead of jumping */}
      <p key={currency} className="ctv2-price__amt">
        {amount}
      </p>
    </li>
  );
}

function WebsitePanel({ currency, hasINR, choose }: { currency: Currency; hasINR: boolean; choose: (c: Currency) => void }) {
  const prices = (currency === 'INR' && C.prices.INR) || C.prices.USD;
  return (
    <>
      <div className="ctv2-panel__head">
        <h3 className="ctv2-panel__title">Website pricing</h3>
        {/* only offered once INR prices exist (config.ts); until then everyone sees USD */}
        {hasINR && <CurrencyToggle currency={currency} choose={choose} />}
      </div>
      <ul className="ctv2-price">
        {WEBSITE_ROWS.map(r => (
          <PriceRow key={r.tier} label={r.label} desc={r.desc} amount={prices[r.tier]} currency={currency} />
        ))}
      </ul>
      <p className="ctv2-panel__note">{COPY.pricingNote}</p>
      <a className="ctv2-textlink" href={C.booking}>
        Book a call <ArrowUpRight className="ctv2-textlink__arrow" />
      </a>
    </>
  );
}

function AppsPanel({ currency }: { currency: Currency }) {
  const rows = C.appPrices;
  return (
    <>
      <div className="ctv2-panel__head">
        <h3 className="ctv2-panel__title">App pricing</h3>
      </div>
      <p className="ctv2-panel__lead">Every app is scoped to its goals. Let’s talk about yours.</p>
      {rows && rows.length > 0 && (
        <ul className="ctv2-price">
          {rows.map(r => (
            <PriceRow key={r.label} label={r.label} desc={r.desc} amount={(currency === 'INR' && r.INR) || r.USD} currency={currency} />
          ))}
        </ul>
      )}
      <p className="ctv2-panel__sublabel">What shapes the price</p>
      <ul className="ctv2-factors">
        {APP_FACTORS.map(f => (
          <li key={f.title}>
            <span className="ctv2-factors__title">{f.title}</span>
            <span className="ctv2-factors__text">{f.text}</span>
          </li>
        ))}
      </ul>
      <a className="ctv2-btn" href={C.booking}>
        Book a call for a quote <ArrowUpRight className="ctv2-btn__arrow" />
      </a>
    </>
  );
}
