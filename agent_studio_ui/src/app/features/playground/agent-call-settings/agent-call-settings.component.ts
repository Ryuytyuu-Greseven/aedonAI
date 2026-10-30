import { Component, OnChanges, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Agent, CallSettings, DEFAULT_CALL_SETTINGS, MAX_MISSED_CALL_RETRIES } from '../../../core/models/agent.model';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { TimezonePickerComponent } from '../../../shared/timezone-picker/timezone-picker.component';

type GapUnit = 'minutes' | 'hours' | 'days';

const GAP_UNIT_MINUTES: Record<GapUnit, number> = { minutes: 1, hours: 60, days: 1440 };
const MIN_GAP_MINUTES = 5;
const MAX_GAP_MINUTES = 7 * 1440;

/**
 * An agent's dialing rules: time zone, calling hours and missed-call retries. Saved on its own
 * (PATCH /agents/:id/call-settings), so a staged or live agent stays as it is.
 */
@Component({
  selector: 'app-agent-call-settings',
  standalone: true,
  imports: [ReactiveFormsModule, TimezonePickerComponent],
  templateUrl: './agent-call-settings.component.html',
  styleUrl: './agent-call-settings.component.css',
})
export class AgentCallSettingsComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly agentService = inject(AgentService);
  private readonly toast = inject(ToastService);

  readonly agentId = input.required<string>();
  readonly settings = input<CallSettings | undefined>();
  readonly saved = output<Agent>();

  readonly retryOptions = Array.from({ length: MAX_MISSED_CALL_RETRIES + 1 }, (_, i) => i);
  readonly gapUnits: GapUnit[] = ['minutes', 'hours', 'days'];
  readonly saving = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    timezone: [DEFAULT_CALL_SETTINGS.timezone],
    calling_hours_start: [DEFAULT_CALL_SETTINGS.calling_hours_start],
    calling_hours_end: [DEFAULT_CALL_SETTINGS.calling_hours_end],
    missed_call_retries: [DEFAULT_CALL_SETTINGS.missed_call_retries],
    gap_value: [6],
    gap_unit: ['hours' as GapUnit],
  });

  ngOnChanges(): void {
    const settings = { ...DEFAULT_CALL_SETTINGS, ...this.settings() };
    const gap = splitGap(settings.missed_call_retry_gap_minutes);
    this.form.reset({
      timezone: settings.timezone,
      calling_hours_start: settings.calling_hours_start,
      calling_hours_end: settings.calling_hours_end,
      missed_call_retries: settings.missed_call_retries,
      gap_value: gap.value,
      gap_unit: gap.unit,
    });
    this.error.set('');
  }

  get retriesEnabled(): boolean {
    return Number(this.form.controls.missed_call_retries.value) > 0;
  }

  save(): void {
    if (this.saving()) return;
    const value = this.form.getRawValue();
    const gapMinutes = Math.round(Number(value.gap_value) * GAP_UNIT_MINUTES[value.gap_unit]);

    if (!value.calling_hours_start || !value.calling_hours_end) {
      this.error.set('Set both calling hours');
      return;
    }
    if (value.calling_hours_start >= value.calling_hours_end) {
      this.error.set('Calling hours must start before they end');
      return;
    }
    if (!Number.isFinite(gapMinutes) || gapMinutes < MIN_GAP_MINUTES || gapMinutes > MAX_GAP_MINUTES) {
      this.error.set('Wait between retries must be from 5 minutes to 7 days');
      return;
    }

    this.error.set('');
    this.saving.set(true);
    this.agentService
      .updateCallSettings(this.agentId(), {
        timezone: value.timezone,
        calling_hours_start: value.calling_hours_start,
        calling_hours_end: value.calling_hours_end,
        missed_call_retries: Number(value.missed_call_retries),
        missed_call_retry_gap_minutes: gapMinutes,
      })
      .subscribe({
        next: (agent) => {
          this.saving.set(false);
          this.form.markAsPristine();
          this.toast.success('Calling settings saved');
          this.saved.emit(agent);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.error.set(extractErrorMessage(err, 'Could not save calling settings'));
        },
      });
  }
}

/** Shows a stored minute count in the largest whole unit: 360 → 6 hours, 1440 → 1 day. */
function splitGap(minutes: number): { value: number; unit: GapUnit } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}
