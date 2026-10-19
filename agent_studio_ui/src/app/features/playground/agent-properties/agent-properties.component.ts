import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/modal/modal.component';
import { Property } from '../../../core/models/property.model';
import { PropertyService } from '../../../core/services/property.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

@Component({
  selector: 'app-agent-properties',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './agent-properties.component.html',
  styleUrl: './agent-properties.component.css',
})
export class AgentPropertiesComponent implements OnChanges {
  private readonly propertyService = inject(PropertyService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  /** `null` until the agent has been saved at least once — properties require a real agent id. */
  @Input({ required: true }) agentId: string | null = null;

  readonly loading = signal(true);
  readonly properties = signal<Property[]>([]);

  showFormModal = false;
  editTarget: Property | null = null;
  formName = '';
  formDescription = '';
  formError = '';
  saving = false;

  ngOnChanges(): void {
    if (!this.agentId) {
      this.properties.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.propertyService.getProperties(this.agentId).subscribe({
      next: (properties) => {
        this.properties.set(properties);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load properties');
      },
    });
  }

  openAddForm(): void {
    this.editTarget = null;
    this.formName = '';
    this.formDescription = '';
    this.formError = '';
    this.showFormModal = true;
  }

  openEditForm(property: Property): void {
    this.editTarget = property;
    this.formName = property.name;
    this.formDescription = property.description ?? '';
    this.formError = '';
    this.showFormModal = true;
  }

  cancelForm(): void {
    this.showFormModal = false;
    this.formError = '';
  }

  submitForm(): void {
    const name = this.formName.trim();
    if (!name) {
      this.formError = 'Enter a name';
      return;
    }
    if (!this.agentId) return;

    this.formError = '';
    this.saving = true;
    const description = this.formDescription.trim();

    const request = this.editTarget
      ? this.propertyService.updateProperty(this.editTarget.id, { name, description })
      : this.propertyService.createProperty(this.agentId, { name, ...(description ? { description } : {}) });

    request.subscribe({
      next: (property) => {
        this.saving = false;
        if (this.editTarget) {
          this.properties.update((list) => list.map((p) => (p.id === property.id ? property : p)));
          this.toast.success(`"${property.name}" updated`);
        } else {
          this.properties.update((list) => [property, ...list]);
          this.toast.success(`"${property.name}" added`);
        }
        this.showFormModal = false;
      },
      error: (err: unknown) => {
        this.saving = false;
        this.toast.error(extractErrorMessage(err, 'Failed to save property'));
      },
    });
  }

  confirmDelete(property: Property): void {
    this.confirmDialog
      .confirm({
        title: 'Delete property?',
        message: `This permanently deletes "${property.name}". This cannot be undone.`,
        confirmLabel: 'Delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.propertyService.deleteProperty(property.id).subscribe({
          next: () => {
            this.properties.update((list) => list.filter((p) => p.id !== property.id));
            this.toast.success(`"${property.name}" deleted`);
          },
          error: (err: unknown) => this.toast.error(extractErrorMessage(err, 'Failed to delete property')),
        });
      });
  }

  descriptionPreview(property: Property): string {
    const text = property.description?.trim();
    if (!text) return '';
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
}
