export type MomoNetwork = 'mtn_momo' | 'airtel_money';

export const momoPrefixes: Record<MomoNetwork, readonly string[]> = {
  mtn_momo: ['077', '078', '076', '079'],
  airtel_money: ['075', '074', '070'],
};

/** Local form with leading 0, max 10 digits. Accepts +256 and 256 prefixes. */
export const normalizeMomoInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('256') ? `0${digits.slice(3)}` : digits;
  return local.slice(0, 10);
};

export const networkOfNumber = (local: string): MomoNetwork | null =>
  (Object.keys(momoPrefixes) as MomoNetwork[]).find((n) =>
    momoPrefixes[n].some((p) => local.startsWith(p)),
  ) ?? null;

export const validateMomo = (network: MomoNetwork, local: string): string | null => {
  if (local.length < 10) return 'Enter all 10 digits, for example 0771 234 567.';
  if (networkOfNumber(local) === network) return null;
  const other = networkOfNumber(local);
  const base =
    network === 'mtn_momo'
      ? 'MTN numbers start with 077, 078, 076 or 079.'
      : 'Airtel numbers start with 075, 074 or 070.';
  return other
    ? `${base} That looks like ${other === 'mtn_momo' ? 'an MTN' : 'an Airtel'} number.`
    : base;
};

/** 0771234567 -> 771234567 (the shape `SavedMobileMoney.phone` already uses). */
export const toStoredMomo = (local: string): string => local.replace(/^0/, '');
export const formatMomo = (stored: string): string =>
  `0${stored.slice(0, 2)} ${stored.slice(2, 5)} ${stored.slice(5)}`;
