import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/** Adds `.in-view` once the host scrolls into the viewport (pairs with the global `.reveal` class). */
@Directive({ selector: '[appReveal]', host: { class: 'reveal' } })
export class RevealDirective implements OnInit, OnDestroy {
  readonly revealDelay = input(0);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.el.nativeElement;
    node.style.transitionDelay = `${this.revealDelay()}ms`;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('in-view');
      return;
    }
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('in-view');
          this.observer?.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
