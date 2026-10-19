import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SOLUTIONS } from '../../data/solutions.data';
import { CtaBannerComponent } from '../../shared/cta-banner/cta-banner.component';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-solutions',
  imports: [RouterLink, CtaBannerComponent, RevealDirective],
  template: `
    <section class="page-hero">
      <div class="bg-grid"></div>
      <div class="orb" style="width:480px;height:480px;background:var(--brand-1);top:-200px;left:50%;transform:translateX(-50%)"></div>
      <div class="container">
        <span class="eyebrow"><span class="dot"></span> Solutions</span>
        <h1>An expert agent for <span class="text-gradient">every call</span> you make</h1>
        <p class="lead">Industry-trained conversation graphs, objection handling and lead fields — ready on day one, customisable forever.</p>
      </div>
    </section>

    <section class="section" style="padding-top: 24px">
      <div class="container grid grid-3">
        @for (s of solutions; track s.slug; let i = $index) {
          <a class="card hoverable sol" [routerLink]="['/solutions', s.slug]" appReveal [revealDelay]="(i % 2) * 100">
            <div class="row between">
              <div class="icon-tile"><i class="fa-solid {{ s.icon }}"></i></div>
              <span class="chip">{{ s.direction }}</span>
            </div>
            <h3>{{ s.name }}</h3>
            <p class="text-muted">{{ s.summary }}</p>
            <ul class="check-list">
              @for (o of s.outcomes; track o) { <li>{{ o }}</li> }
            </ul>
            <span class="more">See {{ s.agentName }} in action <i class="fa-solid fa-arrow-right"></i></span>
          </a>
        }
      </div>
    </section>

    <app-cta-banner title="Don't see your industry?" subtitle="Design a custom conversation graph with our team, or build your own in Aedon Studio." />
  `,
  styles: `
    .sol { display: flex; flex-direction: column; gap: 4px; }
    .sol h3 { font-size: 1.4rem; margin-top: 4px; }
    .check-list { margin: 8px 0 24px; font-size: 0.9rem; }
    .more { margin-top: auto; font-weight: 600; font-size: 0.9rem; color: var(--brand-2); display: inline-flex; gap: 8px; align-items: center; }
  `,
})
export class SolutionsComponent {
  readonly solutions = SOLUTIONS;
}
