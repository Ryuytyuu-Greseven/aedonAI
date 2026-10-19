import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MetaLead } from '../schemas/meta-leads.schema';

@Injectable()
export class MetaLeadsRepository {
  constructor(
    @InjectModel(MetaLead.name)
    private readonly metaLeadModel: Model<MetaLead>,
  ) {}

  async create(data: Partial<MetaLead>): Promise<MetaLead> {
    return this.metaLeadModel.create(data);
  }
}
