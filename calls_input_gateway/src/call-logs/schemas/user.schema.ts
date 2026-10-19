import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserRole = 'admin' | 'agent';

@Schema({ timestamps: true, collection: 'users' })
export class User {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true })
    passwordHash: string;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, default: false })
    isDisabled: boolean;

    @Prop({ required: true, enum: ['admin', 'agent'], default: 'agent' })
    role: UserRole;

    @Prop({ type: String, default: null })
    companyId: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
    },
});
