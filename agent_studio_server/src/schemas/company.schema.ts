import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

export type CompanyStatus = 'active' | 'disabled';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'companies',
})
export class Company {
  @Prop({ required: true, unique: true, trim: true })
  companyName: string;

  /** Immutable, system-generated tenant identifier referenced by other collections (User.companyId, etc). */
  @Prop({ required: true, unique: true })
  companyId: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  contactNo: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
  })
  status: CompanyStatus;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
