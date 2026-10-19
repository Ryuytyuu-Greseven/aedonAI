import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { KnowledgeItemEmbeddingStatus } from '../common/interfaces/knowledge-base-embedding.interface';

export type KnowledgeBaseDocument = HydratedDocument<KnowledgeBase>;

export type KnowledgeItemStatus = 'active' | 'disabled';

@Schema({ _id: false })
export class KnowledgeBaseFile {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true })
  file_id: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  uploaded_date: Date;

  @Prop({ required: true })
  cloud_file_path: string;

  @Prop({ required: true })
  filesize: number;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
  })
  status: KnowledgeItemStatus;

  @Prop({
    required: true,
    type: String,
    enum: ['pending', 'completed', 'failed', 'not_applicable'],
    default: 'pending',
  })
  embedding_status: KnowledgeItemEmbeddingStatus;
}
export const KnowledgeBaseFileSchema =
  SchemaFactory.createForClass(KnowledgeBaseFile);

@Schema({ _id: false })
export class KnowledgeBaseUrl {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true })
  url_id: string;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  uploaded_date: Date;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
  })
  status: KnowledgeItemStatus;

  @Prop({
    required: true,
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  embedding_status: KnowledgeItemEmbeddingStatus;
}
export const KnowledgeBaseUrlSchema =
  SchemaFactory.createForClass(KnowledgeBaseUrl);

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'knowledge_bases',
})
export class KnowledgeBase {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'disabled'],
    default: 'active',
  })
  status: KnowledgeItemStatus;

  @Prop({ type: [KnowledgeBaseFileSchema], default: [] })
  files: KnowledgeBaseFile[];

  @Prop({ type: [KnowledgeBaseUrlSchema], default: [] })
  urls: KnowledgeBaseUrl[];

  @Prop({ type: String, default: null })
  organizationId: string | null;
}

export const KnowledgeBaseSchema = SchemaFactory.createForClass(KnowledgeBase);

KnowledgeBaseSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
