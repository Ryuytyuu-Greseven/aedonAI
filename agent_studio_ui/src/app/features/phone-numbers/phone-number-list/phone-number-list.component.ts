import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, filter, forkJoin, switchMap } from 'rxjs';
import {
  AvailablePhoneNumber,
  BUY_COUNTRIES,
  BuyCountry,
  PhoneNumber,
  PhoneNumberEnvironmentType,
  PhoneNumberType,
  PHONE_NUMBER_ENVIRONMENT_TYPES,
  formatMonthlyPrice,
  phoneNumberE164,
  phoneNumberCountryName,
  phoneNumberEnvironmentLabel,
  phoneNumberMatchesSearch,
  phoneNumberTypeLabel,
} from '../../../core/models/phone-number.model';
import { PhoneNumberService } from '../../../core/services/phone-number.service';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { COUNTRY_CODES, CountryCode } from '../../../shared/constants/countries.constant';
import { ModalComponent } from '../../../shared/modal/modal.component';

const PAGE_SIZE = 10;

type CountryFilter = 'all' | string;
type EnvironmentFilter = 'all' | PhoneNumberEnvironmentType;
type BuyStep = 'search' | 'confirm';

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
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Buying and releasing numbers bills the platform account, so only admins can. */
  readonly isAdmin = computed(() => this.authService.role() === 'admin');

  readonly buyCountries = BUY_COUNTRIES;
  readonly phoneNumberTypeLabel = phoneNumberTypeLabel;
  readonly formatMonthlyPrice = formatMonthlyPrice;

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

  readonly releasingId = signal<string | null>(null);
  readonly reconciling = signal(false);

  /** Purchases still in flight or stuck — what Reconcile settles. */
  readonly provisioningCount = computed(() => this.numbers().filter((n) => n.status === 'Provisioning').length);

  // Buy-number dialog
  showBuyForm = false;
  readonly buyStep = signal<BuyStep>('search');
  readonly buyCountry = signal<BuyCountry>(BUY_COUNTRIES[0]);
  buyType: PhoneNumberType = BUY_COUNTRIES[0].numberTypes[0];
  buyAreaCode = '';
  buyRegion = '';
  buyContains = '';
  readonly searching = signal(false);
  readonly searchResults = signal<AvailablePhoneNumber[]>([]);
  readonly searchError = signal('');
  readonly selectedNumber = signal<AvailablePhoneNumber | null>(null);
  buyLabel = '';
  buyNotes = '';
  buyEnvironmentType: PhoneNumberEnvironmentType | '' = '';
  buyError = '';
  purchasing = false;
  private searchSub: Subscription | null = null;

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
    const list = this.numbers().filter((n) => n.status !== 'Released');
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
    this.destroyRef.onDestroy(() => this.searchSub?.unsubscribe());
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

  // ── Buy number ──────────────────────────────────────────

  openBuyForm(): void {
    if (!this.isAdmin()) return;
    this.showBuyForm = true;
    this.buyStep.set('search');
    this.buyAreaCode = '';
    this.buyRegion = '';
    this.buyContains = '';
    this.selectedNumber.set(null);
    this.setBuyCountry(this.buyCountry().isoCountry);
  }

  closeBuyForm(): void {
    if (this.purchasing) return;
    this.searchSub?.unsubscribe();
    this.showBuyForm = false;
  }

  setBuyCountry(isoCountry: string): void {
    const country = BUY_COUNTRIES.find((c) => c.isoCountry === isoCountry) ?? BUY_COUNTRIES[0];
    this.buyCountry.set(country);
    this.buyType = country.numberTypes[0];
    this.buyAreaCode = '';
    this.buyRegion = '';
    this.searchAvailable();
  }

  setBuyType(type: PhoneNumberType): void {
    this.buyType = type;
    this.searchAvailable();
  }

  /** Runs on country/type change and on Search/Enter — not per keystroke, to spare search rate limits. */
  searchAvailable(): void {
    const country = this.buyCountry();
    const areaCode = this.buyAreaCode.trim();
    const region = this.buyRegion.trim().toUpperCase();
    const contains = this.buyContains.replace(/\D/g, '');

    if (areaCode && !/^\d{3}$/.test(areaCode)) {
      this.searchError.set('Area code must be 3 digits');
      return;
    }
    if (region && !/^[A-Z]{2}$/.test(region)) {
      this.searchError.set('Circle must be a 2-letter code, e.g. KA');
      return;
    }

    this.searchSub?.unsubscribe();
    this.searching.set(true);
    this.searchError.set('');
    this.searchSub = this.phoneNumberService
      .searchAvailable({
        country: country.isoCountry,
        type: this.buyType,
        areaCode: country.locationFilter === 'areaCode' ? areaCode || undefined : undefined,
        region: country.locationFilter === 'region' ? region || undefined : undefined,
        contains: contains || undefined,
      })
      .subscribe({
        next: (result) => {
          this.searching.set(false);
          this.searchResults.set(result.numbers);
        },
        error: (err: unknown) => {
          this.searching.set(false);
          this.searchResults.set([]);
          this.searchError.set(this.buyErrorMessage(err, 'Could not search numbers. Try again.'));
        },
      });
  }

  /** "San Francisco, CA" (Twilio) / "KA" (Exotel circle), else the country name. */
  resultLocation(number: AvailablePhoneNumber): string {
    return [number.locality, number.region].filter((part) => !!part).join(', ') || this.buyCountry().name;
  }

  selectNumber(number: AvailablePhoneNumber): void {
    this.selectedNumber.set(number);
    this.buyLabel = '';
    this.buyNotes = '';
    this.buyEnvironmentType = '';
    this.buyError = '';
    this.buyStep.set('confirm');
  }

  backToResults(): void {
    if (this.purchasing) return;
    this.buyStep.set('search');
    this.buyError = '';
  }

  purchaseSelected(): void {
    const number = this.selectedNumber();
    if (!number || this.purchasing) return;
    if (!this.buyEnvironmentType) {
      this.buyError = 'Environment is required';
      return;
    }
    this.buyError = '';
    this.purchasing = true;
    this.phoneNumberService
      .purchase({
        country: this.buyCountry().isoCountry,
        number,
        label: this.buyLabel,
        notes: this.buyNotes,
        environmentType: this.buyEnvironmentType,
      })
      .subscribe({
        next: (purchased) => {
          this.purchasing = false;
          this.numbers.update((list) => [purchased, ...list]);
          this.toast.success(`Bought ${phoneNumberE164(purchased)}`);
          this.showBuyForm = false;
        },
        error: (err: unknown) => {
          this.purchasing = false;
          if (err instanceof HttpErrorResponse && err.status === 409) {
            // Usually taken by someone else since the search — drop it from the results.
            this.searchResults.update((list) => list.filter((n) => n.e164 !== number.e164));
          }
          this.buyError = this.buyErrorMessage(err, 'Purchase failed. You have not been charged.');
          this.toast.error('Could not buy number');
        },
      });
  }

  private buyErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse && err.status === 503) {
      return `Buying ${this.buyCountry().name} numbers isn't available right now. Try again later.`;
    }
    if (err instanceof HttpErrorResponse && err.status === 403) {
      return 'Only admins can buy numbers.';
    }
    return extractErrorMessage(err, fallback);
  }

  // ── Reconcile ───────────────────────────────────────────

  /**
   * Checks Provisioning numbers against the provider account: bought ones become Available,
   * the rest are dropped. The server only touches rows older than 10 minutes.
   */
  reconcile(): void {
    if (!this.isAdmin() || this.reconciling()) return;
    this.reconciling.set(true);
    this.phoneNumberService.reconcile().subscribe({
      next: ({ recovered, removed, unresolved }) => {
        this.reconciling.set(false);
        if (recovered.length) this.toast.success(`Recovered ${recovered.join(', ')}`);
        if (removed.length) this.toast.info(`Removed ${removed.length} purchase(s) that never went through`);
        if (unresolved.length) {
          this.toast.warning(`Couldn't verify ${unresolved.join(', ')} yet — try again later`);
        }
        if (!recovered.length && !removed.length && !unresolved.length) {
          this.toast.info('Nothing to reconcile yet — purchases are checked 10 minutes after they start');
        } else {
          this.load();
        }
      },
      error: (err: unknown) => {
        this.reconciling.set(false);
        this.toast.error(extractErrorMessage(err, 'Failed to reconcile numbers'));
      },
    });
  }

  // ── Release ─────────────────────────────────────────────

  releaseNumber(phoneNumber: PhoneNumber): void {
    if (!this.isAdmin() || this.releasingId()) return;
    if (phoneNumber.assigned_agent) {
      this.toast.error('Unassign the agent from this number before releasing it');
      return;
    }
    const e164 = phoneNumberE164(phoneNumber);
    this.confirmDialog
      .confirm({
        title: `Release ${e164}?`,
        // Legacy manually-entered numbers were never purchased.
        message: phoneNumber.purchased_at
          ? 'The number is released and billing stops. You may not be able to get the same number again.'
          : 'This manually added number will be retired and can no longer be assigned.',
        confirmLabel: 'Release number',
        tone: 'danger',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.releasingId.set(phoneNumber.id);
          return this.phoneNumberService.release(phoneNumber.id);
        }),
      )
      .subscribe({
        next: (released) => {
          this.releasingId.set(null);
          this.numbers.update((list) => list.map((n) => (n.id === released.id ? released : n)));
          this.toast.success(`Released ${e164}`);
        },
        error: (err: unknown) => {
          this.releasingId.set(null);
          this.toast.error(extractErrorMessage(err, 'Failed to release number'));
        },
      });
  }

  /** Released / in-flight numbers have no enable–disable toggle. */
  isLocked(phoneNumber: PhoneNumber): boolean {
    return phoneNumber.status === 'Released' || phoneNumber.status === 'Provisioning';
  }

  toggleStatus(phoneNumber: PhoneNumber): void {
    if (this.statusUpdatingId() || this.isLocked(phoneNumber)) return;
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
      error: (err: unknown) => {
        this.statusUpdatingId.set(null);
        this.toast.error(extractErrorMessage(err, 'Failed to update phone number status'));
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
