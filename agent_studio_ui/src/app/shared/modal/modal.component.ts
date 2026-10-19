import { Component, ElementRef, HostListener, afterNextRender, inject, input, output } from '@angular/core';

export type ModalTone = 'brand' | 'warning' | 'danger' | 'success';

let nextId = 0;

/**
 * Shared dialog shell: blurred backdrop, animated panel, icon header with title/subtitle and a close button.
 * Body content is projected as-is; footer actions go in an element marked `modal-footer`.
 * Closes on backdrop click and Escape, and focuses the first form field when opened.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
  readonly tone = input<ModalTone>('brand');
  readonly width = input(460);

  readonly closed = output<void>();

  readonly titleId = `app-modal-title-${nextId++}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>('.modal-body input:not([disabled]):not([type=radio]):not([type=checkbox]), .modal-body textarea, .modal-body select')?.focus();
    });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
