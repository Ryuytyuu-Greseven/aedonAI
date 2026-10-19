import { Component, inject } from '@angular/core';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './confirm-dialog.component.html',
  styles: `
    .confirm-copy {
      margin: 0 0 4px;
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.55;
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirmDialogService = inject(ConfirmDialogService);

  confirm(): void {
    this.confirmDialogService.resolve(true);
  }

  cancel(): void {
    this.confirmDialogService.resolve(false);
  }
}
