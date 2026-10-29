import { isIndianNumber, toE164 } from './phone.util';

describe('toE164', () => {
  it.each([
    ['+919876543210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'], // Exotel national format
    ['9876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['00919876543210', '+919876543210'],
    ['08047491899', '+918047491899'], // landline with STD code
    ['+14155550101', '+14155550101'],
  ])('%s → %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it('returns undefined for empty input', () => {
    expect(toE164('')).toBeUndefined();
    expect(toE164(undefined)).toBeUndefined();
    expect(toE164('abc')).toBeUndefined();
  });
});

describe('isIndianNumber', () => {
  it('detects Indian numbers in any format', () => {
    expect(isIndianNumber('+919876543210')).toBe(true);
    expect(isIndianNumber('09876543210')).toBe(true);
    expect(isIndianNumber('+14155550101')).toBe(false);
    expect(isIndianNumber('')).toBe(false);
  });
});
