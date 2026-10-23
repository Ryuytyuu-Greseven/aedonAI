import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CallDirection, CallRecord } from '../../../core/models/call-record.model';
import { CallRecordService } from '../../../core/services/call-record.service';

const PAGE_SIZE = 10;

type DirectionFilter = 'all' | CallDirection;
type SourceFilter = 'all' | 'phone' | 'web';

@Component({
  selector: 'app-call-log',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './call-log.component.html',
  styleUrl: './call-log.component.css',
})
export class CallLogComponent implements OnChanges {
  private readonly callRecordService = inject(CallRecordService);

  @Input({ required: true }) agentId!: string;
  @Output() openCall = new EventEmitter<CallRecord>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly records = signal<CallRecord[]>([]);

  readonly direction = signal<DirectionFilter>('all');
  readonly source = signal<SourceFilter>('all');
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');
  readonly search = signal<string>('');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    let list = this.records();
    const dir = this.direction();
    if (dir !== 'all') list = list.filter((r) => r.direction === dir);
    const src = this.source();
    if (src !== 'all') list = list.filter((r) => (r.provider === 'webrtc' ? 'web' : 'phone') === src);
    // Compare calendar days in the viewer's timezone, matching the date inputs.
    const from = this.dateFrom();
    if (from) list = list.filter((r) => localDateKey(r.occurred_at) >= from);
    const to = this.dateTo();
    if (to) list = list.filter((r) => localDateKey(r.occurred_at) <= to);
    const query = this.search().trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          (r.phone_number?.toLowerCase().includes(query) ?? false) ||
          (r.customer_name?.toLowerCase().includes(query) ?? false)
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
    () => this.direction() !== 'all' || this.source() !== 'all' || !!this.dateFrom() || !!this.dateTo() || !!this.search()
  );

  ngOnChanges(): void {
    if (!this.agentId) return;
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.callRecordService.getRecordsForAgent(this.agentId).subscribe({
      next: (records) => {
        this.records.set(records);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  setDirection(value: DirectionFilter): void {
    this.direction.set(value);
    this.page.set(1);
  }

  setSource(value: SourceFilter): void {
    this.source.set(value);
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
    this.source.set('all');
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

  formatDuration(seconds: number | null): string {
    if (seconds === null) return '—';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
