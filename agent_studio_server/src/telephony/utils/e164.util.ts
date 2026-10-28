/**
 * Normalizes a provider- or user-supplied number to E.164 (`+<digits>`).
 * Bare national numbers (with or without a trunk `0`) get `dialCode` prefixed.
 */
export function toE164(raw: string, dialCode: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  const dialDigits = dialCode.replace('+', '');
  const national = cleaned.replace(/^0+/, '');
  if (cleaned.length > 10 && cleaned.startsWith(dialDigits)) {
    return `+${cleaned}`;
  }
  return `${dialCode}${national}`;
}

/** National significant number for a known dial code (`+919876543210` → `9876543210`). */
export function nationalNumber(e164: string, dialCode: string): string {
  return e164.startsWith(dialCode) ? e164.slice(dialCode.length) : e164;
}
