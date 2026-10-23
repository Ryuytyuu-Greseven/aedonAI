import { Component, DestroyRef, Input, OnChanges, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { ProductStatsRow, ProductStatsSort, SortOrder } from '../../../core/models/product-stats.model';
import { ProductStatsService } from '../../../core/services/product-stats.service';
import { AgentPropertiesComponent } from '../../playground/agent-properties/agent-properties.component';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

type RangeDays = 7 | 14 | 30;

interface StatsColumn {
  key: ProductStatsSort;
  label: string;
  numeric: boolean;
  hint?: string;
}

@Component({
  selector: 'app-product-stats',
  standalone: true,
  imports: [FormsModule, AgentPropertiesComponent],
  templateUrl: './product-stats.component.html',
  styleUrl: './product-stats.component.css',
})
export class ProductStatsComponent implements OnChanges {
  private readonly productStatsService = inject(ProductStatsService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) agentId!: string;

  readonly rangeOptions: RangeDays[] = [7, 14, 30];
  readonly columns: StatsColumn[] = [
    { key: 'name', label: 'Product', numeric: false },
    { key: 'enquiries', label: 'Enquiries', numeric: true, hint: 'Calls in which this product was discussed' },
    { key: 'uniqueCallers', label: 'Unique callers', numeric: true, hint: 'Distinct phone numbers that asked about it' },
    { key: 'shortlisted', label: 'Shortlisted', numeric: true },
    { key: 'purchaseIntent', label: 'Purchase intent', numeric: true, hint: 'Calls where the customer said they want it' },
    { key: 'siteVisits', label: 'Site visits', numeric: true, hint: 'Visits / test rides booked for it' },
    { key: 'conversionRate', label: 'Conversion', numeric: true, hint: 'Purchase intent ÷ enquiries' },
    { key: 'lastEnquiredAt', label: 'Last enquired', numeric: false },
  ];

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly rows = signal<ProductStatsRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly search = signal('');
  readonly rangeDays = signal<RangeDays>(14);
  readonly sort = signal<ProductStatsSort>('enquiries');
  readonly order = signal<SortOrder>('desc');

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  /** Products are on file but none were enquired about in this range — common right after launch. */
  readonly noEnquiriesYet = computed(() => this.rows().length > 0 && this.rows().every((r) => r.enquiries === 0));

  private readonly searchInput$ = new Subject<string>();
  private request?: Subscription;

  constructor() {
    this.searchInput$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.page.set(1);
        this.load();
      });
  }

  ngOnChanges(): void {
    if (!this.agentId) return;
    this.page.set(1);
    this.load();
  }

  load(): void {
    // Drop any in-flight request so a slow earlier response can't overwrite a newer one.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.request = this.productStatsService
      .getProductStats(this.agentId, {
        page: this.page(),
        limit: PAGE_SIZE,
        search: this.search().trim() || undefined,
        fromDate: this.rangeStart(this.rangeDays()),
        sort: this.sort(),
        order: this.order(),
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  setRange(days: RangeDays): void {
    if (this.rangeDays() === days) return;
    this.rangeDays.set(days);
    this.page.set(1);
    this.load();
  }

  /** Same column flips direction; a new column starts high-to-low (A–Z for the name). */
  sortBy(key: ProductStatsSort): void {
    if (this.sort() === key) {
      this.order.update((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sort.set(key);
      this.order.set(key === 'name' ? 'asc' : 'desc');
    }
    this.page.set(1);
    this.load();
  }

  ariaSort(key: ProductStatsSort): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== key) return 'none';
    return this.order() === 'asc' ? 'ascending' : 'descending';
  }

  prevPage(): void {
    if (this.page() === 1) return;
    this.page.update((p) => p - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() === this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  formatConversion(row: ProductStatsRow): string {
    return row.enquiries === 0 ? '—' : `${Math.round(row.conversion_rate * 100)}%`;
  }

  formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  /** Start of the local day `days - 1` days ago, so "Last 7 days" includes today. */
  private rangeStart(days: RangeDays): string {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return new Date(start.getTime() - (days - 1) * DAY_MS).toISOString();
  }
}
