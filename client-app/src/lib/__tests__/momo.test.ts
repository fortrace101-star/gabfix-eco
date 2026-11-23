/* eslint-disable @typescript-eslint/no-require-imports */
import {
  formatMomo,
  normalizeMomoInput,
  toStoredMomo,
  validateMomo,
} from '@/lib/momo';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('momo validation', () => {
  it('accepts MTN prefixes for MTN and rejects them for Airtel', () => {
    for (const prefix of ['077', '078', '076', '079']) {
      expect(validateMomo('mtn_momo', `${prefix}1234567`)).toBeNull();
      expect(validateMomo('airtel_money', `${prefix}1234567`)).toBe(
        'Airtel numbers start with 075, 074 or 070. That looks like an MTN number.',
      );
    }
  });

  it('accepts Airtel prefixes for Airtel and rejects them for MTN', () => {
    for (const prefix of ['075', '074', '070']) {
      expect(validateMomo('airtel_money', `${prefix}1234567`)).toBeNull();
      expect(validateMomo('mtn_momo', `${prefix}1234567`)).toBe(
        'MTN numbers start with 077, 078, 076 or 079. That looks like an Airtel number.',
      );
    }
  });

  it('normalizes +256 and 256 forms to local 10 digits', () => {
    expect(normalizeMomoInput('+256 771 234 567')).toBe('0771234567');
    expect(normalizeMomoInput('256771234567')).toBe('0771234567');
  });

  it('rejects numbers that are not MTN or Airtel prefixes', () => {
    expect(validateMomo('mtn_momo', '0711234567')).toBe(
      'MTN numbers start with 077, 078, 076 or 079.',
    );
    expect(validateMomo('airtel_money', '0721234567')).toBe(
      'Airtel numbers start with 075, 074 or 070.',
    );
  });

  it('rejects incomplete numbers', () => {
    expect(validateMomo('mtn_momo', '077123456')).toBe(
      'Enter all 10 digits, for example 0771 234 567.',
    );
  });

  it('round-trips stored and formatted numbers', () => {
    expect(toStoredMomo('0771234567')).toBe('771234567');
    expect(formatMomo('771234567')).toBe('077 123 4567');
    expect(toStoredMomo(`0${formatMomo('771234567').replace(/\s/g, '').slice(1)}`)).toBe(
      '771234567',
    );
  });
});

describe('payment methods store momo rules', () => {
  const loadStore = async () => {
    jest.resetModules();
    const storage = require('@react-native-async-storage/async-storage') as unknown as {
      clear: () => Promise<void>;
    };
    const store = require('@/store/payment-methods') as typeof import('@/store/payment-methods');
    await storage.clear();
    await store.hydratePaymentMethods();
    return store;
  };

  it('does not duplicate a number and keeps MTN and Airtel entries separate', async () => {
    const store = await loadStore();
    const first = store.addMobileMoney('MTN', '0771234567');
    const dup = store.addMobileMoney('MTN', '771234567');
    const airtel = store.addMobileMoney('Airtel', '0751234567');

    expect(dup.id).toBe(first.id);
    expect(airtel.id).not.toBe(first.id);
    expect(airtel.provider).toBe('Airtel');
    expect(first.provider).toBe('MTN');
  });
});
