import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  PhoneNumber,
  PhoneNumberEnvironmentType,
  PHONE_NUMBER_ENVIRONMENT_TYPES,
  RequestPhoneNumberInput,
  phoneNumberE164,
  phoneNumberCountryName,
  phoneNumberEnvironmentLabel,
  phoneNumberMatchesSearch,
} from '../../../core/models/phone-number.model';
import { PhoneNumberService } from '../../../core/services/phone-number.service';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';
import { COUNTRY_CODES, CountryCode } from '../../../shared/constants/countries.constant';
import { ModalComponent } from '../../../shared/modal/modal.component';

const PAGE_SIZE = 10;

type CountryFilter = 'all' | string;
type EnvironmentFilter = 'all' | PhoneNumberEnvironmentType;

@Component({
  selector: 'app-phone-number-list',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './phone-number-list.component.html',
  styleUrl: './phone-number-list.component.css',
})
export class PhoneNumberListComponent implements OnInit {
  private readonly phoneNumberService = inject(PhoneNumberService);
  private readonly agentService = inject(AgentService);
  private readonly toast = inject(ToastService);

  readonly countries = Array.from(new Map(COUNTRY_CODES.map((c) => [c.name, c])).values());
  readonly environmentTypes = PHONE_NUMBER_ENVIRONMENT_TYPES;
  readonly phoneNumberE164 = phoneNumberE164;
  readonly phoneNumberCountryName = phoneNumberCountryName;
  readonly phoneNumberEnvironmentLabel = phoneNumberEnvironmentLabel;

  readonly loading = signal(true);
  readonly numbers = signal<PhoneNumber[]>([]);
  readonly agentNames = signal<Record<string, string>>({});
  readonly statusUpdatingId = signal<string | null>(null);

  readonly search = signal('');
  readonly countryFilter = signal<CountryFilter>('all');
  readonly environmentFilter = signal<EnvironmentFilter>('all');
  readonly page = signal(1);

  showRequestForm = false;
  requestCountryCode = '';
  requestNumber = '';
  requestLabel = '';
  requestNotes = '';
  requestEnvironmentType: PhoneNumberEnvironmentType | '' = '';
  requestError = '';
  requesting = false;

  readonly filtered = computed(() => {
    let list = this.numbers();
    const countryCode = this.countryFilter();
    if (countryCode !== 'all') list = list.filter((n) => n.country_code === countryCode);
    const environmentType = this.environmentFilter();
    if (environmentType !== 'all') list = list.filter((n) => n.environmentType === environmentType);
    const search = this.search();
    if (search) list = list.filter((n) => phoneNumberMatchesSearch(n, search));
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  readonly pagedNumbers = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly stats = computed(() => {
    const list = this.numbers();
    return {
      total: list.length,
      available: list.filter((n) => n.status === 'Available').length,
      assigned: list.filter((n) => !!n.assigned_agent).length,
      countries: new Set(list.map((n) => n.country_code)).size,
    };
  });

  readonly environmentCounts = computed(() => {
    const list = this.numbers();
    return {
      all: list.length,
      production: list.filter((n) => n.environmentType === 'production').length,
      staging: list.filter((n) => n.environmentType === 'staging').length,
    };
  });

  /** 1-based range of rows shown on the current page, for the "Showing x–y of n" footer. */
  readonly pageRange = computed(() => {
    const total = this.filtered().length;
    const start = total === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1;
    return { start, end: Math.min(total, this.page() * PAGE_SIZE), total };
  });

  readonly hasAnyFilter = computed(
    () => this.countryFilter() !== 'all' || this.environmentFilter() !== 'all' || !!this.search(),
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      numbers: this.phoneNumberService.getPhoneNumbers(),
      agents: this.agentService.getAgents(),
    }).subscribe({
      next: ({ numbers, agents }) => {
        this.numbers.set(numbers);
        this.agentNames.set(Object.fromEntries(agents.map((a) => [a.id, a.agent_name])));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load phone numbers');
      },
    });
  }

  agentNameFor(phoneNumber: PhoneNumber): string | null {
    if (!phoneNumber.assigned_agent) return null;
    return this.agentNames()[phoneNumber.assigned_agent] ?? phoneNumber.assigned_agent;
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setCountryFilter(value: CountryFilter): void {
    this.countryFilter.set(value);
    this.page.set(1);
  }

  setEnvironmentFilter(value: EnvironmentFilter): void {
    this.environmentFilter.set(value);
    this.page.set(1);
  }

  clearFilters(): void {
    this.search.set('');
    this.countryFilter.set('all');
    this.environmentFilter.set('all');
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  openRequestForm(): void {
    this.showRequestForm = true;
    this.requestCountryCode = '';
    this.requestNumber = '';
    this.requestLabel = '';
    this.requestNotes = '';
    this.requestEnvironmentType = '';
    this.requestError = '';
  }

  cancelRequest(): void {
    this.showRequestForm = false;
    this.requestError = '';
  }

  submitRequest(): void {
    if (!this.requestCountryCode || !this.requestNumber.trim()) {
      this.requestError = 'Country and mobile number are required';
      return;
    }
    if (!this.requestEnvironmentType) {
      this.requestError = 'Environment is required';
      return;
    }
    this.requestError = '';
    const input: RequestPhoneNumberInput = {
      country_code: this.requestCountryCode,
      phone_number: this.requestNumber.trim(),
      label: this.requestLabel.trim() || this.requestNumber.trim(),
      notes: this.requestNotes.trim() || undefined,
      environmentType: this.requestEnvironmentType,
    };
    this.requesting = true;
    this.phoneNumberService.requestPhoneNumber(input).subscribe({
      next: (created) => {
        this.requesting = false;
        this.numbers.update((list) => [created, ...list]);
        this.toast.success('Phone number requested');
        this.showRequestForm = false;
      },
      error: (err: unknown) => {
        this.requesting = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.requestError = 'This country code + number already exists';
          this.toast.error('Duplicate phone number');
          return;
        }
        this.toast.error('Failed to request phone number');
      },
    });
  }

  toggleStatus(phoneNumber: PhoneNumber): void {
    if (this.statusUpdatingId()) return;
    this.statusUpdatingId.set(phoneNumber.id);
    const request =
      phoneNumber.status === 'Available'
        ? this.phoneNumberService.disablePhoneNumber(phoneNumber.id)
        : this.phoneNumberService.enablePhoneNumber(phoneNumber.id);

    request.subscribe({
      next: (updated) => {
        this.statusUpdatingId.set(null);
        this.numbers.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
        this.toast.success(updated.status === 'Available' ? 'Number enabled' : 'Number disabled');
      },
      error: () => {
        this.statusUpdatingId.set(null);
        this.toast.error('Failed to update phone number status');
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** First country entry for a dial code (several countries share +1, so this is best-effort). */
  countryFor(code: string): CountryCode | undefined {
    return COUNTRY_CODES.find((c) => c.code === code);
  }

  copyNumber(phoneNumber: PhoneNumber): void {
    const value = phoneNumberE164(phoneNumber);
    navigator.clipboard.writeText(value).then(
      () => this.toast.success(`Copied ${value}`),
      () => this.toast.error('Could not copy to clipboard'),
    );
  }
}
