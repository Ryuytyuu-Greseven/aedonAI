import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Company,
  CompanyDocument,
  CompanyStatus,
} from '../schemas/company.schema';

@Injectable()
export class CompaniesRepository {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async create(
    data: Pick<
      Company,
      | 'companyName'
      | 'companyId'
      | 'address'
      | 'contactNo'
      | 'country'
      | 'email'
    >,
  ): Promise<CompanyDocument> {
    return this.companyModel.create({ ...data, status: 'active' });
  }

  async filterAll(): Promise<CompanyDocument[]> {
    return this.companyModel.find().sort({ created_at: -1 }).exec();
  }

  async filterById(id: string): Promise<CompanyDocument | null> {
    return this.companyModel.findById(id).exec();
  }

  async filterByCompanyId(companyId: string): Promise<CompanyDocument | null> {
    return this.companyModel.findOne({ companyId }).exec();
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        Company,
        'companyName' | 'address' | 'contactNo' | 'country' | 'email'
      >
    >,
  ): Promise<CompanyDocument | null> {
    return this.companyModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async setStatus(
    id: string,
    status: CompanyStatus,
  ): Promise<CompanyDocument | null> {
    return this.companyModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
  }
}
