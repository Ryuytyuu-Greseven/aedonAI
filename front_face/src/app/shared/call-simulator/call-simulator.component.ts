import { Component, ElementRef, OnDestroy, OnInit, computed, input, signal, viewChild } from '@angular/core';
import { Solution, TranscriptLine } from '../../core/models';
import { SOLUTIONS } from '../../data/solutions.data';
import { VoiceWaveComponent } from '../voice-wave.component';

type CallState = 'idle' | 'ringing' | 'live' | 'ended';

const TYPE_MS_PER_CHAR = 22;
const TURN_GAP_MS = 750;
const RING_MS = 1400;
const LOOP_RESTART_MS = 5000;

/**
 * Scripted, client-side replay of a sample call. No audio or backend is involved —
 * it simply types out the transcript from the solution data and tracks the active flow node.
 */
@Component({
  selector: 'app-call-simulator',
  imports: [VoiceWaveComponent],
  templateUrl: './call-simulator.component.html',
  styleUrl: './call-simulator.component.css',
})
export class CallSimulatorComponent implements OnInit, OnDestroy {
  /** When set, the simulator is locked to this solution and hides the industry switcher. */
  readonly solution = input<Solution>();
  readonly autoplay = input(false);
  readonly showFlow = input(true);

  readonly solutions = SOLUTIONS;
  readonly selected = signal<Solution>(SOLUTIONS[0]);
  readonly state = signal<CallState>('idle');
  readonly lines = signal<TranscriptLine[]>([]);
  readonly typing = signal<{ line: TranscriptLine; text: string } | null>(null);
  readonly seconds = signal(0);

  readonly current = computed(() => this.solution() ?? this.selected());
  readonly activeNode = computed(() => {
    const typing = this.typing();
    if (typing?.line.node) return typing.line.node;
    return [...this.lines()].reverse().find((l) => l.node)?.node ?? null;
  });
  readonly visitedNodes = computed(() => new Set(this.lines().map((l) => l.node).filter(Boolean)));
  readonly agentSpeaking = computed(() => this.typing()?.line.speaker === 'agent');
  readonly timer = computed(() => {
    const s = this.seconds();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  private readonly transcriptEl = viewChild<ElementRef<HTMLElement>>('transcript');
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private clock?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (this.autoplay()) this.start();
  }

  ngOnDestroy(): void {
    this.reset();
  }

  select(solution: Solution): void {
    if (solution.slug === this.current().slug) return;
    this.selected.set(solution);
    this.reset();
    this.start();
  }

  toggle(): void {
    if (this.state() === 'ringing' || this.state() === 'live') {
      this.reset();
      this.state.set('ended');
    } else {
      this.start();
    }
  }

  private start(): void {
    this.reset();
    this.state.set('ringing');
    this.schedule(() => {
      this.state.set('live');
      this.clock = setInterval(() => this.seconds.update((s) => s + 1), 1000);
      this.playLine(0);
    }, RING_MS);
  }

  private playLine(index: number): void {
    const script = this.current().conversation;
    if (index >= script.length) {
      this.finish();
      return;
    }
    const line = script[index];
    const next = () => this.schedule(() => this.playLine(index + 1), TURN_GAP_MS);

    if (line.speaker === 'customer') {
      this.typing.set({ line, text: '' });
      this.schedule(() => this.commit(line, next), 900);
      return;
    }

    let chars = 0;
    const tick = () => {
      chars = Math.min(line.text.length, chars + 2);
      this.typing.set({ line, text: line.text.slice(0, chars) });
      this.scrollToBottom();
      if (chars < line.text.length) this.schedule(tick, TYPE_MS_PER_CHAR * 2);
      else this.commit(line, next);
    };
    tick();
  }

  private commit(line: TranscriptLine, then: () => void): void {
    this.typing.set(null);
    this.lines.update((l) => [...l, line]);
    this.scrollToBottom();
    then();
  }

  private finish(): void {
    clearInterval(this.clock);
    this.state.set('ended');
    this.scrollToBottom();
    if (this.autoplay()) this.schedule(() => this.start(), LOOP_RESTART_MS);
  }

  private reset(): void {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
    clearInterval(this.clock);
    this.lines.set([]);
    this.typing.set(null);
    this.seconds.set(0);
    this.state.set('idle');
  }

  private schedule(fn: () => void, ms: number): void {
    this.timeouts.push(setTimeout(fn, ms));
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const el = this.transcriptEl()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
