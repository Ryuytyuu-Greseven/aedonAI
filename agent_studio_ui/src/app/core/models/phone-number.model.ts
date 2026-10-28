import { COUNTRY_CODES } from '../../shared/constants/countries.constant';

/** Provisioning = purchase in flight; Released = returned to the provider (kept for history). */
export type PhoneNumberStatus = 'Provisioning' | 'Available' | 'Disabled' | 'Released';

export type PhoneNumberType = 'local' | 'mobile' | 'landline' | 'toll_free';

export interface PhoneNumberCapabilities {
  voice: boolean;
  sms: boolean;
  mms: boolean;
}

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
  friendly_name: string | null;
  iso_country: string | null;
  number_type: PhoneNumberType | null;
  region: string | null;
  capabilities: PhoneNumberCapabilities | null;
  monthly_price: number | null;
  currency: string | null;
  inbound_configured: boolean;
  purchased_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A number a provider currently offers for sale — search result only, never stored. */
export interface AvailablePhoneNumber {
  e164: string;
  friendly_name: string;
  iso_country: string;
  number_type: PhoneNumberType;
  locality: string | null;
  region: string | null;
  capabilities: PhoneNumberCapabilities;
  monthly_price: number | null;
  currency: string | null;
}

export interface AvailablePhoneNumbersResult {
  country: string;
  numbers: AvailablePhoneNumber[];
}

export interface SearchAvailableNumbersQuery {
  country: string;
  type?: PhoneNumberType;
  /** US only. */
  areaCode?: string;
  /** IN only: telecom circle (KA, DL, MH, …). */
  region?: string;
  contains?: string;
  limit?: number;
}

export interface PurchasePhoneNumberInput {
  country: string;
  number: AvailablePhoneNumber;
  label: string;
  notes?: string;
  environmentType: PhoneNumberEnvironmentType;
}

export interface BuyCountry {
  isoCountry: string;
  name: string;
  flag: string;
  dialCode: string;
  numberTypes: readonly PhoneNumberType[];
  /** Which location filter the country's number search supports. */
  locationFilter: 'areaCode' | 'region';
}

/** Countries numbers can be bought in — mirrors the server's TELEPHONY_COUNTRIES. */
export const BUY_COUNTRIES: readonly BuyCountry[] = [
  {
    isoCountry: 'US',
    name: 'United States',
    flag: '🇺🇸',
    dialCode: '+1',
    numberTypes: ['local', 'toll_free'],
    locationFilter: 'areaCode',
  },
  {
    isoCountry: 'IN',
    name: 'India',
    flag: '🇮🇳',
    dialCode: '+91',
    numberTypes: ['mobile'],
    locationFilter: 'region',
  },
] as const;

const NUMBER_TYPE_LABELS: Record<PhoneNumberType, string> = {
  local: 'Local',
  mobile: 'Mobile',
  landline: 'Landline',
  toll_free: 'Toll-free',
};

export function phoneNumberTypeLabel(type: PhoneNumberType | null): string {
  return type ? NUMBER_TYPE_LABELS[type] : '—';
}

/** `₹1,000/mo`, or null when the provider didn't quote a price. */
export function formatMonthlyPrice(price: number | null, currency: string | null): string | null {
  if (price == null || !currency) return null;
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(price);
  return `${formatted}/mo`;
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
