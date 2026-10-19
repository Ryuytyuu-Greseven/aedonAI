import { Component, computed, input } from '@angular/core';

/** Decorative animated equaliser bars; `active` pauses/resumes the animation. */
@Component({
  selector: 'app-voice-wave',
  template: `
    <div class="wave" [class.active]="active()" aria-hidden="true">
      @for (bar of bars(); track $index) {
        <span [style.animation-delay.ms]="bar.delay" [style.--h]="bar.height"></span>
      }
    </div>
  `,
  styles: `
    .wave { display: flex; align-items: center; gap: 4px; height: 100%; }
    span {
      flex: 1; min-width: 3px; height: 18%;
      border-radius: 99px;
      background: var(--gradient-brand);
      opacity: 0.5;
      transition: height 300ms var(--ease);
    }
    .active span { animation: talk 1.1s ease-in-out infinite; opacity: 1; }
    @keyframes talk {
      0%, 100% { height: 18%; }
      50% { height: var(--h); }
    }
  `,
})
export class VoiceWaveComponent {
  readonly count = input(32);
  readonly active = input(true);

  readonly bars = computed(() =>
    Array.from({ length: this.count() }, (_, i) => ({
      delay: (i * 73) % 900,
      height: `${30 + ((i * 37) % 70)}%`,
    })),
  );
}
