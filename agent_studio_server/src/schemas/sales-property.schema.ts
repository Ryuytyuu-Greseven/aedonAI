import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SalesPropertyDocument = HydratedDocument<SalesProperty>;

/**
 * A property listing attached to a sales agent (e.g. for real-estate style
 * agents) — just a name and a free-text description. Anything a listing
 * needs (price, sqft, address, etc.) goes into `description` as text rather
 * than as dedicated fields.
 */
@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'sales_properties',
})
export class SalesProperty {
  @Prop({ type: String, default: null })
  companyId: string | null;

  /** The sales agent this property belongs to (Agent's `agent_id`, not its Mongo `_id`). */
  @Prop({ required: true, index: true })
  agentId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  description: string | null;
}

export const SalesPropertySchema = SchemaFactory.createForClass(SalesProperty);

SalesPropertySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
