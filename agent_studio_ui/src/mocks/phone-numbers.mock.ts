import { PhoneNumber } from '../app/core/models/phone-number.model';

const DAYS = 86400000;

/** Legacy mock data — PhoneNumberService now uses the live API. Kept for local fixtures / tests. */
export const MOCK_PHONE_NUMBERS: PhoneNumber[] = [
  {
    id: 'pn-1',
    country_code: '+1',
    phone_number: '4155550100',
    assigned_agent: 'agent-1',
    label: 'US Support Line',
    notes: 'Primary line for the customer support voice agent.',
    status: 'Available',
    environmentType: 'staging',
    organizationId: null,
    created_at: new Date(Date.now() - 28 * DAYS).toISOString(),
    updated_at: new Date(Date.now() - 28 * DAYS).toISOString(),
  },
  {
    id: 'pn-2',
    country_code: '+1',
    phone_number: '4155550101',
    assigned_agent: null,
    label: 'US Overflow Line',
    notes: '',
    status: 'Available',
    environmentType: 'production',
    organizationId: null,
    created_at: new Date(Date.now() - 20 * DAYS).toISOString(),
    updated_at: new Date(Date.now() - 20 * DAYS).toISOString(),
  },
  {
    id: 'pn-3',
    country_code: '+91',
    phone_number: '9810012345',
    assigned_agent: null,
    label: 'India Sales Line',
    notes: 'Reserved for the sales follow-up agent rollout.',
    status: 'Available',
    environmentType: 'staging',
    organizationId: null,
    created_at: new Date(Date.now() - 18 * DAYS).toISOString(),
    updated_at: new Date(Date.now() - 18 * DAYS).toISOString(),
  },
];
