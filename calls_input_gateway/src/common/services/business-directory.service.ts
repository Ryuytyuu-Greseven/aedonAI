import { Injectable, Logger } from '@nestjs/common';
import { MOCK_PHONE_BUSINESS_MAP } from '../config/phone-business-directory.mock';

/**
 * Resolves which business owns a given phone number.
 *
 * Backed by a static mock table for now (see phone-business-directory.mock.ts).
 * When the MongoDB-backed number registry lands, only this class's internals
 * change — callers keep using resolveBusinessForNumber().
 */
@Injectable()
export class BusinessDirectoryService {
  private readonly logger = new Logger(BusinessDirectoryService.name);

  public resolveBusinessForNumber(
    phoneNumber?: string | null,
  ): string | undefined {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) return undefined;

    const business = MOCK_PHONE_BUSINESS_MAP[normalized];
    if (!business) {
      this.logger.warn(
        `[BusinessDirectory] No business assigned to number ${normalized}`,
      );
    }
    return business;
  }

  private normalizePhoneNumber(phoneNumber?: string | null): string | null {
    if (!phoneNumber) return null;
    const digits = phoneNumber.trim().replace(/[^\d+]/g, '');
    if (!digits) return null;
    return digits.startsWith('+') ? digits : `+${digits}`;
  }
}
