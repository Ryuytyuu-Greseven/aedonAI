import { Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import {
  AvailablePhoneNumbersResult,
  PhoneNumber,
  PurchasePhoneNumberInput,
  ReconcileProvisioningResult,
  SearchAvailableNumbersQuery,
  phoneNumberCountryName,
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
   * Stage-phase numbers pickable for a playground country: staging numbers only (production
   * numbers are assigned at go-live). Open ones — Available and unassigned — plus the agent's
   * current staging number so its selection stays visible.
   */
  getAvailableForCountry(countryName: string, currentAgentPhoneNumberId?: string): Observable<PhoneNumber[]> {
    const country = COUNTRY_CODES.find((c) => c.name === countryName);
    if (!country) {
      return throwError(() => new Error(`Unknown country: ${countryName}`));
    }

    return this.api.getPhoneNumbers().pipe(
      map((numbers) =>
        numbers.filter((n) => {
          if (n.country_code !== country.code || n.environmentType !== 'staging') return false;
          if (n.id === currentAgentPhoneNumberId) return true;
          return n.status === 'Available' && n.assigned_agent == null;
        }),
      ),
    );
  }

  searchAvailable(query: SearchAvailableNumbersQuery): Observable<AvailablePhoneNumbersResult> {
    return this.api.searchAvailablePhoneNumbers(query);
  }

  purchase(input: PurchasePhoneNumberInput): Observable<PhoneNumber> {
    return this.api.purchasePhoneNumber({
      country: input.country,
      phone_number: input.number.e164,
      number_type: input.number.number_type,
      region: input.number.region ?? undefined,
      label: input.label.trim() || input.number.friendly_name,
      notes: input.notes?.trim() || undefined,
      envType: input.environmentType,
    });
  }

  reconcile(): Observable<ReconcileProvisioningResult> {
    return this.api.reconcilePhoneNumbers();
  }

  release(id: string): Observable<PhoneNumber> {
    return this.api.releasePhoneNumber(id);
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
