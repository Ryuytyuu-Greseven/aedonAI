import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  PHONE_NUMBER_TYPES,
  PhoneNumberType,
  TelephonyProviderName,
} from '../telephony/telephony.types';

export type PhoneNumberDocument = HydratedDocument<PhoneNumber>;

/**
 * Provisioning — purchase in flight (reserves the number against double-buys).
 * Released    — returned to the provider; kept for history, never reusable.
 */
export type PhoneNumberStatus =
  | 'Provisioning'
  | 'Available'
  | 'Disabled'
  | 'Released';
export type PhoneNumberEnvType = 'staging' | 'production';

export const PHONE_NUMBER_STATUSES: readonly PhoneNumberStatus[] = [
  'Provisioning',
  'Available',
  'Disabled',
  'Released',
] as const;

@Schema({ _id: false })
export class PhoneNumberCapabilities {
  @Prop({ type: Boolean, default: false })
  voice: boolean;

  @Prop({ type: Boolean, default: false })
  sms: boolean;

  @Prop({ type: Boolean, default: false })
  mms: boolean;
}

const PhoneNumberCapabilitiesSchema = SchemaFactory.createForClass(
  PhoneNumberCapabilities,
);

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'phone_numbers',
})
export class PhoneNumber {
  @Prop({ type: String, default: null })
  companyId: string | null;

  /** Dial code, e.g. `+91`. */
  @Prop({ required: true, trim: true })
  country_code: string;

  /** National number without the dial code. */
  @Prop({ required: true, trim: true })
  phone_number: string;

  /** `country_code + phone_number`; the lookup key for routing. */
  @Prop({ type: String, default: null })
  e164: string | null;

  /** Null only for legacy, manually-entered numbers. */
  @Prop({ type: String, enum: ['twilio', 'exotel', null], default: null })
  provider: TelephonyProviderName | null;

  /** Twilio `PN…` sid / Exotel ExoPhone sid; null while Provisioning. */
  @Prop({ type: String, default: null })
  provider_sid: string | null;

  @Prop({ type: String, default: null })
  friendly_name: string | null;

  /** ISO 3166 alpha-2, e.g. `US`, `IN`. */
  @Prop({ type: String, default: null })
  iso_country: string | null;

  @Prop({ type: String, enum: [...PHONE_NUMBER_TYPES, null], default: null })
  number_type: PhoneNumberType | null;

  /** State (Twilio) or telecom circle (Exotel). */
  @Prop({ type: String, default: null })
  region: string | null;

  @Prop({ type: PhoneNumberCapabilitiesSchema, default: null })
  capabilities: PhoneNumberCapabilities | null;

  @Prop({ type: Number, default: null })
  monthly_price: number | null;

  @Prop({ type: String, default: null })
  currency: string | null;

  /** Whether the provider routes inbound calls on this number to our gateway. */
  @Prop({ type: Boolean, default: false })
  inbound_configured: boolean;

  @Prop({ type: Date, default: null })
  purchased_at: Date | null;

  /** userId of the admin who bought it. */
  @Prop({ type: String, default: null })
  purchased_by: string | null;

  @Prop({ type: Date, default: null })
  released_at: Date | null;

  @Prop({ type: String, default: null })
  assigned_agent: string | null;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ type: String, default: '' })
  notes: string;

  @Prop({
    required: true,
    type: String,
    enum: PHONE_NUMBER_STATUSES,
    default: 'Available',
  })
  status: PhoneNumberStatus;

  @Prop({
    required: true,
    type: String,
    enum: ['staging', 'production'],
    default: 'production',
  })
  envType: PhoneNumberEnvType;

  @Prop({ type: String, default: null })
  organizationId: string | null;
}

export const PhoneNumberSchema = SchemaFactory.createForClass(PhoneNumber);

// One active row per number; Released rows drop out so the same number can be
// bought again later. Replaces the old unique { country_code, phone_number }
// index (dropped by scripts/migrate-phone-numbers-to-providers.ts).
PhoneNumberSchema.index(
  { e164: 1 },
  {
    unique: true,
    partialFilterExpression: {
      e164: { $type: 'string' },
      released_at: { $type: 'null' },
    },
  },
);
PhoneNumberSchema.index(
  { provider: 1, provider_sid: 1 },
  {
    unique: true,
    partialFilterExpression: { provider_sid: { $type: 'string' } },
  },
);
PhoneNumberSchema.index({ companyId: 1, created_at: -1 });

PhoneNumberSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
