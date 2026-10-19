import {
  PhoneNumber,
  PhoneNumberEnvironmentType,
  PhoneNumberStatus,
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
  created_at: string;
  updated_at: string;
}

export interface CreatePhoneNumberRequest {
  country_code: string;
  phone_number: string;
  label: string;
  notes?: string;
  envType: PhoneNumberEnvironmentType;
}

export interface AssignAgentRequest {
  assigned_agent: string | null;
}

function toEnvironmentType(value: string | undefined): PhoneNumberEnvironmentType {
  return value === 'production' ? 'production' : 'staging';
}

export function fromApiPhoneNumber(raw: ApiPhoneNumber): PhoneNumber {
  return {
    id: raw.id,
    country_code: raw.country_code,
    phone_number: raw.phone_number,
    assigned_agent: raw.assigned_agent ?? null,
    label: raw.label,
    notes: raw.notes ?? '',
    status: (raw.status === 'Disabled' ? 'Disabled' : 'Available') as PhoneNumberStatus,
    environmentType: toEnvironmentType(raw.envType),
    organizationId: raw.organizationId ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}
