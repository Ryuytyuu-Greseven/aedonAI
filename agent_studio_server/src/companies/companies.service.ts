import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { sanitizeName } from '../common/utils/slug.util';
import { CompaniesRepository } from '../repos/companies.repository';
import { Company, CompanyStatus } from '../schemas/company.schema';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async create(dto: CreateCompanyDto): Promise<Company> {
    const sanitized = sanitizeName(dto.companyName) || 'company';
    const companyId = `${sanitized}_${randomUUID()}`;

    try {
      return await this.companiesRepository.create({
        companyName: dto.companyName.trim(),
        companyId,
        address: dto.address.trim(),
        contactNo: dto.contactNo.trim(),
        country: dto.country.trim(),
        email: dto.email.toLowerCase().trim(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'A company with this name or email already exists',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companiesRepository.filterAll();
  }

  async findById(id: string): Promise<Company> {
    const company = await this.companiesRepository.filterById(id);
    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return company;
  }

  /** Looks up by the tenant-facing `companyId` field (e.g. as stored on User.companyId), not the Mongo _id. */
  async findByCompanyId(companyId: string): Promise<Company> {
    const company = await this.companiesRepository.filterByCompanyId(companyId);
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findById(id);

    const data: Partial<
      Pick<
        Company,
        'companyName' | 'address' | 'contactNo' | 'country' | 'email'
      >
    > = {};
    if (dto.companyName !== undefined) {
      data.companyName = dto.companyName.trim();
    }
    if (dto.address !== undefined) {
      data.address = dto.address.trim();
    }
    if (dto.contactNo !== undefined) {
      data.contactNo = dto.contactNo.trim();
    }
    if (dto.country !== undefined) {
      data.country = dto.country.trim();
    }
    if (dto.email !== undefined) {
      data.email = dto.email.toLowerCase().trim();
    }

    try {
      const updated = await this.companiesRepository.update(id, data);
      if (!updated) {
        throw new NotFoundException(`Company ${id} not found`);
      }
      return updated;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'A company with this name or email already exists',
        );
      }
      throw error;
    }
  }

  async disable(id: string): Promise<Company> {
    return this.setStatus(id, 'disabled');
  }

  async enable(id: string): Promise<Company> {
    return this.setStatus(id, 'active');
  }

  private async setStatus(id: string, status: CompanyStatus): Promise<Company> {
    await this.findById(id);
    const updated = await this.companiesRepository.setStatus(id, status);
    if (!updated) {
      throw new NotFoundException(`Company ${id} not found`);
    }
    return updated;
  }
}
