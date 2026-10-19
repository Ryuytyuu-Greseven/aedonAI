import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PhoneNumber,
  PhoneNumberDocument,
  PhoneNumberEnvType,
} from '../schemas/phone-number.schema';

@Injectable()
export class PhoneNumbersRepository {
  constructor(
    @InjectModel(PhoneNumber.name)
    private readonly phoneNumberModel: Model<PhoneNumberDocument>,
  ) {}

  async create(
    data: Pick<
      PhoneNumber,
      | 'country_code'
      | 'phone_number'
      | 'label'
      | 'notes'
      | 'envType'
      | 'companyId'
    > &
      Partial<
        Pick<PhoneNumber, 'assigned_agent' | 'status' | 'organizationId'>
      >,
  ): Promise<PhoneNumberDocument> {
    return this.phoneNumberModel.create({
      ...data,
      assigned_agent: data.assigned_agent ?? null,
      organizationId: data.organizationId ?? null,
      status: data.status ?? 'Available',
      notes: data.notes ?? '',
      envType: data.envType ?? 'production',
    });
  }

  async filterAll(
    companyId: string | null,
    envType?: PhoneNumberEnvType,
  ): Promise<PhoneNumberDocument[]> {
    const filter = envType ? { companyId, envType } : { companyId };
    return this.phoneNumberModel.find(filter).sort({ created_at: -1 }).exec();
  }

  async filterById(id: string): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel.findById(id).exec();
  }

  /**
   * Assigns (or clears) the single agent linked to this phone number.
   */
  async updateAssignedAgent(
    id: string,
    assignedAgent: string | null,
  ): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel
      .findByIdAndUpdate(id, { assigned_agent: assignedAgent }, { new: true })
      .exec();
  }

  async disable(id: string): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel
      .findByIdAndUpdate(id, { status: 'Disabled' }, { new: true })
      .exec();
  }

  async enable(id: string): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel
      .findByIdAndUpdate(id, { status: 'Available' }, { new: true })
      .exec();
  }
}
