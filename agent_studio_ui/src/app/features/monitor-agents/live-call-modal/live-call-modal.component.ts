import { Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild, signal } from '@angular/core';
import { ActiveSession, LiveMessage } from '../../../core/models/active-session.model';
import { ActiveSessionService } from '../../../core/services/active-session.service';

const MESSAGES_POLL_MS = 4000;
const TICK_MS = 1000;
const JOIN_FEEDBACK_MS = 2000;

@Component({
  selector: 'app-live-call-modal',
  standalone: true,
  templateUrl: './live-call-modal.component.html',
  styleUrl: './live-call-modal.component.css',
})
export class LiveCallModalComponent implements OnInit, OnDestroy {
  private readonly activeSessionService = inject(ActiveSessionService);

  @Input({ required: true }) session!: ActiveSession;
  @Output() closed = new EventEmitter<void>();
  @Output() joinSession = new EventEmitter<ActiveSession>();

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  readonly messages = signal<LiveMessage[]>([]);
  readonly loading = signal(true);
  readonly joining = signal(false);
  private readonly nowMs = signal(Date.now());

  private pollHandle?: ReturnType<typeof setInterval>;
  private tickHandle?: ReturnType<typeof setInterval>;
  private joinFeedbackHandle?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.fetchMessages();
    this.pollHandle = setInterval(() => this.fetchMessages(), MESSAGES_POLL_MS);
    this.tickHandle = setInterval(() => this.nowMs.set(Date.now()), TICK_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.pollHandle);
    clearInterval(this.tickHandle);
    clearTimeout(this.joinFeedbackHandle);
  }

  private fetchMessages(): void {
    this.activeSessionService.getLiveMessages(this.session).subscribe((messages) => {
      this.messages.set(messages);
      this.loading.set(false);
      setTimeout(() => this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0);
    });
  }

  elapsedLabel(): string {
    const seconds = Math.max(0, Math.floor((this.nowMs() - new Date(this.session.startedAt).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  onJoinClick(): void {
    this.joinSession.emit(this.session);
    this.joining.set(true);
    clearTimeout(this.joinFeedbackHandle);
    this.joinFeedbackHandle = setTimeout(() => this.joining.set(false), JOIN_FEEDBACK_MS);
  }

  close(): void {
    this.closed.emit();
  }
}
