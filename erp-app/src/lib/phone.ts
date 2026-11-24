/**
 * D25 phone rule (copied per app — no shared packages, architecture §2).
 * Ugandan mobile numbers are exactly 10 digits starting `07`; display `0772 123 456`.
 */
export const normaliseUGPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').replace(/^256/, '');
  if (digits.length === 9 && digits.startsWith('7')) return `0${digits}`;
  return digits;
};

export const isValidUGPhone = (value: string): boolean => /^07\d{8}$/.test(normaliseUGPhone(value));

export const formatUGPhone = (value: string): string => {
  const clean = normaliseUGPhone(value).slice(0, 10);
  if (clean.length < 4) return clean;
  return clean.replace(/(\d{4})(\d{3})(\d{0,3})/, (_match, a: string, b: string, c: string) =>
    [a, b, c].filter(Boolean).join(' '),
  );
};

export const maskUGPhone = (value: string): string => {
  const clean = normaliseUGPhone(value);
  if (clean.length < 10) return formatUGPhone(clean);
  return `${clean.slice(0, 4)} ••• ${clean.slice(7)}`;
};

/** Only `tel:`/`sms:`/WhatsApp links use the international form. */
export const toUgE164 = (value: string): string | undefined => {
  const national = normaliseUGPhone(value);
  return /^07\d{8}$/.test(national) ? `+256${national.slice(1)}` : undefined;
};
