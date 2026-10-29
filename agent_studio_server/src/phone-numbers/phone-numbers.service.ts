import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { assertSameCompany } from '../common/utils/company-scope.util';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { PhoneNumbersRepository } from '../repos/phone-numbers.repository';
import {
  PhoneNumber,
  PhoneNumberEnvType,
} from '../schemas/phone-number.schema';
import { TelephonyNumbersRegistry } from '../telephony/telephony-numbers.registry';
import { AvailableNumber } from '../telephony/telephony.types';
import { nationalNumber } from '../telephony/utils/e164.util';
import { PurchasePhoneNumberDto } from './dto/purchase-phone-number.dto';
import { SearchAvailableNumbersDto } from './dto/search-available-numbers.dto';

const DEFAULT_SEARCH_LIMIT = 20;

export interface AvailableNumbersResult {
  country: string;
  numbers: AvailableNumber[];
}

@Injectable()
export class PhoneNumbersService {
  private readonly logger = new Logger(PhoneNumbersService.name);

  constructor(
    private readonly phoneNumbersRepository: PhoneNumbersRepository,
    private readonly telephony: TelephonyNumbersRegistry,
  ) {}

  /** Live provider search — nothing is stored until the admin purchases. */
  async searchAvailable(
    dto: SearchAvailableNumbersDto,
  ): Promise<AvailableNumbersResult> {
    const country = this.telephony.country(dto.country);
    const type = dto.type ?? country.numberTypes[0];
    if (!country.numberTypes.includes(type)) {
      throw new BadRequestException(
        `type must be one of ${country.numberTypes.join(', ')} for ${country.isoCountry}`,
      );
    }
    if (dto.areaCode && country.provider !== 'twilio') {
      throw new BadRequestException('areaCode is only supported for US');
    }
    if (dto.region && country.provider !== 'exotel') {
      throw new BadRequestException('region is only supported for IN');
    }

    const numbers = await this.telephony.forCountry(country.isoCountry).search({
      isoCountry: country.isoCountry,
      type,
      areaCode: dto.areaCode,
      region: dto.region,
      contains: dto.contains,
      limit: dto.limit ?? DEFAULT_SEARCH_LIMIT,
    });
    return { country: country.isoCountry, numbers };
  }

  /**
   * Buys a number from the country's provider and stores it for the admin's
   * company. A `Provisioning` row is reserved first so a double-click or a
   * second admin can't buy (and be billed for) the same number twice.
   */
  async purchase(
    dto: PurchasePhoneNumberDto,
    user: AuthenticatedUser,
  ): Promise<PhoneNumber> {
    const country = this.telephony.country(dto.country);
    const e164 = dto.phone_number.trim();
    if (!e164.startsWith(country.dialCode)) {
      throw new BadRequestException(
        `${e164} is not a ${country.isoCountry} (${country.dialCode}) number`,
      );
    }
    if (dto.number_type && !country.numberTypes.includes(dto.number_type)) {
      throw new BadRequestException(
        `number_type must be one of ${country.numberTypes.join(', ')} for ${country.isoCountry}`,
      );
    }

    let reservation: PhoneNumber & { _id: unknown };
    try {
      reservation = await this.phoneNumbersRepository.createProvisioning({
        companyId: user.companyId,
        country_code: country.dialCode,
        phone_number: nationalNumber(e164, country.dialCode),
        e164,
        provider: country.provider,
        iso_country: country.isoCountry,
        number_type: dto.number_type ?? null,
        region: dto.region?.trim() || null,
        label: dto.label.trim(),
        notes: dto.notes?.trim() ?? '',
        envType: dto.envType ?? 'production',
        purchased_by: user.userId,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          `${e164} is already owned or currently being purchased`,
        );
      }
      throw error;
    }
    const reservationId = String(reservation._id);

    let purchased;
    try {
      purchased = await this.telephony
        .byName(country.provider)
        .purchase(e164, { friendlyName: dto.label.trim() });
    } catch (error) {
      await this.phoneNumbersRepository.deleteById(reservationId);
      throw error;
    }

    const saved = await this.phoneNumbersRepository
      .markPurchased(reservationId, {
        provider_sid: purchased.provider_sid,
        friendly_name: purchased.friendly_name,
        capabilities: purchased.capabilities,
        monthly_price: purchased.monthly_price,
        currency: purchased.currency,
        inbound_configured: purchased.inbound_configured,
      })
      .catch((error: unknown) => {
        // Bought and billed at the provider but not recorded here — leave the
        // Provisioning row and log the sid so it can be reconciled by hand.
        this.logger.error(
          `Purchased ${e164} on ${country.provider} (sid=${purchased.provider_sid}) but failed to save phone number ${reservationId}`,
          error instanceof Error ? error.stack : String(error),
        );
        return null;
      });
    if (!saved) {
      throw new InternalServerErrorException(
        `${e164} was purchased but could not be saved — please contact support`,
      );
    }
    this.logger.log(
      `Purchased ${e164} on ${country.provider} (sid=${purchased.provider_sid}) for company ${user.companyId}`,
    );
    return saved;
  }

  /** Returns the number to its provider (stops billing) and marks it Released. */
  async release(id: string, companyId: string | null): Promise<PhoneNumber> {
    const phoneNumber = await this.findById(id, companyId);
    if (phoneNumber.status === 'Released') {
      throw new ConflictException(`Phone number ${id} is already released`);
    }
    if (phoneNumber.status === 'Provisioning') {
      throw new ConflictException(
        `Phone number ${id} is still being purchased`,
      );
    }
    if (phoneNumber.assigned_agent) {
      throw new ConflictException(
        'Unassign the agent from this number before releasing it',
      );
    }

    // Legacy manually-entered numbers were never bought from a provider.
    if (phoneNumber.provider && phoneNumber.provider_sid) {
      await this.telephony
        .byName(phoneNumber.provider)
        .release(phoneNumber.provider_sid);
    }

    const released = await this.phoneNumbersRepository.markReleased(id);
    if (!released) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    return released;
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
    assignedAgent: string | null,
    companyId: string | null,
  ): Promise<PhoneNumber> {
    const phoneNumber = await this.findById(id, companyId);
    // Unassigning (null) is always allowed, so stray assignments can be cleared.
    if (assignedAgent) {
      this.assertUsable(phoneNumber, id);
      if (phoneNumber.envType !== 'staging') {
        throw new ConflictException(
          'Only staging numbers can be assigned as a stage number — production numbers are assigned at go-live',
        );
      }
      if (
        phoneNumber.assigned_agent &&
        phoneNumber.assigned_agent !== assignedAgent
      ) {
        throw new ConflictException(
          'This phone number is already assigned to another agent',
        );
      }
    }
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
    const phoneNumber = await this.findById(id, companyId);
    this.assertUsable(phoneNumber, id);
    const updated = await this.phoneNumbersRepository.disable(id);
    if (!updated) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    return updated;
  }

  async enable(id: string, companyId: string | null): Promise<PhoneNumber> {
    const phoneNumber = await this.findById(id, companyId);
    this.assertUsable(phoneNumber, id);
    const updated = await this.phoneNumbersRepository.enable(id);
    if (!updated) {
      throw new NotFoundException(`Phone number ${id} not found`);
    }
    return updated;
  }

  /** Released / in-flight numbers can't be assigned, enabled or disabled. */
  private assertUsable(phoneNumber: PhoneNumber, id: string): void {
    if (
      phoneNumber.status === 'Released' ||
      phoneNumber.status === 'Provisioning'
    ) {
      throw new ConflictException(
        `Phone number ${id} is ${phoneNumber.status.toLowerCase()}`,
      );
    }
  }
}
