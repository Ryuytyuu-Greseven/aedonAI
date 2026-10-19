import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActionItem, ActionItemStatus, ActionItemType } from '../../../core/models/action-item.model';
import { CallRecord } from '../../../core/models/call-record.model';
import { ActionItemService } from '../../../core/services/action-item.service';

type StatusFilter = 'all' | ActionItemStatus;
type TypeFilter = 'all' | ActionItemType;

const PAGE_SIZE = 5;

@Component({
  selector: 'app-action-items',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './action-items.component.html',
  styleUrl: './action-items.component.css',
})
export class ActionItemsComponent implements OnChanges {
  private readonly actionItemService = inject(ActionItemService);

  @Input({ required: true }) agentId!: string;
  @Output() openCall = new EventEmitter<CallRecord>();

  readonly loading = signal(true);
  readonly items = signal<ActionItem[]>([]);

  readonly status = signal<StatusFilter>('open');
  readonly type = signal<TypeFilter>('all');
  readonly search = signal<string>('');
  readonly page = signal(1);

  readonly filtered = computed(() => {
    let list = this.items();
    const status = this.status();
    if (status !== 'all') list = list.filter((item) => item.status === status);
    const type = this.type();
    if (type !== 'all') list = list.filter((item) => item.type === type);
    const query = this.search().trim().toLowerCase();
    if (query) {
      list = list.filter(
        (item) => item.phone_number.toLowerCase().includes(query) || (item.customer_name?.toLowerCase().includes(query) ?? false)
      );
    }
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));

  readonly pagedItems = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly hasAnyFilter = computed(() => this.status() !== 'open' || this.type() !== 'all' || !!this.search());

  ngOnChanges(): void {
    if (!this.agentId) return;
    this.loading.set(true);
    this.page.set(1);
    this.actionItemService.getActionItemsForAgent(this.agentId).subscribe((items) => {
      this.items.set(items);
      this.loading.set(false);
    });
  }

  setStatus(value: StatusFilter): void {
    this.status.set(value);
    this.page.set(1);
  }

  setType(value: TypeFilter): void {
    this.type.set(value);
    this.page.set(1);
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  clearFilters(): void {
    this.status.set('open');
    this.type.set('all');
    this.search.set('');
    this.page.set(1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
  }

  toggleDone(item: ActionItem): void {
    const next: ActionItemStatus = item.status === 'open' ? 'done' : 'open';
    this.actionItemService.setStatus(item.id, next);
    this.items.update((current) => current.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
  }

  viewCall(item: ActionItem): void {
    this.openCall.emit(item.call);
  }

  typeLabel(type: ActionItemType): string {
    return type === 'callback' ? 'Callback' : 'Issue';
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  dueLabel(item: ActionItem): string | null {
    if (!item.due_at) return null;
    const dueMs = new Date(item.due_at).getTime();
    const diffMs = dueMs - Date.now();
    if (diffMs <= 0) return `Was due ${this.formatDateTime(item.due_at)}`;

    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `Due in ${minutes}m (${this.formatDateTime(item.due_at)})`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Due in ${hours}h (${this.formatDateTime(item.due_at)})`;
    const days = Math.round(hours / 24);
    return `Due in ${days}d (${this.formatDateTime(item.due_at)})`;
  }
}
