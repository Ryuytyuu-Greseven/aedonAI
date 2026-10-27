import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.schema';
import { RevokedToken, RevokedTokenSchema } from '../schemas/revoked-token.schema';
import { UsersRepository } from './users.repository';
import { RevokedTokensRepository } from './revoked-tokens.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RevokedToken.name, schema: RevokedTokenSchema },
    ]),
  ],
  providers: [UsersRepository, RevokedTokensRepository],
  exports: [UsersRepository, RevokedTokensRepository],
})
export class ReposModule {}
