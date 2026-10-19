import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type ConfirmTone = 'brand' | 'danger';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
}

/** Destructive-sounding actions get the danger styling unless the caller says otherwise. */
const DANGER_LABEL = /delete|disable|disconnect|remove|unlink/i;

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly request = signal<ConfirmRequest | null>(null);
  private result$: Subject<boolean> | null = null;

  confirm(options: Partial<ConfirmRequest> & { title: string; message: string }): Observable<boolean> {
    this.result$ = new Subject<boolean>();
    const confirmLabel = options.confirmLabel ?? 'Confirm';
    this.request.set({
      title: options.title,
      message: options.message,
      confirmLabel,
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone: options.tone ?? (DANGER_LABEL.test(confirmLabel) ? 'danger' : 'brand'),
    });
    return this.result$.asObservable();
  }

  resolve(confirmed: boolean): void {
    this.result$?.next(confirmed);
    this.result$?.complete();
    this.result$ = null;
    this.request.set(null);
  }
}
