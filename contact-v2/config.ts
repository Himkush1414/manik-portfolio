import heroImage from './assets/hero.jpg';

// Every value the Contact view shows that isn't layout. Edit here, nowhere else.
// Values marked "default" were not supplied with the brief and were taken from
// the rest of the site (footer links, existing mailto links).
export type PriceTier = { tier1: string; tier2: string; tier3: string };
/** Optional app price rows (not defined yet): rendered like the website rows. */
export type AppPriceRow = { label: string; desc: string; USD: string; INR?: string };

export const CONTACT_CONFIG = {
  name: 'Manik Rana',
  initials: 'MR', // default: from the name
  heroImage,
  heroImageAlt: 'A lone samurai silhouette walking through tall grass under a pale beam of light',
  heroWord: 'Manik Rana', // default: the name
  tagline: ['Digital work', 'that feels', 'like yours'],
  linkedin: 'https://www.linkedin.com/in/manik-rana-752154277', // default: site footer
  github: 'https://github.com/Himkush1414', // default: site footer
  email: 'manikrana831@gmail.com', // default: site footer / existing Contact view
  // default: no booking page exists yet, so "Book a call" opens an email, the
  // same thing the old Contact view's "Book a Call" button did
  booking: 'mailto:manikrana831@gmail.com?subject=Book%20a%20call',
  timezone: 'Asia/Kolkata',
  slotsLeft: 1, // availability: keep it truthful
  accent: '#E11D2E', // the one-frame flash in the intro (the site has no single accent)
  prices: {
    USD: { tier1: '~$300', tier2: '~$500', tier3: '$700 – $800' } as PriceTier,
    // null = INR prices not set yet: everyone sees USD (see services/useCurrency.ts)
    INR: null as PriceTier | null,
  },
  // Apps are priced by scope. Fill this in to show price rows on the Apps panel.
  appPrices: null as AppPriceRow[] | null,
};

// Section copy (polished defaults from the brief; edit freely).
export const COPY = {
  manifestoChip: 'Contact',
  manifestoHeadline:
    "I don’t build projects that only look good. I build digital products you can truly call your own, that bring your work, your experience and your dreams to life.",
  manifestoP1:
    "Every project starts with a real conversation. I want to understand what you’re building, who it’s for, and what it should make possible for you.",
  manifestoP2:
    "From a focused three-page website to a full product, I design and build with care, so that what you launch connects you with the people you want to reach and with the goals you’re chasing.",
  pricingNote: 'Prices are a starting point, not a wall. If the opportunity is right, the budget can always be discussed.',
  footerStatement: "Have an idea? Let’s make it real.",
};

export type ContactConfig = typeof CONTACT_CONFIG;
