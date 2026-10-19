import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PhoneNumberDocument = HydratedDocument<PhoneNumber>;

export type PhoneNumberStatus = 'Available' | 'Disabled';
export type PhoneNumberEnvType = 'staging' | 'production';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'phone_numbers',
})
export class PhoneNumber {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true, trim: true })
  country_code: string;

  @Prop({ required: true, trim: true })
  phone_number: string;

  @Prop({ type: String, default: null })
  assigned_agent: string | null;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ type: String, default: '' })
  notes: string;

  @Prop({
    required: true,
    type: String,
    enum: ['Available', 'Disabled'],
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

PhoneNumberSchema.index({ country_code: 1, phone_number: 1 }, { unique: true });

PhoneNumberSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
