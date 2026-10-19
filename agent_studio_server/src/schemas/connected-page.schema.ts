import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConnectedPageDocument = HydratedDocument<ConnectedPage>;

/**
 * Mirrors meta-adapter's own `ConnectedPage` model against the same shared
 * `connectedpages` collection. meta-adapter owns `customerId`, `pageId`,
 * `pageName`, `accessToken` and `isActive` (written via its own
 * `POST /meta/oauth/exchange`); `agentId` is written only by this service,
 * via `$set`-only updates so it survives meta-adapter's own upserts.
 */
@Schema({ timestamps: true, collection: 'connectedpages' })
export class ConnectedPage {
  /** The connecting user's companyId — meta-adapter's term for it. */
  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, unique: true, index: true })
  pageId: string;

  @Prop()
  pageName: string;

  // Never read/returned by this service: `select: false` keeps it out of
  // default query results as a safety net against accidental leaks.
  @Prop({ required: true, select: false })
  accessToken: string;

  /**
   * Soft-connect flag. Disabling/enabling a page never deletes this
   * document — see MetaIntegrationsService.
   */
  @Prop({ default: true })
  isActive: boolean;

  /** The agent that handles leads/live calls for this page, if linked. */
  @Prop({ type: String, default: null })
  agentId: string | null;

  /** Populated automatically by Mongoose (`timestamps: true`). */
  createdAt?: Date;
  updatedAt?: Date;
}

export const ConnectedPageSchema = SchemaFactory.createForClass(ConnectedPage);
