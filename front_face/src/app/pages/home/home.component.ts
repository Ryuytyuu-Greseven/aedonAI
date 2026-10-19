import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HERO_LIVE_CALLS, HERO_STATS, INTEGRATIONS, LANGUAGES, PLATFORM_FEATURES, SAMPLE_LEAD, STEPS } from '../../data/content.data';
import { SOLUTIONS } from '../../data/solutions.data';
import { CallSimulatorComponent } from '../../shared/call-simulator/call-simulator.component';
import { CtaBannerComponent } from '../../shared/cta-banner/cta-banner.component';
import { FaqListComponent } from '../../shared/faq-list.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { VoiceWaveComponent } from '../../shared/voice-wave.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, CallSimulatorComponent, CtaBannerComponent, FaqListComponent, RevealDirective, VoiceWaveComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly stats = HERO_STATS;
  readonly liveCalls = HERO_LIVE_CALLS;
  readonly steps = STEPS;
  readonly solutions = SOLUTIONS;
  readonly features = PLATFORM_FEATURES.slice(0, 6);
  readonly integrations = INTEGRATIONS;
  readonly languages = LANGUAGES;
  readonly lead = SAMPLE_LEAD;
  readonly exports = [
    { icon: 'fa-solid fa-code', label: 'Your API / CRM' },
    { icon: 'fa-brands fa-whatsapp', label: 'WhatsApp' },
    { icon: 'fa-solid fa-envelope', label: 'Email' },
    { icon: 'fa-solid fa-message', label: 'SMS' },
    { icon: 'fa-solid fa-file-excel', label: 'Excel report' },
  ];
}
