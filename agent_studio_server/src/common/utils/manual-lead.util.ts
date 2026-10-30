const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 120;

/** India's day boundary decides when the same number may be added again. */
const LEAD_DAY_TIME_ZONE = 'Asia/Kolkata';

export interface ManualLeadFields {
  fullName: string;
  phoneNumber: string;
  email: string;
}

/**
 * E.164 for a number as typed: `+…` is kept, a bare 10-digit number is taken
 * as Indian (+91). Anything else needs its country code spelled out → null.
 */
export function normalizeLeadPhone(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const cleaned = String(raw).replace(/[\s\-().]/g, '');
  if (E164.test(cleaned)) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  return null;
}

/** Validates one manual lead row. Only the phone number is required. */
export function validateManualLead(raw: unknown): {
  lead: ManualLeadFields;
  errors: string[];
} {
  const row = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
  if (fullName.length > MAX_NAME_LENGTH) {
    errors.push(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  const rawPhone =
    typeof row.phoneNumber === 'string' || typeof row.phoneNumber === 'number'
      ? String(row.phoneNumber).trim()
      : '';
  const phoneNumber = normalizeLeadPhone(rawPhone);
  if (!rawPhone) errors.push('Phone number is required');
  else if (!phoneNumber) {
    errors.push(
      'Phone number needs a country code (e.g. +44…); only 10-digit numbers default to +91',
    );
  }

  const email = typeof row.email === 'string' ? row.email.trim() : '';
  if (email && !EMAIL.test(email)) errors.push('Email is not valid');

  return {
    lead: { fullName, phoneNumber: phoneNumber ?? rawPhone, email },
    errors,
  };
}

/** `YYYY-MM-DD` in IST — the day a manual lead counts against for duplicates. */
export function manualLeadDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LEAD_DAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
