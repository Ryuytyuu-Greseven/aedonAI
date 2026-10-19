import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { CallDetail, CallRecord } from '../../../core/models/call-record.model';
import { CallRecordService } from '../../../core/services/call-record.service';
import { CurrencyService } from '../../../core/services/currency.service';

@Component({
  selector: 'app-call-detail-modal',
  standalone: true,
  templateUrl: './call-detail-modal.component.html',
  styleUrl: './call-detail-modal.component.css',
})
export class CallDetailModalComponent implements OnInit {
  private readonly callRecordService = inject(CallRecordService);
  readonly currencyService = inject(CurrencyService);

  @Input({ required: true }) record!: CallRecord;
  @Output() closed = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly detail = signal<CallDetail | null>(null);
  private readonly expandedReasoning = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    try {
      this.callRecordService.getCallDetail(this.record.id).subscribe((detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      });
    } catch (error) {
      console.log('Unable to fetch call record');
    }
  }

  close(): void {
    this.closed.emit();
  }

  toggleReasoning(turnId: string): void {
    this.expandedReasoning.update((current) => {
      const next = new Set(current);
      if (next.has(turnId)) {
        next.delete(turnId);
      } else {
        next.add(turnId);
      }
      return next;
    });
  }

  isReasoningExpanded(turnId: string): boolean {
    return this.expandedReasoning().has(turnId);
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }

  outcomeLabel(outcome: CallRecord['outcome']): string {
    switch (outcome) {
      case 'lead':
        return 'Lead';
      case 'no_answer':
        return 'No answer';
      case 'completed':
        return 'Completed';
    }
  }

  formatToolInput(input: Record<string, unknown>): string {
    return Object.entries(input)
      .map(([key, value]) => `${key}: ${value}`)
      .join('  ·  ');
  }
}
