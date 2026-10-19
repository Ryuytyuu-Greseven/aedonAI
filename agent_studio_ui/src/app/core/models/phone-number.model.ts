import { COUNTRY_CODES } from '../../shared/constants/countries.constant';

export type PhoneNumberStatus = 'Available' | 'Disabled';

export type PhoneNumberEnvironmentType = 'staging' | 'production';

export const PHONE_NUMBER_ENVIRONMENT_TYPES: readonly PhoneNumberEnvironmentType[] = [
  'staging',
  'production',
] as const;

export interface PhoneNumber {
  id: string;
  country_code: string;
  phone_number: string;
  assigned_agent: string | null;
  label: string;
  notes: string;
  status: PhoneNumberStatus;
  environmentType: PhoneNumberEnvironmentType;
  organizationId: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestPhoneNumberInput {
  country_code: string;
  phone_number: string;
  label: string;
  notes?: string;
  environmentType: PhoneNumberEnvironmentType;
}

export function phoneNumberEnvironmentLabel(environmentType: PhoneNumberEnvironmentType): string {
  return environmentType === 'production' ? 'Production' : 'Staging';
}

export function phoneNumberE164(phoneNumber: PhoneNumber): string {
  return `${phoneNumber.country_code}${phoneNumber.phone_number}`;
}

export function phoneNumberCountryName(phoneNumber: PhoneNumber): string {
  return COUNTRY_CODES.find((c) => c.code === phoneNumber.country_code)?.name ?? phoneNumber.country_code;
}

export function phoneNumberMatchesSearch(phoneNumber: PhoneNumber, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const e164 = phoneNumberE164(phoneNumber).toLowerCase();
  return (
    e164.includes(query) ||
    phoneNumber.phone_number.toLowerCase().includes(query) ||
    phoneNumber.label.toLowerCase().includes(query) ||
    (phoneNumber.notes ?? '').toLowerCase().includes(query) ||
    phoneNumberCountryName(phoneNumber).toLowerCase().includes(query)
  );
}

export function phoneNumberDisplayLabel(phoneNumber: PhoneNumber): string {
  return `${phoneNumberE164(phoneNumber)} · ${phoneNumber.label}`;
}

/** Digits (and optional leading +) only — strips spaces/dashes from user input. */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

/**
 * Split a user-entered number into national digits given a selected dial code.
 * Accepts either national (`9876543210`) or full E.164 (`+919876543210`).
 */
export function toNationalNumber(countryCode: string, rawInput: string): string {
  const cleaned = normalizePhoneDigits(rawInput.trim());
  if (cleaned.startsWith(countryCode)) {
    return cleaned.slice(countryCode.length);
  }
  if (cleaned.startsWith('+')) {
    return cleaned.replace(/^\+\d{1,3}/, '');
  }
  return cleaned.replace(/^\+/, '');
}
