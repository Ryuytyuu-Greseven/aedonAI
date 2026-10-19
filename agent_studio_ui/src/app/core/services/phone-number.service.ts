import { Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import {
  PhoneNumber,
  RequestPhoneNumberInput,
  phoneNumberCountryName,
  toNationalNumber,
} from '../models/phone-number.model';
import { COUNTRY_CODES } from '../../shared/constants/countries.constant';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class PhoneNumberService {
  constructor(private readonly api: ApiService) {}

  getPhoneNumbers(): Observable<PhoneNumber[]> {
    return this.api.getPhoneNumbers();
  }

  getPhoneNumber(id: string): Observable<PhoneNumber> {
    return this.api.getPhoneNumber(id);
  }

  /**
   * Numbers pickable for a playground country: Available (or the agent's current number),
   * matching the country's dial code, and either unassigned or already on this agent.
   */
  getAvailableForCountry(countryName: string, currentAgentPhoneNumberId?: string): Observable<PhoneNumber[]> {
    const country = COUNTRY_CODES.find((c) => c.name === countryName);
    if (!country) {
      return throwError(() => new Error(`Unknown country: ${countryName}`));
    }

    return this.api.getPhoneNumbers().pipe(
      map((numbers) =>
        numbers.filter((n) => {
          if (n.country_code !== country.code) return false;
          if (n.id === currentAgentPhoneNumberId) return true;
          return n.status === 'Available' && n.assigned_agent == null;
        }),
      ),
    );
  }

  requestPhoneNumber(input: RequestPhoneNumberInput): Observable<PhoneNumber> {
    const countryCode = input.country_code?.trim();
    const national = toNationalNumber(countryCode, input.phone_number);
    if (!countryCode || !national) {
      return throwError(() => new Error('Country and mobile number are required'));
    }
    return this.api.createPhoneNumber({
      country_code: countryCode,
      phone_number: national,
      label: input.label.trim() || national,
      notes: input.notes?.trim() || undefined,
      envType: input.environmentType,
    });
  }

  assignToAgent(phoneNumberId: string, agentId: string): Observable<PhoneNumber> {
    return this.api.assignPhoneNumberAgent(phoneNumberId, agentId);
  }

  /** Clears assignment via assign-agent with `null` (no dedicated unassign route). */
  unassignFromAgent(phoneNumberId: string): Observable<PhoneNumber> {
    return this.api.assignPhoneNumberAgent(phoneNumberId, null);
  }

  disablePhoneNumber(id: string): Observable<PhoneNumber> {
    return this.api.disablePhoneNumber(id);
  }

  enablePhoneNumber(id: string): Observable<PhoneNumber> {
    return this.api.enablePhoneNumber(id);
  }

  countryNameFor(phoneNumber: PhoneNumber): string {
    return phoneNumberCountryName(phoneNumber);
  }
}
