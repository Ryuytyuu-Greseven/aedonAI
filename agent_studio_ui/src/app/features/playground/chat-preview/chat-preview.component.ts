import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { buildAgentSetup } from '../../../core/audio-processor/agent-setup';
import { AudioProcessorWsService } from '../../../core/audio-processor/audio-processor-ws.service';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';

type ChatMessage = { id: string; speaker: 'agent' | 'customer'; text: string; at: string };

@Component({
  selector: 'app-chat-preview',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-preview.component.html',
  styleUrl: './chat-preview.component.css',
  providers: [AudioProcessorWsService],
})
export class ChatPreviewComponent implements OnInit, OnChanges, OnDestroy {
  private readonly ws = inject(AudioProcessorWsService);
  private readonly agentService = inject(AgentService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) agentId!: string;
  @Output() passed = new EventEmitter<void>();

  readonly started = signal(false);
  readonly transcript = signal<ChatMessage[]>([]);
  readonly sessionEnded = signal(false);
  readonly customerMessageCount = signal(0);
  readonly agentReplyCount = signal(0);
  readonly agentTyping = signal(false);
  messageDraft = '';

  private captionBuffer = '';
  private subscribed = false;

  get canEndChat(): boolean {
    return this.customerMessageCount() > 0 && this.agentReplyCount() > 0 && !this.sessionEnded();
  }

  ngOnInit(): void {
    this.resetState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agentId'] && !changes['agentId'].firstChange) {
      this.ws.disconnect();
      this.resetState();
    }
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
  }

  private resetState(): void {
    this.started.set(false);
    this.transcript.set([]);
    this.sessionEnded.set(false);
    this.customerMessageCount.set(0);
    this.agentReplyCount.set(0);
    this.agentTyping.set(false);
    this.messageDraft = '';
    this.captionBuffer = '';
  }

  startChat(): void {
    if (!this.agentId || this.started()) return;
    this.openSession();
  }

  /** Reset and start a fresh conversation after one has ended. */
  startNewChat(): void {
    if (!this.agentId) return;
    this.ws.disconnect();
    this.resetState();
    this.openSession();
  }

  private openSession(): void {
    this.started.set(true);
    this.subscribeToServer();

    this.agentService.getAgent(this.agentId).subscribe({
      next: (agent) => this.ws.connect(buildAgentSetup(agent)),
      error: () => {
        this.started.set(false);
        this.toast.error('Failed to load agent for chat');
      },
    });
  }

  private subscribeToServer(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      if (status === 'error') {
        this.toast.error('Chat connection failed');
      }
    });

    this.ws.turnStart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.captionBuffer = '';
      this.agentTyping.set(true);
    });

    // Accumulate caption text; ignore the audio parts entirely for a text-only UI.
    this.ws.assistantText$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((text) => {
      this.captionBuffer += text;
    });

    // A completed turn is a real agent reply regardless of whether it carried caption
    // text (the response may be audio-only), so the End Chat gate must not depend on
    // caption text arriving.
    this.ws.turnComplete$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const reply = this.captionBuffer.trim();
      this.captionBuffer = '';
      this.agentTyping.set(false);
      if (reply) {
        this.addMessage('agent', reply);
      }
      this.agentReplyCount.update((c) => c + 1);
    });

    this.ws.error$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      this.toast.error(message || 'Chat error');
    });
  }

  private addMessage(speaker: 'agent' | 'customer', text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.transcript.update((t) => [
      ...t,
      { id: `${speaker}-${t.length}-${Date.now()}`, speaker, text: trimmed, at: new Date().toISOString() },
    ]);
  }

  sendMessage(): void {
    const text = this.messageDraft.trim();
    if (!text || !this.started() || this.sessionEnded()) return;
    this.messageDraft = '';
    // Render and count the customer message locally — we know it was sent, so the
    // End Chat gate does not depend on the server echoing it back as userContent.
    this.addMessage('customer', text);
    this.customerMessageCount.update((c) => c + 1);
    this.ws.sendText(text);
  }

  endChat(): void {
    if (!this.canEndChat) return;
    this.sessionEnded.set(true);
    this.ws.disconnect();
    this.passed.emit();
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
}
