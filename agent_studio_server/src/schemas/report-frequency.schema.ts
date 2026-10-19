import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReportFrequencyDocument =
  HydratedDocument<ReportFrequencyPreference>;
export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

@Schema({ collection: 'report_frequency_preferences' })
export class ReportFrequencyPreference {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true, unique: true, index: true })
  agent_id: string;

  @Prop({ required: true, type: String, enum: ['daily', 'weekly', 'monthly'] })
  frequency: ReportFrequency;
}

export const ReportFrequencyPreferenceSchema = SchemaFactory.createForClass(
  ReportFrequencyPreference,
);
