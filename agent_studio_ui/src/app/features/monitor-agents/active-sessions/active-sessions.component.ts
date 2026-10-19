import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { ActiveSession } from '../../../core/models/active-session.model';
import { ActiveSessionService } from '../../../core/services/active-session.service';
import { LiveCallModalComponent } from '../live-call-modal/live-call-modal.component';

const POLL_MS = 9000;
const TICK_MS = 1000;
const JOIN_FEEDBACK_MS = 2000;

@Component({
  selector: 'app-active-sessions',
  standalone: true,
  imports: [LiveCallModalComponent],
  templateUrl: './active-sessions.component.html',
  styleUrl: './active-sessions.component.css',
})
export class ActiveSessionsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) agentId!: string;
  @Output() joinSession = new EventEmitter<ActiveSession>();

  readonly sessions = signal<ActiveSession[]>([]);
  readonly loading = signal(true);
  readonly joiningSessionId = signal<string | null>(null);
  readonly viewingSession = signal<ActiveSession | null>(null);
  private readonly nowMs = signal(Date.now());

  private pollHandle?: ReturnType<typeof setInterval>;
  private tickHandle?: ReturnType<typeof setInterval>;
  private joinFeedbackHandle?: ReturnType<typeof setTimeout>;

  constructor(private readonly activeSessionService: ActiveSessionService) {}

  ngOnInit(): void {
    this.fetchSessions();
    this.pollHandle = setInterval(() => this.fetchSessions(), POLL_MS);
    this.tickHandle = setInterval(() => this.nowMs.set(Date.now()), TICK_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.pollHandle);
    clearInterval(this.tickHandle);
    clearTimeout(this.joinFeedbackHandle);
  }

  private fetchSessions(): void {
    this.activeSessionService.getActiveSessions(this.agentId).subscribe((sessions) => {
      this.sessions.set(sessions);
      this.loading.set(false);
    });
  }

  elapsedLabel(session: ActiveSession): string {
    const seconds = Math.max(0, Math.floor((this.nowMs() - new Date(session.startedAt).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }

  isJoining(sessionId: string): boolean {
    return this.joiningSessionId() === sessionId;
  }

  onJoinClick(session: ActiveSession): void {
    this.joinSession.emit(session);
    this.joiningSessionId.set(session.id);
    clearTimeout(this.joinFeedbackHandle);
    this.joinFeedbackHandle = setTimeout(() => this.joiningSessionId.set(null), JOIN_FEEDBACK_MS);
  }

  onViewClick(session: ActiveSession): void {
    this.viewingSession.set(session);
  }

  closeView(): void {
    this.viewingSession.set(null);
  }
}
