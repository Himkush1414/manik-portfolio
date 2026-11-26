// GET /api/geo -> {"country":"IN"} (or {"country":null})
//
// Used only by the Contact view's pricing (contact-v2/services/useCurrency.ts)
// to show INR to visitors in India and USD to everyone else. It reads the
// two-letter country code the hosting edge already attaches to every request
// (Vercel: x-vercel-ip-country; Cloudflare: cf-ipcountry). No third-party
// API, no key, and nothing is logged, stored or set: the response is just
// that code, marked private and uncacheable.
export function GET(request) {
  const raw = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || '';
  const country = /^[A-Z]{2}$/.test(raw) ? raw : null;
  return new Response(JSON.stringify({ country }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
}
