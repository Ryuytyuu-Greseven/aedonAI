import { Component, Input, OnChanges, OnDestroy, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ScheduledCall } from '../../../core/models/lead.model';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { LeadService } from '../../../core/services/lead.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

type ScheduleView = 'upcoming' | 'past';

const SCHEDULED_LIMIT = 20;

/**
 * The agent's call queue: upcoming missed-call retries (with Call now / Cancel) and past ones
 * (placed, failed or cancelled). Due times are shown in the agent's time zone.
 */
@Component({
  selector: 'app-scheduled-calls',
  standalone: true,
  templateUrl: './scheduled-calls.component.html',
  styleUrls: ['../leads/leads.component.css', './scheduled-calls.component.css'],
})
export class ScheduledCallsComponent implements OnChanges, OnDestroy {
  private readonly leadService = inject(LeadService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) agentId!: string;

  readonly view = signal<ScheduleView>('upcoming');
  readonly loading = signal(true);
  readonly calls = signal<ScheduledCall[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly timezone = signal('Asia/Kolkata');
  readonly maxRetries = signal(0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / SCHEDULED_LIMIT)));
  /** Ids with a Call now / Cancel request in flight. */
  readonly busyIds = signal<ReadonlySet<string>>(new Set());
  /** Ticks every 30s so "in 2h 10m" stays current. */
  readonly now = signal(Date.now());
  private readonly ticker = setInterval(() => this.now.set(Date.now()), 30_000);

  ngOnChanges(): void {
    if (!this.agentId) return;
    this.page.set(1);
    this.load();
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }

  setView(view: ScheduleView): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.page.set(1);
    this.load();
  }

  refresh(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.leadService.getScheduledCalls(this.agentId, this.view(), this.page(), SCHEDULED_LIMIT).subscribe({
      next: (result) => {
        this.calls.set(result.calls);
        this.total.set(result.total);
        this.timezone.set(result.timezone);
        this.maxRetries.set(result.max_retries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load scheduled calls');
      },
    });
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

  // ── Labels ──────────────────────────────────────────────

  reasonLabel(call: ScheduledCall): string {
    if (call.reason === 'missed_retry') {
      const max = this.maxRetries();
      return `Missed call · retry ${call.attempt}${max >= call.attempt ? ` of ${max}` : ''}`;
    }
    return call.reason;
  }

  sourceLabel(call: ScheduledCall): string {
    return call.lead_source === 'meta' ? 'Page lead' : 'Manual lead';
  }

  /** "Sat, Oct 31, 9:00 AM IST" in the agent's time zone. */
  dueLabel(iso: string): string {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: this.timezone(),
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(iso));
    } catch {
      return new Date(iso).toLocaleString();
    }
  }

  /** "in 2h 10m", "in 3 days", or "due now" once the time has passed (the next dialer run picks it up). */
  relativeLabel(iso: string): string {
    const minutes = Math.round((new Date(iso).getTime() - this.now()) / 60_000);
    if (minutes <= 0) return 'due now';
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
    const days = Math.round(hours / 24);
    return `in ${days} day${days === 1 ? '' : 's'}`;
  }

  statusLabel(call: ScheduledCall): string {
    switch (call.status) {
      case 'pending':
        return 'Scheduled';
      case 'dialing':
        return 'Calling…';
      case 'done':
        return 'Placed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
    }
  }

  isBusy(call: ScheduledCall): boolean {
    return this.busyIds().has(call.id);
  }

  // ── Actions ─────────────────────────────────────────────

  /** Calls the lead right away; the server cancels this queued retry when the call is placed. */
  callNow(call: ScheduledCall): void {
    if (call.status !== 'pending' || this.isBusy(call)) return;
    this.confirmDialog
      .confirm({
        title: 'Call now?',
        message: `The agent will call ${call.lead_name || call.phone_number} right away instead of at the scheduled time.`,
        confirmLabel: 'Call now',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const request: Observable<unknown> =
          call.lead_source === 'meta'
            ? this.leadService.callPageLead(call.lead_key)
            : this.leadService.callManualLead(this.agentId, call.lead_key);
        this.runAction(call, request, `Calling ${call.lead_name || call.phone_number}…`, 'The call could not be placed');
      });
  }

  cancel(call: ScheduledCall): void {
    if (call.status !== 'pending' || this.isBusy(call)) return;
    this.confirmDialog
      .confirm({
        title: 'Cancel this call?',
        message: `${call.lead_name || call.phone_number} won't be called at ${this.dueLabel(call.due_at)}. Later retries won't happen either unless a new call is missed.`,
        confirmLabel: 'Cancel call',
        cancelLabel: 'Keep',
        tone: 'danger',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.runAction(
          call,
          this.leadService.cancelScheduledCall(this.agentId, call.id),
          'Scheduled call cancelled',
          'Could not cancel the call',
        );
      });
  }

  private runAction(call: ScheduledCall, request: Observable<unknown>, success: string, failure: string): void {
    this.setBusy(call.id, true);
    request.subscribe({
      next: () => {
        this.setBusy(call.id, false);
        this.toast.success(success);
        this.load();
      },
      error: (err: unknown) => {
        this.setBusy(call.id, false);
        this.toast.error(extractErrorMessage(err, failure));
        this.load();
      },
    });
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update((ids) => {
      const next = new Set(ids);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
