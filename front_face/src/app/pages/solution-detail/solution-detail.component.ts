import { Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { SOLUTIONS } from '../../data/solutions.data';
import { CallSimulatorComponent } from '../../shared/call-simulator/call-simulator.component';
import { CtaBannerComponent } from '../../shared/cta-banner/cta-banner.component';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-solution-detail',
  imports: [RouterLink, CallSimulatorComponent, CtaBannerComponent, RevealDirective],
  templateUrl: './solution-detail.component.html',
  styleUrl: './solution-detail.component.css',
})
export class SolutionDetailComponent {
  /** Bound from the `:slug` route param. */
  readonly slug = input.required<string>();

  readonly solution = computed(() => SOLUTIONS.find((s) => s.slug === this.slug()));
  readonly others = computed(() => SOLUTIONS.filter((s) => s.slug !== this.slug()));

  private readonly router = inject(Router);
  private readonly title = inject(Title);

  constructor() {
    effect(() => {
      const solution = this.solution();
      if (solution) this.title.setTitle(`${solution.name} voice agents · Aedon AI`);
      else this.router.navigateByUrl('/solutions');
    });
  }
}
