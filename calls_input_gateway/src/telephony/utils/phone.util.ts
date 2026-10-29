const INDIA_COUNTRY_CODE = '91';

/**
 * Normalises a phone number to E.164 (`+919876543210`).
 *
 * Twilio and Agent.phone_number already use E.164, but Exotel reports Indian
 * numbers in national form (`09876543210`, sometimes bare `9876543210`), and
 * Agent lookups are exact-match — so every number is brought to one shape.
 * Numbers without a country code are assumed Indian.
 */
export function toE164(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return undefined;

  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+${INDIA_COUNTRY_CODE}${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+${INDIA_COUNTRY_CODE}${digits}`;
  return `+${digits}`;
}

export function isIndianNumber(raw?: string | null): boolean {
  return toE164(raw)?.startsWith(`+${INDIA_COUNTRY_CODE}`) ?? false;
}
