import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, takeWhile } from 'rxjs';
import { COUNTRY_CODES } from '../../../core/models/phone.model';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { RealtimeEvent } from '../../../core/realtime/realtime.types';

type CallStatus = 'idle' | 'calling' | 'in-progress' | 'ended';
type PreviewMessage = { speaker: 'agent' | 'customer'; text: string };
type CallRealtimeEvent = Extract<RealtimeEvent, { callId: string }>;

function isCallEvent(event: RealtimeEvent): event is CallRealtimeEvent {
  return 'callId' in event;
}

@Component({
  selector: 'app-call-preview',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './call-preview.component.html',
  styleUrl: './call-preview.component.css',
})
export class CallPreviewComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly agentService = inject(AgentService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) agentId!: string;
  @Input() agentBusiness?: string;
  @Output() passed = new EventEmitter<void>();

  readonly countryCodes = COUNTRY_CODES;

  readonly phoneForm = this.fb.nonNullable.group({
    countryCode: [COUNTRY_CODES[0].value, Validators.required],
    number: ['', [Validators.required, Validators.pattern(/^\d{6,12}$/)]],
  });

  readonly activeCallId = signal<string | null>(null);
  readonly callStatus = signal<CallStatus>('idle');
  readonly previewMessages = signal<PreviewMessage[]>([]);
  readonly previewPassed = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agentId'] && !changes['agentId'].firstChange) {
      this.reset();
    }
  }

  private reset(): void {
    this.activeCallId.set(null);
    this.callStatus.set('idle');
    this.previewMessages.set([]);
    this.previewPassed.set(false);
    this.phoneForm.reset({ countryCode: COUNTRY_CODES[0].value, number: '' });
  }

  startPreviewCall(): void {
    if (!this.agentId) return;

    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }

    const { countryCode, number } = this.phoneForm.getRawValue();
    this.previewMessages.set([]);
    this.activeCallId.set(null);
    this.callStatus.set('calling');

    this.agentService.callCustomer(this.agentId, { countryCode, number }, this.agentBusiness).subscribe({
      next: ({ callId }) => {
        this.activeCallId.set(callId);
        this.listenToCall(callId);
      },
      error: () => {
        this.callStatus.set('idle');
        this.toast.error('Failed to start call');
      },
    });
  }

  private listenToCall(callId: string): void {
    this.realtimeService.events$
      .pipe(
        filter(isCallEvent),
        filter((event) => event.callId === callId),
        takeWhile((event) => event.type !== 'call.ended', true),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => this.handleCallEvent(event));
  }

  private handleCallEvent(event: CallRealtimeEvent): void {
    switch (event.type) {
      case 'call.started':
        this.callStatus.set('in-progress');
        break;
      case 'call.message':
        this.previewMessages.update((messages) => [...messages, { speaker: event.speaker, text: event.text }]);
        break;
      case 'call.ended':
        this.callStatus.set('ended');
        this.previewPassed.set(event.outcome === 'completed');
        if (event.outcome === 'completed') {
          this.passed.emit();
        } else {
          this.toast.error('Call did not complete successfully');
        }
        break;
    }
  }
}
