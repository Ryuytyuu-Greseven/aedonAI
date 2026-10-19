import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VoiceWaveComponent } from '../../shared/voice-wave.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, VoiceWaveComponent],
  template: `
    <section class="page-hero nf">
      <div class="bg-grid"></div>
      <div class="container">
        <div class="wave"><app-voice-wave [count]="24" [active]="false" /></div>
        <h1>404 — <span class="text-gradient">line's gone quiet</span></h1>
        <p class="lead">The page you're looking for doesn't exist or has moved.</p>
        <a class="btn btn-primary" routerLink="/">Back to home</a>
      </div>
    </section>
  `,
  styles: `
    .nf { min-height: 80vh; display: grid; align-items: center; }
    .wave { width: 200px; height: 60px; margin: 0 auto 24px; }
  `,
})
export class NotFoundComponent {}
