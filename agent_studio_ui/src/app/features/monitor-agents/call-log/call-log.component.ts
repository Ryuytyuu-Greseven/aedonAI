import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CallDirection, CallOutcome, CallRecord } from '../../../core/models/call-record.model';
import { CallRecordService } from '../../../core/services/call-record.service';
import { CurrencyService } from '../../../core/services/currency.service';

const PAGE_SIZE = 10;

type DirectionFilter = 'all' | CallDirection;
type OutcomeFilter = 'all' | CallOutcome;

@Component({
  selector: 'app-call-log',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './call-log.component.html',
  styleUrl: './call-log.component.css',
})
export class CallLogComponent implements OnChanges {
  private readonly callRecordService = inject(CallRecordService);
  readonly currencyService = inject(CurrencyService);

  @Input({ required: true }) agentId!: string;
  @Output() openCall = new EventEmitter<CallRecord>();

  readonly loading = signal(true);
  readonly records = signal<CallRecord[]>([]);

  readonly direction = signal<DirectionFilter>('all');
  readonly outcome = signal<OutcomeFilter>('all');
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly search = signal<string>('');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    let list = this.records();
    const dir = this.direction();
    if (dir !== 'all') list = list.filter((r) => r.direction === dir);
    const oc = this.outcome();
    if (oc !== 'all') list = list.filter((r) => r.outcome === oc);
    const from = this.dateFrom();
    if (from) list = list.filter((r) => r.occurred_at.slice(0, 10) >= from);
    const to = this.dateTo();
    if (to) list = list.filter((r) => r.occurred_at.slice(0, 10) <= to);
    const query = this.search().trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) => r.phone_number.toLowerCase().includes(query) || (r.customer_name?.toLowerCase().includes(query) ?? false)
      );
    }
    return [...list].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  readonly pagedRecords = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly hasAnyFilter = computed(
    () => this.direction() !== 'all' || this.outcome() !== 'all' || !!this.dateFrom() || !!this.dateTo() || !!this.search()
  );

  ngOnChanges(): void {
    if (!this.agentId) return;
    this.loading.set(true);
    this.page.set(1);
    this.callRecordService.getRecordsForAgent(this.agentId).subscribe((records) => {
      this.records.set(records);
      this.loading.set(false);
    });
  }

  setDirection(value: DirectionFilter): void {
    this.direction.set(value);
    this.page.set(1);
  }

  setOutcome(value: OutcomeFilter): void {
    this.outcome.set(value);
    this.page.set(1);
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
    this.page.set(1);
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
    this.page.set(1);
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  clearFilters(): void {
    this.direction.set('all');
    this.outcome.set('all');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.search.set('');
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  rowClick(record: CallRecord): void {
    this.openCall.emit(record);
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }

  outcomeLabel(outcome: CallOutcome): string {
    switch (outcome) {
      case 'lead':
        return 'Lead';
      case 'no_answer':
        return 'No answer';
      case 'completed':
        return 'Completed';
    }
  }
}
