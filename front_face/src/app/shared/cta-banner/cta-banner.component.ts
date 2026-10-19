import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../reveal.directive';

@Component({
  selector: 'app-cta-banner',
  imports: [RouterLink, RevealDirective],
  template: `
    <section class="section-tight">
      <div class="container">
        <div class="banner" appReveal>
          <div class="orb" style="width:340px;height:340px;background:var(--brand-1);top:-120px;left:-80px"></div>
          <div class="orb" style="width:300px;height:300px;background:var(--brand-2);bottom:-140px;right:-60px"></div>
          <h2>{{ title() }}</h2>
          <p class="lead">{{ subtitle() }}</p>
          <div class="row center">
            <a class="btn btn-primary" routerLink="/contact">Book a demo <i class="fa-solid fa-arrow-right"></i></a>
            <a class="btn btn-ghost" routerLink="/pricing">See pricing</a>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrl: './cta-banner.component.css',
})
export class CtaBannerComponent {
  readonly title = input('Put your first voice agent on the phone this week.');
  readonly subtitle = input('Start from a template, teach it your business, and preview a real call in under 30 minutes.');
}
