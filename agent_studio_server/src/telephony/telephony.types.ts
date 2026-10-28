export type TelephonyProviderName = 'twilio' | 'exotel';

/** Provider-neutral number types; each country supports a subset. */
export type PhoneNumberType = 'local' | 'mobile' | 'landline' | 'toll_free';

export const PHONE_NUMBER_TYPES: readonly PhoneNumberType[] = [
  'local',
  'mobile',
  'landline',
  'toll_free',
] as const;

export interface NumberCapabilities {
  voice: boolean;
  sms: boolean;
  mms: boolean;
}

export interface SearchNumbersQuery {
  /** ISO 3166 alpha-2, e.g. US / IN. */
  isoCountry: string;
  type: PhoneNumberType;
  /** US only: 3-digit area code. */
  areaCode?: string;
  /** IN only: telecom circle (KA, DL, MH, …). */
  region?: string;
  /** Digits the number must contain. */
  contains?: string;
  limit: number;
}

/** A number the provider currently offers for purchase (never persisted). */
export interface AvailableNumber {
  provider: TelephonyProviderName;
  e164: string;
  friendly_name: string;
  iso_country: string;
  number_type: PhoneNumberType;
  /** City / locality where the provider exposes it (Twilio). */
  locality: string | null;
  /** State (Twilio) or telecom circle (Exotel). */
  region: string | null;
  capabilities: NumberCapabilities;
  /** Monthly rental; null when the provider's search doesn't return it. */
  monthly_price: number | null;
  currency: string | null;
}

export interface PurchaseNumberOptions {
  friendlyName: string;
}

export interface PurchasedNumber {
  provider_sid: string;
  e164: string;
  friendly_name: string;
  capabilities: NumberCapabilities;
  monthly_price: number | null;
  currency: string | null;
  /** True when the provider was told to route inbound calls to our gateway. */
  inbound_configured: boolean;
}

/** One implementation per telephony provider (Twilio, Exotel). */
export interface TelephonyNumbersProvider {
  readonly name: TelephonyProviderName;
  search(query: SearchNumbersQuery): Promise<AvailableNumber[]>;
  purchase(
    e164: string,
    options: PurchaseNumberOptions,
  ): Promise<PurchasedNumber>;
  /** Releases the number back to the provider; a missing number is a no-op. */
  release(providerSid: string): Promise<void>;
}
