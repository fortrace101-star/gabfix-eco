import {
  isValidEmail,
  isValidUGPhone,
  isPhoneOrEmail,
  normaliseUGPhone,
  toUgE164,
} from '@/utils/validation';

describe('D25 phone rule', () => {
  it('stores exactly 10 digits starting 07', () => {
    expect(normaliseUGPhone('0772 123 456')).toBe('0772123456');
    expect(normaliseUGPhone('+256 772 123 456')).toBe('0772123456');
    expect(normaliseUGPhone('772123456')).toBe('0772123456');
  });

  it('rejects the old 9-digit and non-07 forms', () => {
    expect(isValidUGPhone('772123456')).toBe(true); // converted once to 0772123456
    expect(isValidUGPhone('0772123456')).toBe(true);
    expect(isValidUGPhone('077212345')).toBe(false);
    expect(isValidUGPhone('0672123456')).toBe(false);
    expect(isValidUGPhone('+256 772 123 4567')).toBe(false);
  });

  it('builds the international form only for links', () => {
    expect(toUgE164('0772 123 456')).toBe('+256772123456');
    expect(toUgE164('123')).toBeUndefined();
  });

  it('keeps phone-or-email sign-in working', () => {
    expect(isPhoneOrEmail('0772 123 456')).toBe(true);
    expect(isPhoneOrEmail('aisha@gabfix.ug')).toBe(true);
    expect(isPhoneOrEmail('not a login')).toBe(false);
    expect(isValidEmail('aisha@gabfix.ug')).toBe(true);
  });
});
