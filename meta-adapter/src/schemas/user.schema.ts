import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { UserRole } from '../common/interfaces/user.interface';

export type UserDocument = HydratedDocument<User>;

/**
 * Read-only mirror of the `users` collection owned by lyreai_agent_builder_server.
 * meta-adapter shares that database purely to verify JWTs issued there — it must
 * never write to this collection.
 */
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, default: false })
  isDisabled: boolean;

  @Prop({ type: String, required: true, enum: ['admin', 'agent'], default: 'agent' })
  role: UserRole;

  @Prop({ type: String, default: null })
  companyId: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
