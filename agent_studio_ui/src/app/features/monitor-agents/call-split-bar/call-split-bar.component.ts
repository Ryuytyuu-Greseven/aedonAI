import { Component, computed, Input, signal } from '@angular/core';

@Component({
  selector: 'app-call-split-bar',
  standalone: true,
  templateUrl: './call-split-bar.component.html',
  styleUrl: './call-split-bar.component.css',
})
export class CallSplitBarComponent {
  private readonly inboundValue = signal(0);
  private readonly outboundValue = signal(0);

  @Input({ required: true }) set inbound(value: number) {
    this.inboundValue.set(value);
  }

  @Input({ required: true }) set outbound(value: number) {
    this.outboundValue.set(value);
  }

  readonly total = computed(() => this.inboundValue() + this.outboundValue());
  readonly inboundPct = computed(() => (this.total() === 0 ? 0 : Math.round((this.inboundValue() / this.total()) * 100)));
  readonly outboundPct = computed(() => (this.total() === 0 ? 0 : 100 - this.inboundPct()));

  get inboundCount(): number {
    return this.inboundValue();
  }

  get outboundCount(): number {
    return this.outboundValue();
  }
}
