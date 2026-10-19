import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CommandControlUser,
  CommandControlUserDocument,
} from '../schemas/command-control-user.schema';

@Injectable()
export class CommandControlRepository {
  constructor(
    @InjectModel(CommandControlUser.name)
    private readonly commandControlUserModel: Model<CommandControlUserDocument>,
  ) {}

  async create(
    data: Pick<CommandControlUser, 'email' | 'passwordHash'>,
  ): Promise<CommandControlUserDocument> {
    return this.commandControlUserModel.create(data);
  }

  async filterByEmail(
    email: string,
  ): Promise<CommandControlUserDocument | null> {
    return this.commandControlUserModel.findOne({ email }).exec();
  }

  async filterById(id: string): Promise<CommandControlUserDocument | null> {
    return this.commandControlUserModel.findById(id).exec();
  }
}
