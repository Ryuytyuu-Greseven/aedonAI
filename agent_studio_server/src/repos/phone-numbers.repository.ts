import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PhoneNumber,
  PhoneNumberDocument,
  PhoneNumberEnvType,
} from '../schemas/phone-number.schema';

/** Provider-side fields written once a purchase succeeds. */
export type PurchasedPhoneNumberFields = Pick<
  PhoneNumber,
  | 'provider_sid'
  | 'friendly_name'
  | 'capabilities'
  | 'monthly_price'
  | 'currency'
  | 'inbound_configured'
>;

@Injectable()
export class PhoneNumbersRepository {
  constructor(
    @InjectModel(PhoneNumber.name)
    private readonly phoneNumberModel: Model<PhoneNumberDocument>,
  ) {}

  /**
   * Inserts a `Provisioning` row before the provider purchase call. The unique
   * e164 index makes a concurrent purchase of the same number fail here.
   */
  async createProvisioning(
    data: Pick<
      PhoneNumber,
      | 'companyId'
      | 'country_code'
      | 'phone_number'
      | 'e164'
      | 'provider'
      | 'iso_country'
      | 'number_type'
      | 'region'
      | 'label'
      | 'notes'
      | 'envType'
      | 'purchased_by'
    >,
  ): Promise<PhoneNumberDocument> {
    return this.phoneNumberModel.create({
      ...data,
      status: 'Provisioning',
      assigned_agent: null,
      organizationId: null,
    });
  }

  async markPurchased(
    id: string,
    fields: PurchasedPhoneNumberFields,
  ): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel
      .findByIdAndUpdate(
        id,
        { ...fields, status: 'Available', purchased_at: new Date() },
        { new: true },
      )
      .exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.phoneNumberModel.findByIdAndDelete(id).exec();
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

  /**
   * Atomically assigns a production number to an agent, only if it is still
   * Available and free (or already this agent's). Null when someone else got
   * it first or it changed state since it was checked.
   */
  async claimForAgent(
    id: string,
    agentId: string,
  ): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel
      .findOneAndUpdate(
        {
          _id: id,
          status: 'Available',
          envType: 'production',
          $or: [{ assigned_agent: null }, { assigned_agent: agentId }],
        },
        { assigned_agent: agentId },
        { new: true },
      )
      .exec();
  }

  /** Clears the assignment only if the number is still on this agent. */
  async unassignFromAgent(id: string, agentId: string): Promise<void> {
    await this.phoneNumberModel
      .updateOne({ _id: id, assigned_agent: agentId }, { assigned_agent: null })
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

  async markReleased(id: string): Promise<PhoneNumberDocument | null> {
    return this.phoneNumberModel
      .findByIdAndUpdate(
        id,
        { status: 'Released', released_at: new Date(), assigned_agent: null },
        { new: true },
      )
      .exec();
  }
}
