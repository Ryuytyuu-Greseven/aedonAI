import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SalesProperty,
  SalesPropertyDocument,
} from '../schemas/sales-property.schema';

export type NewSalesProperty = Pick<
  SalesProperty,
  'companyId' | 'agentId' | 'name'
> &
  Partial<Pick<SalesProperty, 'description'>>;

export type SalesPropertyUpdate = Partial<
  Pick<SalesProperty, 'name' | 'description'>
>;

@Injectable()
export class SalesPropertiesRepository {
  constructor(
    @InjectModel(SalesProperty.name)
    private readonly salesPropertyModel: Model<SalesPropertyDocument>,
  ) {}

  async create(data: NewSalesProperty): Promise<SalesPropertyDocument> {
    return this.salesPropertyModel.create(data);
  }

  async filterByAgentId(agentId: string): Promise<SalesPropertyDocument[]> {
    return this.salesPropertyModel
      .find({ agentId })
      .sort({ created_at: -1 })
      .exec();
  }

  async filterById(id: string): Promise<SalesPropertyDocument | null> {
    return this.salesPropertyModel.findById(id).exec();
  }

  async update(
    id: string,
    partial: SalesPropertyUpdate,
  ): Promise<SalesPropertyDocument | null> {
    return this.salesPropertyModel
      .findByIdAndUpdate(id, partial, { new: true })
      .exec();
  }

  async delete(id: string): Promise<SalesPropertyDocument | null> {
    return this.salesPropertyModel.findByIdAndDelete(id).exec();
  }
}
