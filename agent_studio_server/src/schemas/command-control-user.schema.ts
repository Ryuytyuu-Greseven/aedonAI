import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CommandControlUserDocument = HydratedDocument<CommandControlUser>;

/** Internal-portal login identity, separate from the regular company-scoped users collection. */
@Schema({ timestamps: true, collection: 'command_control_users' })
export class CommandControlUser {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;
}

export const CommandControlUserSchema =
  SchemaFactory.createForClass(CommandControlUser);

CommandControlUserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});
