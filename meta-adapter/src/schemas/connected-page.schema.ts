import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ConnectedPage extends Document {
  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, unique: true, index: true })
  pageId: string;

  @Prop()
  pageName: string;

  @Prop({ required: true })
  accessToken: string; // Encrypt in production (AES-256)

  @Prop({ default: true })
  isActive: boolean;

  // Start time of the last fully successful lead poll; the next poll only
  // asks Meta for leads created after this (minus a small overlap).
  @Prop()
  lastLeadSyncAt?: Date;
}

export const ConnectedPageSchema = SchemaFactory.createForClass(ConnectedPage);
