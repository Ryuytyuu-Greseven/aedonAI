import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RevokedTokenDocument = HydratedDocument<RevokedToken>;

/**
 * JWTs are stateless, so logout can't invalidate a token by deleting it.
 * We record its jti here until it would have expired anyway (see the TTL
 * index in RevokedTokenSchema below), and JwtStrategy rejects any token
 * whose jti shows up in this collection.
 */
@Schema({ collection: 'revoked_tokens' })
export class RevokedToken {
  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}

export const RevokedTokenSchema = SchemaFactory.createForClass(RevokedToken);
