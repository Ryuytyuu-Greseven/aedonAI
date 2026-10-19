import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRole } from '../common/interfaces/user.interface';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(
    data: Pick<User, 'email' | 'passwordHash' | 'name' | 'role'> &
      Partial<Pick<User, 'companyId'>>,
  ): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async filterByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async filterById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async filterByRole(
    role: UserRole,
    companyId: string | null,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({ role, companyId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async filterAll(): Promise<UserDocument[]> {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  async setDisabled(
    id: string,
    isDisabled: boolean,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { isDisabled }, { new: true })
      .exec();
  }

  async setName(id: string, name: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, { name }, { new: true }).exec();
  }

  async setPasswordHash(
    id: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { passwordHash }, { new: true })
      .exec();
  }

  async setResetPasswordToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        resetPasswordTokenHash: tokenHash,
        resetPasswordTokenExpiresAt: expiresAt,
      })
      .exec();
  }

  async filterByValidResetPasswordTokenHash(
    tokenHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        resetPasswordTokenHash: tokenHash,
        resetPasswordTokenExpiresAt: { $gt: new Date() },
      })
      .exec();
  }

  async setPasswordHashAndClearResetToken(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordTokenExpiresAt: null,
      })
      .exec();
  }
}
