import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

export type ModalTone = 'brand' | 'warning' | 'danger' | 'success';

let nextId = 0;

/**
 * Shared dialog shell: native top-layer dialog, blurred backdrop, animated panel,
 * icon header with title/subtitle and a close button.
 * Body content is projected as-is; footer actions go in an element marked `modal-footer`.
 * Promotes to browser Top Layer (showModal) so it stays above all headers, rails, action bars,
 * and parent stacking contexts.
 * Closes on backdrop click and Escape, and focuses the first form field when opened.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
  host: {
    '[attr.title]': 'null',
  },
})
export class ModalComponent implements OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
  readonly tone = input<ModalTone>('brand');
  readonly width = input(460);

  readonly closed = output<void>();

  readonly titleId = `app-modal-title-${nextId++}`;

  @ViewChild('dialogEl') readonly dialogEl?: ElementRef<HTMLDialogElement>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private isClosing = false;
  private previousOverflow: string | null = null;

  constructor() {
    afterNextRender(() => {
      // Prevent the custom element from displaying a native browser tooltip for its title input
      this.host.nativeElement.removeAttribute('title');

      const dialog = this.dialogEl?.nativeElement;
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }

      // Lock body scroll while modal is active
      if (typeof document !== 'undefined') {
        this.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }

      this.host.nativeElement
        .querySelector<HTMLElement>(
          '.modal-body input:not([disabled]):not([type=radio]):not([type=checkbox]), .modal-body textarea, .modal-body select'
        )
        ?.focus();
    });
  }

  ngOnDestroy(): void {
    this.restoreBodyScroll();
    const dialog = this.dialogEl?.nativeElement;
    if (dialog && dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.isClosing) {
      return;
    }
    this.isClosing = true;
    this.restoreBodyScroll();
    const dialog = this.dialogEl?.nativeElement;
    if (dialog && dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }
    this.closed.emit();
  }

  private restoreBodyScroll(): void {
    if (typeof document !== 'undefined' && this.previousOverflow !== null) {
      document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }
}
