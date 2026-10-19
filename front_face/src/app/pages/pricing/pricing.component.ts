import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRICING_PLANS } from '../../data/content.data';
import { CtaBannerComponent } from '../../shared/cta-banner/cta-banner.component';
import { FaqListComponent } from '../../shared/faq-list.component';
import { RevealDirective } from '../../shared/reveal.directive';

const ANNUAL_DISCOUNT = 0.2;

@Component({
  selector: 'app-pricing',
  imports: [RouterLink, CtaBannerComponent, FaqListComponent, RevealDirective],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css',
})
export class PricingComponent {
  readonly plans = PRICING_PLANS;
  readonly annual = signal(true);

  price(monthly: number): number {
    return this.annual() ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) : monthly;
  }
}
