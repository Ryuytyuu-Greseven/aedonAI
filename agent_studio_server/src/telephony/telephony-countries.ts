import { PhoneNumberType, TelephonyProviderName } from './telephony.types';

export interface TelephonyCountry {
  isoCountry: string;
  /** Dial code in the same `+NN` form phone_numbers.country_code stores. */
  dialCode: string;
  provider: TelephonyProviderName;
  numberTypes: readonly PhoneNumberType[];
}

/** Which provider sells numbers for which country. */
export const TELEPHONY_COUNTRIES: Record<string, TelephonyCountry> = {
  US: {
    isoCountry: 'US',
    dialCode: '+1',
    provider: 'twilio',
    numberTypes: ['local', 'toll_free'],
  },
  IN: {
    isoCountry: 'IN',
    dialCode: '+91',
    provider: 'exotel',
    numberTypes: ['landline', 'mobile', 'toll_free'],
  },
};

export const SUPPORTED_TELEPHONY_COUNTRIES = Object.keys(TELEPHONY_COUNTRIES);
