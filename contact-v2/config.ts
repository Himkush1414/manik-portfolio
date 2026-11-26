import heroImage from './assets/hero.jpg';

// Every value the Contact view shows that isn't layout. Edit here, nowhere else.
// Values marked "default" were not supplied with the brief and were taken from
// the rest of the site (footer links, existing mailto links).
export type PriceTier = { tier1: string; tier2: string; tier3: string };

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
};

export type ContactConfig = typeof CONTACT_CONFIG;
