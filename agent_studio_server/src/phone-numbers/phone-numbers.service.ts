import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../common/interfaces/user.interface';
import { assertSameCompany } from '../common/utils/company-scope.util';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import {
  PhoneNumbersRepository,
  PurchasedPhoneNumberFields,
} from '../repos/phone-numbers.repository';
import {
  PhoneNumber,
  PhoneNumberEnvType,
} from '../schemas/phone-number.schema';
import { PurchaseRejectedException } from '../telephony/telephony.errors';
import { TelephonyNumbersRegistry } from '../telephony/telephony-numbers.registry';
import {
  AvailableNumber,
  OwnedNumber,
  TelephonyProviderName,
} from '../telephony/telephony.types';
import { nationalNumber } from '../telephony/utils/e164.util';
import { PurchasePhoneNumberDto } from './dto/purchase-phone-number.dto';
import { SearchAvailableNumbersDto } from './dto/search-available-numbers.dto';

const DEFAULT_SEARCH_LIMIT = 20;

/** Provisioning rows younger than this may still have a purchase in flight. */
const STALE_PROVISIONING_MS = 10 * 60 * 1000;

export interface AvailableNumbersResult {
  country: string;
  numbers: AvailableNumber[];
}

/** E.164s settled by reconcileProvisioning(). */
export interface ReconcileProvisioningResult {
  /** On the provider account — now Available. */
  recovered: string[];
  /** Not on the provider account — never bought, reservation dropped. */
  removed: string[];
  /** Left Provisioning (provider list or DB write failed) — run again later. */
  unresolved: string[];
}

@Injectable()
export class PhoneNumbersService {
  private readonly logger = new Logger(PhoneNumbersService.name);
  /** Waits between attempts to record a purchase the provider already billed. */
  private readonly saveRetryDelaysMs = [250, 1000];

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
      if (isPurchaseRejected(error)) {
        await this.phoneNumbersRepository.deleteById(reservationId);
        throw error;
      }
      // Timeout / 5xx: the provider may have bought (and billed) the number.
      // Keep the Provisioning row for reconcileProvisioning() to settle.
      this.logger.error(
        `Purchase of ${e164} on ${country.provider} has an unknown outcome — kept phone number ${reservationId} as Provisioning`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException(
        `Could not confirm the purchase of ${e164}. It stays listed as Provisioning until it is verified — do not buy it again.`,
      );
    }

    const saved = await this.savePurchase(reservationId, {
      provider_sid: purchased.provider_sid,
      friendly_name: purchased.friendly_name,
      capabilities: purchased.capabilities,
      monthly_price: purchased.monthly_price,
      currency: purchased.currency,
      inbound_configured: purchased.inbound_configured,
    }).catch((error: unknown) => {
      // Bought and billed at the provider but not recorded here — leave the
      // Provisioning row for reconcileProvisioning() and log the sid.
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

  /** markPurchased with retries — the number is already billed, so a DB blip must not lose it. */
  private async savePurchase(
    id: string,
    fields: PurchasedPhoneNumberFields,
  ): Promise<PhoneNumber | null> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.phoneNumbersRepository.markPurchased(id, fields);
      } catch (error) {
        const delay = this.saveRetryDelaysMs[attempt];
        if (delay === undefined) throw error;
        this.logger.warn(
          `Saving purchased phone number ${id} failed (attempt ${attempt + 1}) — retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Settles the company's purchases stuck in Provisioning (a save that failed
   * after the provider billed, or a provider call with an unknown outcome) by
   * checking which numbers the provider account actually owns.
   */
  async reconcileProvisioning(
    companyId: string | null,
  ): Promise<ReconcileProvisioningResult> {
    const result: ReconcileProvisioningResult = {
      recovered: [],
      removed: [],
      unresolved: [],
    };
    const stale = await this.phoneNumbersRepository.findStaleProvisioning(
      companyId,
      new Date(Date.now() - STALE_PROVISIONING_MS),
    );

    const byProvider = new Map<TelephonyProviderName, typeof stale>();
    for (const row of stale) {
      if (!row.provider || !row.e164) {
        result.unresolved.push(row.e164 ?? String(row._id));
        continue;
      }
      byProvider.set(row.provider, [
        ...(byProvider.get(row.provider) ?? []),
        row,
      ]);
    }

    for (const [provider, rows] of byProvider) {
      let owned: Map<string, OwnedNumber>;
      try {
        const numbers = await this.telephony.byName(provider).listOwned();
        owned = new Map(numbers.map((n) => [n.e164, n]));
      } catch (error) {
        // Without the full list we can't tell "never bought" from "bought".
        this.logger.error(
          `Could not list ${provider} numbers — left ${rows.length} Provisioning row(s) unresolved`,
          error instanceof Error ? error.stack : String(error),
        );
        result.unresolved.push(...rows.map((row) => row.e164 as string));
        continue;
      }

      for (const row of rows) {
        const id = String(row._id);
        const e164 = row.e164 as string;
        const match = owned.get(e164);
        try {
          if (match) {
            await this.phoneNumbersRepository.markPurchased(
              id,
              {
                provider_sid: match.provider_sid,
                friendly_name: match.friendly_name,
                capabilities: match.capabilities,
                // The provider's list doesn't quote prices.
                monthly_price: null,
                currency: null,
                inbound_configured: match.inbound_configured,
              },
              row.created_at,
            );
            result.recovered.push(e164);
          } else {
            await this.phoneNumbersRepository.deleteProvisioning(id);
            result.removed.push(e164);
          }
        } catch (error) {
          this.logger.error(
            `Could not reconcile phone number ${id} (${e164})`,
            error instanceof Error ? error.stack : String(error),
          );
          result.unresolved.push(e164);
        }
      }
    }

    if (stale.length > 0) {
      this.logger.log(
        `Reconciled Provisioning numbers for company ${companyId}: recovered=${result.recovered.join(',') || '-'} removed=${result.removed.join(',') || '-'} unresolved=${result.unresolved.join(',') || '-'}`,
      );
    }
    return result;
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

/**
 * True only when the provider surely did not buy the number: an explicit
 * rejection, a 4xx, or 503 (credentials missing, nothing was sent).
 */
function isPurchaseRejected(error: unknown): boolean {
  if (error instanceof PurchaseRejectedException) return true;
  if (!(error instanceof HttpException)) return false;
  const status = error.getStatus();
  return status < 500 || status === Number(HttpStatus.SERVICE_UNAVAILABLE);
}
