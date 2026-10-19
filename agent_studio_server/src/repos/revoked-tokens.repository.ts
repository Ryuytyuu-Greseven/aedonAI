import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RevokedToken,
  RevokedTokenDocument,
} from '../schemas/revoked-token.schema';

@Injectable()
export class RevokedTokensRepository {
  constructor(
    @InjectModel(RevokedToken.name)
    private readonly revokedTokenModel: Model<RevokedTokenDocument>,
  ) {}

  async upsertByJti(jti: string, expiresAt: Date): Promise<void> {
    await this.revokedTokenModel.updateOne(
      { jti },
      { jti, expiresAt },
      { upsert: true },
    );
  }

  async existsByJti(jti: string): Promise<boolean> {
    const revoked = await this.revokedTokenModel.exists({ jti }).exec();
    return revoked !== null;
  }
}
