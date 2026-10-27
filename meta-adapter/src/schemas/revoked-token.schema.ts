import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RevokedTokenDocument = HydratedDocument<RevokedToken>;

/**
 * Read-only mirror of the `revoked_tokens` collection owned by lyreai_agent_builder_server.
 * JwtStrategy rejects any token whose jti shows up here, matching that service's
 * logout-revocation behavior exactly.
 */
@Schema({ collection: 'revoked_tokens' })
export class RevokedToken {
  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}

export const RevokedTokenSchema = SchemaFactory.createForClass(RevokedToken);
