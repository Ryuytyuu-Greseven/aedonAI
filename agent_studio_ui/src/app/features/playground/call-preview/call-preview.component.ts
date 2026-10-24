import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { COUNTRY_CODES } from '../../../core/models/phone.model';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * `placed` means Twilio accepted the outbound call — the conversation itself
 * happens on the phone and isn't streamed back here.
 */
type CallStatus = 'idle' | 'calling' | 'placed';

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
  private readonly toast = inject(ToastService);

  @Input({ required: true }) agentId!: string;
  @Input() agentBusiness?: string;
  @Output() passed = new EventEmitter<void>();

  readonly countryCodes = COUNTRY_CODES;

  readonly phoneForm = this.fb.nonNullable.group({
    countryCode: [COUNTRY_CODES[0].value, Validators.required],
    number: ['', [Validators.required, Validators.pattern(/^\d{6,12}$/)]],
  });

  readonly callStatus = signal<CallStatus>('idle');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agentId'] && !changes['agentId'].firstChange) {
      this.reset();
    }
  }

  private reset(): void {
    this.callStatus.set('idle');
    this.phoneForm.reset({ countryCode: COUNTRY_CODES[0].value, number: '' });
  }

  startPreviewCall(): void {
    if (!this.agentId) return;

    if (this.phoneForm.invalid) {
      this.phoneForm.markAllAsTouched();
      return;
    }

    const { countryCode, number } = this.phoneForm.getRawValue();
    this.callStatus.set('calling');

    this.agentService.callCustomer(this.agentId, { countryCode, number }, this.agentBusiness).subscribe({
      next: () => {
        this.callStatus.set('placed');
        this.passed.emit();
      },
      error: () => {
        this.callStatus.set('idle');
        this.toast.error('Failed to start call');
      },
    });
  }
}
