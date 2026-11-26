import { useCallback, useEffect, useState } from 'react';

export type Currency = 'USD' | 'INR';
const STORAGE_KEY = 'ctv2-currency';

const indiaTimeZone = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta';
  } catch {
    return false;
  }
};

// Which currency to show. Visitors in India see INR, everyone else USD.
// 1. A choice the visitor made with the USD | INR toggle (localStorage) wins.
// 2. Else the country from /api/geo (the host's geo header, see api/geo.mjs).
// 3. Else, if that's unavailable (local dev, other hosts), the browser's time
//    zone: Asia/Kolkata or Asia/Calcutta means INR.
// 4. Else USD.
// With no INR prices configured (hasINR = false) it's always USD and nothing
// is fetched or stored.
export function useCurrency(hasINR: boolean) {
  const [currency, setCurrency] = useState<Currency>('USD');

  useEffect(() => {
    if (!hasINR) return undefined;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked: fall through to detection */
    }
    if (saved === 'USD' || saved === 'INR') {
      setCurrency(saved);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    fetch('/api/geo', { signal: ctrl.signal, headers: { accept: 'application/json' } })
      .then(r => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .then((data: { country?: unknown } | null) => {
        const country = typeof data?.country === 'string' ? data.country : null;
        if (country) setCurrency(country === 'IN' ? 'INR' : 'USD');
        else if (indiaTimeZone()) setCurrency('INR');
      })
      .catch(() => {
        if (indiaTimeZone()) setCurrency('INR');
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [hasINR]);

  const choose = useCallback((next: Currency) => {
    setCurrency(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  }, []);

  return { currency: hasINR ? currency : ('USD' as Currency), choose };
}
