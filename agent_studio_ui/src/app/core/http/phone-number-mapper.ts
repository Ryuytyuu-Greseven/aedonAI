import {
  AvailablePhoneNumber,
  AvailablePhoneNumbersResult,
  PhoneNumber,
  PhoneNumberCapabilities,
  PhoneNumberEnvironmentType,
  PhoneNumberProvider,
  PhoneNumberStatus,
  PhoneNumberType,
} from '../models/phone-number.model';

export interface ApiPhoneNumber {
  id: string;
  country_code: string;
  phone_number: string;
  assigned_agent: string | null;
  label: string;
  notes?: string;
  status: PhoneNumberStatus | string;
  envType?: PhoneNumberEnvironmentType | string;
  organizationId?: string | null;
  provider?: PhoneNumberProvider | null;
  provider_sid?: string | null;
  friendly_name?: string | null;
  iso_country?: string | null;
  number_type?: PhoneNumberType | null;
  region?: string | null;
  capabilities?: Partial<PhoneNumberCapabilities> | null;
  monthly_price?: number | null;
  currency?: string | null;
  inbound_configured?: boolean;
  purchased_at?: string | null;
  released_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiAvailablePhoneNumber {
  provider: PhoneNumberProvider;
  e164: string;
  friendly_name: string;
  iso_country: string;
  number_type: PhoneNumberType;
  locality: string | null;
  region: string | null;
  capabilities: Partial<PhoneNumberCapabilities> | null;
  monthly_price: number | null;
  currency: string | null;
}

export interface ApiAvailablePhoneNumbersResponse {
  country: string;
  provider: PhoneNumberProvider;
  numbers: ApiAvailablePhoneNumber[];
}

/** Body for `POST /phone-numbers/purchase` (admin only). */
export interface PurchasePhoneNumberRequest {
  country: string;
  phone_number: string;
  number_type?: PhoneNumberType;
  region?: string;
  label: string;
  notes?: string;
  envType: PhoneNumberEnvironmentType;
}

export interface AssignAgentRequest {
  assigned_agent: string | null;
}

const STATUSES: readonly PhoneNumberStatus[] = ['Provisioning', 'Available', 'Disabled', 'Released'];

function toEnvironmentType(value: string | undefined): PhoneNumberEnvironmentType {
  return value === 'production' ? 'production' : 'staging';
}

function toStatus(value: string): PhoneNumberStatus {
  return (STATUSES as readonly string[]).includes(value) ? (value as PhoneNumberStatus) : 'Available';
}

function toCapabilities(raw: Partial<PhoneNumberCapabilities> | null | undefined): PhoneNumberCapabilities {
  return { voice: !!raw?.voice, sms: !!raw?.sms, mms: !!raw?.mms };
}

export function fromApiPhoneNumber(raw: ApiPhoneNumber): PhoneNumber {
  return {
    id: raw.id,
    country_code: raw.country_code,
    phone_number: raw.phone_number,
    assigned_agent: raw.assigned_agent ?? null,
    label: raw.label,
    notes: raw.notes ?? '',
    status: toStatus(raw.status),
    environmentType: toEnvironmentType(raw.envType),
    organizationId: raw.organizationId ?? null,
    provider: raw.provider ?? null,
    provider_sid: raw.provider_sid ?? null,
    friendly_name: raw.friendly_name ?? null,
    iso_country: raw.iso_country ?? null,
    number_type: raw.number_type ?? null,
    region: raw.region ?? null,
    capabilities: raw.capabilities ? toCapabilities(raw.capabilities) : null,
    monthly_price: raw.monthly_price ?? null,
    currency: raw.currency ?? null,
    inbound_configured: !!raw.inbound_configured,
    purchased_at: raw.purchased_at ?? null,
    released_at: raw.released_at ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function fromApiAvailablePhoneNumbers(raw: ApiAvailablePhoneNumbersResponse): AvailablePhoneNumbersResult {
  return {
    country: raw.country,
    provider: raw.provider,
    numbers: raw.numbers.map(
      (n): AvailablePhoneNumber => ({
        ...n,
        locality: n.locality ?? null,
        region: n.region ?? null,
        capabilities: toCapabilities(n.capabilities),
        monthly_price: n.monthly_price ?? null,
        currency: n.currency ?? null,
      }),
    ),
  };
}
