export interface CountryCode {
  value: string;
  dialCode: string;
  label: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { value: 'US', dialCode: '+1', label: 'US +1' },
  { value: 'IN', dialCode: '+91', label: 'IN +91' },
  { value: 'AE', dialCode: '+971', label: 'AE +971' },
  { value: 'TH', dialCode: '+66', label: 'TH +66' },
  { value: 'GB', dialCode: '+44', label: 'GB +44' },
  { value: 'EU', dialCode: '+49', label: 'EU +49' },
];

export const PHONE_NUMBER_MIN_DIGITS = 6;
export const PHONE_NUMBER_MAX_DIGITS = 12;

export function isValidPhoneNumber(number: string): boolean {
  return new RegExp(`^\\d{${PHONE_NUMBER_MIN_DIGITS},${PHONE_NUMBER_MAX_DIGITS}}$`).test(number.trim());
}

/** Resolves a `COUNTRY_CODES` `value` (e.g. `US`) to its dial code (e.g. `+1`). */
export function toDialCode(countryCode: string): string {
  return COUNTRY_CODES.find((c) => c.value === countryCode)?.dialCode ?? countryCode;
}
