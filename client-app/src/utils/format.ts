import { normaliseUGPhone } from './validation';

const withThousands = (value: string): string =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** UGX 45,000 — no decimals, thousands separator (Part 1, Section 3). */
export const ugx = (amount: number): string => {
  const rounded = Math.round(amount);
  const formatted =
    typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function'
      ? new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(rounded)
      : withThousands(String(rounded));
  return `UGX ${formatted}`;
};

/** 0772 777 773 — D25 display form (10 digits, leading `07`). */
export const phoneUG = (digits: string): string => {
  const clean = normaliseUGPhone(digits).slice(0, 10);
  if (clean.length < 4) return clean;
  return clean.replace(/(\d{4})(\d{3})(\d{0,3})/, (_match, a: string, b: string, c: string) =>
    [a, b, c].filter(Boolean).join(' '),
  );
};

/** 0772 ••• 773 — used on the OTP and reset screens (D25). */
export const maskPhone = (digits: string): string => {
  const clean = normaliseUGPhone(digits);
  if (clean.length < 10) return phoneUG(clean);
  return `${clean.slice(0, 4)} ••• ${clean.slice(7)}`;
};

export const dateLong = (date: Date): string =>
  date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Kampala',
  });

export const time12 = (date: Date): string =>
  date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Kampala',
    })
    .toLowerCase();

export const hoursLabel = (hours: number): string =>
  `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;

export const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);
