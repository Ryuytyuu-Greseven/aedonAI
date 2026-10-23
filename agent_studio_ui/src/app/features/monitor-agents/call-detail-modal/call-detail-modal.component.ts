import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { CallDetail, CallRecord, CallSpeaker } from '../../../core/models/call-record.model';
import { CallRecordService } from '../../../core/services/call-record.service';

const SPEAKER_LABELS: Record<CallSpeaker, string> = {
  agent: 'Agent',
  customer: 'Customer',
  human: 'Human agent',
};

@Component({
  selector: 'app-call-detail-modal',
  standalone: true,
  templateUrl: './call-detail-modal.component.html',
  styleUrl: './call-detail-modal.component.css',
})
export class CallDetailModalComponent implements OnInit {
  private readonly callRecordService = inject(CallRecordService);

  /** The agent's API id — `record.agent_id` is its agent_id, which the route doesn't take. */
  @Input({ required: true }) agentId!: string;
  @Input({ required: true }) record!: CallRecord;
  @Output() closed = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly detail = signal<CallDetail | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.callRecordService.getCallDetail(this.agentId, this.record.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  speakerLabel(speaker: CallSpeaker): string {
    return SPEAKER_LABELS[speaker];
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null) return 'In progress';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }
}
