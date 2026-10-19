import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  KnowledgeBaseEntry,
  NewKnowledgeBaseFileInput,
  NewKnowledgeBaseUrlInput,
  knowledgeBaseEntryNameExists,
} from '../../../core/models/knowledge-base.model';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/modal/modal.component';

type EntryFilter = 'all' | 'file' | 'url';

const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'csv', 'md'];
const URL_PATTERN = /^https?:\/\/.+/i;

const FILE_ICONS: Record<string, string> = {
  pdf: 'fa-solid fa-file-pdf',
  doc: 'fa-solid fa-file-word',
  docx: 'fa-solid fa-file-word',
  txt: 'fa-solid fa-file-lines',
  md: 'fa-solid fa-file-lines',
  csv: 'fa-solid fa-file-csv',
};

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.css',
})
export class KnowledgeBaseComponent {
  private readonly toast = inject(ToastService);

  @Input({ required: true }) entries: KnowledgeBaseEntry[] = [];
  /** When false, hide add/disable/enable controls (e.g. parent KB is disabled). */
  @Input() editable = true;
  @Output() filesAdded = new EventEmitter<NewKnowledgeBaseFileInput[]>();
  @Output() urlsAdded = new EventEmitter<NewKnowledgeBaseUrlInput[]>();
  @Output() entryDisable = new EventEmitter<KnowledgeBaseEntry>();
  @Output() entryEnable = new EventEmitter<KnowledgeBaseEntry>();

  readonly acceptedExtensions = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
  readonly acceptedLabel = ACCEPTED_EXTENSIONS.map((ext) => ext.toUpperCase()).join(', ');

  dragOver = false;
  filter: EntryFilter = 'all';

  get fileCount(): number {
    return this.entries.filter((e) => e.kind === 'file').length;
  }

  get urlCount(): number {
    return this.entries.filter((e) => e.kind === 'url').length;
  }

  get visibleEntries(): KnowledgeBaseEntry[] {
    return this.filter === 'all' ? this.entries : this.entries.filter((e) => e.kind === this.filter);
  }

  showAddUrlForm = false;
  urlDraft = this.emptyUrlDraft();
  urlNameError = '';
  urlError = '';
  disableTarget: KnowledgeBaseEntry | null = null;

  private emptyUrlDraft() {
    return { name: '', url: '' };
  }

  /** Colour family for the entry's icon tile (matches the file type). */
  toneFor(entry: KnowledgeBaseEntry): string {
    if (entry.kind === 'url') return 'url';
    return entry.file_type ?? 'file';
  }

  iconFor(entry: KnowledgeBaseEntry): string {
    if (entry.kind === 'url') return 'fa-solid fa-link';
    return FILE_ICONS[entry.file_type ?? ''] ?? 'fa-solid fa-file';
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    // Ignore leave events fired when moving between the dropzone's own children.
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.addFiles(files);
  }

  /** Shared by the file picker and drag-and-drop: drops unsupported types and duplicate names. */
  private addFiles(files: File[]): void {
    const supported = files.filter((f) => ACCEPTED_EXTENSIONS.includes(f.name.split('.').pop()?.toLowerCase() ?? ''));
    if (supported.length < files.length) {
      this.toast.error(`Only ${this.acceptedLabel} files are supported`);
    }

    const added: NewKnowledgeBaseFileInput[] = [];
    let skipped = 0;

    supported.forEach((file) => {
      const name = file.name;
      if (
        knowledgeBaseEntryNameExists(this.entries, name) ||
        added.some((e) => e.filename.toLowerCase() === name.toLowerCase())
      ) {
        skipped++;
        return;
      }
      added.push({ file, filename: name, filesize: file.size });
    });

    if (added.length > 0) {
      this.filesAdded.emit(added);
    }
    if (skipped > 0) {
      this.toast.error(
        skipped === 1 ? 'A file with this name already exists' : `${skipped} files skipped (duplicate names)`,
      );
    }
  }

  openAddUrlForm(): void {
    this.showAddUrlForm = true;
    this.urlDraft = this.emptyUrlDraft();
    this.urlNameError = '';
    this.urlError = '';
  }

  cancelAddUrl(): void {
    this.showAddUrlForm = false;
    this.urlDraft = this.emptyUrlDraft();
    this.urlNameError = '';
    this.urlError = '';
  }

  addUrl(): void {
    this.urlNameError = '';
    this.urlError = '';

    const name = this.urlDraft.name.trim();
    const url = this.urlDraft.url.trim();

    if (!name || !url) {
      this.toast.error('Label and URL are required');
      return;
    }
    if (!URL_PATTERN.test(url)) {
      this.urlError = 'Enter a valid http(s):// URL';
      return;
    }
    if (knowledgeBaseEntryNameExists(this.entries, name)) {
      this.urlNameError = 'An entry with this name already exists';
      return;
    }

    this.urlsAdded.emit([{ label: name, url }]);
    this.cancelAddUrl();
  }

  confirmDisable(entry: KnowledgeBaseEntry): void {
    this.disableTarget = entry;
  }

  cancelDisable(): void {
    this.disableTarget = null;
  }

  disableEntry(): void {
    const entry = this.disableTarget;
    if (!entry) return;
    this.entryDisable.emit(entry);
    this.disableTarget = null;
  }

  enableEntry(entry: KnowledgeBaseEntry): void {
    this.entryEnable.emit(entry);
  }
}
