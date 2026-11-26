import { CONTACT_CONFIG } from '../config';

const tz = CONTACT_CONFIG.timezone;

const clockFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: tz,
});

export const formatClock = (d: Date) => clockFmt.format(d);

/** Month name in the configured timezone ("Nov" / "November"). */
export const monthName = (style: 'short' | 'long', d = new Date()) =>
  new Intl.DateTimeFormat('en-US', { month: style, timeZone: tz }).format(d);

export const yearNow = () => Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: tz }).format(new Date()));

/** "1 slot left for Nov." / "2 slots left for Nov." / "Fully booked for Nov." */
export function slotsLine() {
  const n = CONTACT_CONFIG.slotsLeft;
  const m = monthName('short');
  if (n <= 0) return `Fully booked for ${m}.`;
  return `${n} slot${n === 1 ? '' : 's'} left for ${m}.`;
}
