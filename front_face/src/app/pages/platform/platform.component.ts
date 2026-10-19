import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { INTEGRATIONS, PLATFORM_FEATURES } from '../../data/content.data';
import { CtaBannerComponent } from '../../shared/cta-banner/cta-banner.component';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-platform',
  imports: [RouterLink, CtaBannerComponent, RevealDirective],
  templateUrl: './platform.component.html',
  styleUrl: './platform.component.css',
})
export class PlatformComponent {
  readonly features = PLATFORM_FEATURES;
  readonly integrations = INTEGRATIONS;

  /** Nodes drawn around the router in the studio illustration. */
  readonly graphNodes = ['Greeting', 'Discovery', 'Presentation', 'Objection', 'FAQ · RAG', 'Closing'];

  readonly pipeline = [
    { icon: 'fa-phone', title: 'Telephony', text: 'Twilio · Exotel · Web call' },
    { icon: 'fa-wave-square', title: 'Streaming STT', text: 'Multilingual, code-switching' },
    { icon: 'fa-route', title: 'Semantic router', text: 'Picks the next node per turn' },
    { icon: 'fa-brain', title: 'Node LLM + tools', text: 'Prompt, knowledge base, APIs' },
    { icon: 'fa-volume-high', title: 'Neural TTS', text: 'Locale-matched voices' },
    { icon: 'fa-chart-pie', title: 'Post-call analysis', text: 'Leads, scores, action items' },
  ];

  readonly trust = [
    { icon: 'fa-lock', title: 'Encrypted end-to-end', text: 'TLS in transit, encrypted at rest. Recordings and transcripts stay in your workspace.' },
    { icon: 'fa-user-shield', title: 'Role-based access', text: 'Company workspaces, team roles and audit-friendly version history on every change.' },
    { icon: 'fa-file-signature', title: 'Consent-first scripts', text: 'Built-in consent and do-not-call handling keep every outbound campaign compliant.' },
  ];
}
