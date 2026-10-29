import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { buildAgentSetup } from '../../../core/audio-processor/agent-setup';
import { AudioProcessorWsService } from '../../../core/audio-processor/audio-processor-ws.service';
import { PcmCaptureService } from '../../../core/audio-processor/pcm-capture.service';
import { PcmPlaybackService } from '../../../core/audio-processor/pcm-playback.service';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';

type WebCallStatus = 'idle' | 'connecting' | 'active' | 'ended';
type AssistantState = 'idle' | 'speaking' | 'listening';
type WebCallMessage = { id: string; speaker: 'agent' | 'customer'; text: string };

@Component({
  selector: 'app-web-call-preview',
  standalone: true,
  imports: [],
  templateUrl: './web-call-preview.component.html',
  styleUrl: './web-call-preview.component.css',
  providers: [AudioProcessorWsService, PcmCaptureService, PcmPlaybackService],
})
export class WebCallPreviewComponent implements OnChanges, OnDestroy {
  private readonly ws = inject(AudioProcessorWsService);
  private readonly capture = inject(PcmCaptureService);
  private readonly playback = inject(PcmPlaybackService);
  private readonly agentService = inject(AgentService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  @Input({ required: true }) agentId!: string;
  @Output() passed = new EventEmitter<void>();

  readonly callStatus = signal<WebCallStatus>('idle');
  readonly assistantState = signal<AssistantState>('idle');
  readonly messages = signal<WebCallMessage[]>([]);
  readonly liveCaption = signal('');
  readonly previewPassed = signal(false);
  readonly micLevel = signal(0);

  private readonly conversation = viewChild<ElementRef<HTMLElement>>('conversation');

  /** Static set of bars for the voice visualizer; each gets a staggered animation. */
  readonly waveBars = Array.from({ length: 9 });

  private completedTurns = 0;
  private captionBuffer = '';
  private subscribed = false;
  private isEndingCall = false;

  constructor() {
    // Keep the newest message in view: scroll the conversation to the bottom after each render that adds one.
    effect(() => {
      this.messages();
      afterNextRender(
        () => {
          const el = this.conversation()?.nativeElement;
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        },
        { injector: this.injector },
      );
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agentId'] && !changes['agentId'].firstChange) {
      this.endCall();
      this.reset();
    }
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  startCall(): void {
    if (!this.agentId || this.callStatus() === 'connecting' || this.callStatus() === 'active') return;

    this.reset();
    this.callStatus.set('connecting');
    this.subscribeToServer();

    this.agentService.getAgent(this.agentId).subscribe({
      next: (agent) => {
        this.ws.connect(buildAgentSetup(agent));
      },
      error: () => {
        this.callStatus.set('idle');
        this.toast.error('Failed to load agent for web call');
      },
    });
  }

  endCall(): void {
    if (this.callStatus() === 'idle') return;
    const wasActive = this.callStatus() === 'active' || this.callStatus() === 'connecting';
    this.teardown();
    if (wasActive) {
      this.callStatus.set('ended');
    }
  }

  private subscribeToServer(): void {
    if (this.subscribed) return;
    this.subscribed = true;

    this.ws.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((status) => {
      if (status === 'open') {
        this.onConnected();
      } else if (status === 'error') {
        this.callStatus.set('idle');
        this.toast.error('Web call connection failed');
        this.teardown();
      }
    });

    this.ws.userText$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((text) => {
      this.appendMessage('customer', text);
    });

    this.ws.turnStart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.playback.stopImmediately();
      this.captionBuffer = '';
      this.liveCaption.set('');
      this.assistantState.set('speaking');
    });

    this.ws.assistantText$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((text) => {
      this.captionBuffer += text;
      this.liveCaption.set(this.captionBuffer);
    });

    this.ws.audioChunk$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((chunk) => {
      this.playback.enqueue(chunk);
    });

    this.ws.interrupted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.playback.stopImmediately();
      this.finalizeCaption();
      this.assistantState.set('listening');
    });

    this.ws.turnComplete$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.finalizeCaption();
      if (!this.isEndingCall) {
        this.assistantState.set('listening');
      }
      this.completedTurns += 1;
      if (this.completedTurns > 0 && !this.previewPassed()) {
        this.previewPassed.set(true);
        this.passed.emit();
      }
    });

    this.ws.endCall$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async () => {
      this.isEndingCall = true;
      // Immediately stop mic capture so caller background noise does not interrupt the farewell
      void this.capture.stop();
      // Wait for all audio to finish playing completely before ending the call
      await this.playback.waitForPlaybackToFinish(800);
      this.endCall();
    });

    this.ws.error$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((message) => {
      this.toast.error(message || 'Web call error');
    });
  }

  private onConnected(): void {
    this.callStatus.set('active');
    this.assistantState.set('listening');
    this.capture
      .start(
        (chunk) => this.ws.sendAudio(chunk),
        (level) => this.micLevel.set(level),
      )
      .catch(() => {
        this.toast.error('Microphone access denied');
        this.endCall();
      });
  }

  private appendMessage(speaker: 'agent' | 'customer', text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.messages.update((list) => [
      ...list,
      { id: `${speaker}-${list.length}-${Date.now()}`, speaker, text: trimmed },
    ]);
  }

  private finalizeCaption(): void {
    const caption = this.captionBuffer.trim();
    if (caption) {
      this.appendMessage('agent', caption);
    }
    this.captionBuffer = '';
    this.liveCaption.set('');
  }

  private teardown(): void {
    void this.capture.stop();
    this.playback.stopImmediately();
    this.ws.disconnect();
    this.assistantState.set('idle');
    this.micLevel.set(0);
    this.isEndingCall = false;
  }

  private reset(): void {
    this.messages.set([]);
    this.liveCaption.set('');
    this.callStatus.set('idle');
    this.assistantState.set('idle');
    this.previewPassed.set(false);
    this.micLevel.set(0);
    this.completedTurns = 0;
    this.captionBuffer = '';
    this.isEndingCall = false;
  }
}
