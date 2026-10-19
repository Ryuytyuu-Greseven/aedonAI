import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertSameCompany } from '../common/utils/company-scope.util';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { PhoneNumbersRepository } from '../repos/phone-numbers.repository';
import {
  PhoneNumber,
  PhoneNumberEnvType,
} from '../schemas/phone-number.schema';
import { CreatePhoneNumberDto } from './dto/create-phone-number.dto';

@Injectable()
export class PhoneNumbersService {
  constructor(
    private readonly phoneNumbersRepository: PhoneNumbersRepository,
  ) {}

  async create(
    dto: CreatePhoneNumberDto,
    companyId: string | null,
  ): Promise<PhoneNumber> {
    try {
      return await this.phoneNumbersRepository.create({
        companyId,
        country_code: dto.country_code.trim(),
        phone_number: dto.phone_number.trim(),
        label: dto.label.trim(),
        notes: dto.notes?.trim() ?? '',
        envType: dto.envType ?? 'production',
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'A phone number with this country code already exists',
        );
      }
      throw error;
    }
  }

  async findAll(
    companyId: string | null,
    envType?: PhoneNumberEnvType,
  ): Promise<PhoneNumber[]> {
    return this.phoneNumbersRepository.filterAll(companyId, envType);
  }

  async findById(
    id: string,
    companyId: string | null,
  ): Promise<PhoneNumber> {
    const phoneNumber = await this.phoneNumbersRepository.filterById(id);
    if (!phoneNumber) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    assertSameCompany(
      companyId,
      phoneNumber.companyId,
      `Phone number ${id} not found`,
    );
    return phoneNumber;
  }

  async assignAgent(
    id: string,
    assignedAgent: string,
    companyId: string | null,
  ): Promise<PhoneNumber> {
    await this.findById(id, companyId);
    const updated = await this.phoneNumbersRepository.updateAssignedAgent(
      id,
      assignedAgent,
    );
    if (!updated) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    return updated;
  }

  async disable(id: string, companyId: string | null): Promise<PhoneNumber> {
    await this.findById(id, companyId);
    const updated = await this.phoneNumbersRepository.disable(id);
    if (!updated) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    return updated;
  }

  async enable(id: string, companyId: string | null): Promise<PhoneNumber> {
    await this.findById(id, companyId);
    const updated = await this.phoneNumbersRepository.enable(id);
    if (!updated) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    return updated;
  }
}
