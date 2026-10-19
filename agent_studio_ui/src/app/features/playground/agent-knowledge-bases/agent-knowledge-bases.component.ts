import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  KnowledgeBase,
  KnowledgeBaseEntry,
  NewKnowledgeBaseFileInput,
  NewKnowledgeBaseUrlInput,
  knowledgeBaseItemCount,
  knowledgeBaseNameExists,
  knowledgeBaseToEntries,
} from '../../../core/models/knowledge-base.model';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/modal/modal.component';
import { KnowledgeBaseComponent } from '../knowledge-base/knowledge-base.component';

@Component({
  selector: 'app-agent-knowledge-bases',
  standalone: true,
  imports: [FormsModule, KnowledgeBaseComponent, ModalComponent],
  templateUrl: './agent-knowledge-bases.component.html',
  styleUrl: './agent-knowledge-bases.component.css',
})
export class AgentKnowledgeBasesComponent implements OnInit {
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) linkedIds: string[] = [];
  @Output() linkedIdsChange = new EventEmitter<string[]>();

  readonly loading = signal(true);
  readonly allBases = signal<KnowledgeBase[]>([]);
  readonly expandedId = signal<string | null>(null);

  readonly knowledgeBaseToEntries = knowledgeBaseToEntries;

  showLinkPicker = false;
  linkSearch = '';
  showCreateForm = false;
  createName = '';
  createError = '';
  creating = false;

  ngOnInit(): void {
    this.loading.set(true);
    this.knowledgeBaseService.getKnowledgeBases().subscribe({
      next: (bases) => {
        this.allBases.set(bases);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load knowledge bases');
      },
    });
  }

  get linkedBases(): KnowledgeBase[] {
    return this.allBases().filter((b) => this.linkedIds.includes(b.id));
  }

  get availableBases(): KnowledgeBase[] {
    return this.allBases().filter((b) => !this.linkedIds.includes(b.id) && b.status === 'active');
  }

  get filteredAvailableBases(): KnowledgeBase[] {
    const query = this.linkSearch.trim().toLowerCase();
    if (!query) return this.availableBases;
    return this.availableBases.filter((b) => b.name.toLowerCase().includes(query));
  }

  entryCountLabel(base: KnowledgeBase): string {
    const count = knowledgeBaseItemCount(base);
    return `${count} item${count === 1 ? '' : 's'}`;
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  isExpanded(id: string): boolean {
    return this.expandedId() === id;
  }

  private replaceBase(updated: KnowledgeBase): void {
    this.allBases.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
  }

  onFilesAdded(base: KnowledgeBase, files: NewKnowledgeBaseFileInput[]): void {
    this.knowledgeBaseService.addFiles(base.id, files).subscribe({
      next: (updated) => {
        this.replaceBase(updated);
        this.toast.success(files.length === 1 ? 'File added' : `${files.length} files added`);
      },
      error: () => this.toast.error('Failed to add files'),
    });
  }

  onUrlsAdded(base: KnowledgeBase, urls: NewKnowledgeBaseUrlInput[]): void {
    this.knowledgeBaseService.addUrls(base.id, urls).subscribe({
      next: (updated) => {
        this.replaceBase(updated);
        this.toast.success(urls.length === 1 ? 'URL added' : `${urls.length} URLs added`);
      },
      error: () => this.toast.error('Failed to add URLs'),
    });
  }

  onEntryDisable(base: KnowledgeBase, entry: KnowledgeBaseEntry): void {
    const request =
      entry.kind === 'file'
        ? this.knowledgeBaseService.disableFile(base.id, entry.id)
        : this.knowledgeBaseService.disableUrl(base.id, entry.id);
    request.subscribe({
      next: (updated) => {
        this.replaceBase(updated);
        this.toast.success('Entry disabled');
      },
      error: () => this.toast.error('Failed to disable entry'),
    });
  }

  onEntryEnable(base: KnowledgeBase, entry: KnowledgeBaseEntry): void {
    const request =
      entry.kind === 'file'
        ? this.knowledgeBaseService.enableFile(base.id, entry.id)
        : this.knowledgeBaseService.enableUrl(base.id, entry.id);
    request.subscribe({
      next: (updated) => {
        this.replaceBase(updated);
        this.toast.success('Entry enabled');
      },
      error: () => this.toast.error('Failed to enable entry'),
    });
  }

  openLinkPicker(): void {
    this.showLinkPicker = true;
    this.linkSearch = '';
  }

  cancelLinkPicker(): void {
    this.showLinkPicker = false;
    this.linkSearch = '';
  }

  linkExisting(base: KnowledgeBase): void {
    this.linkedIdsChange.emit([...this.linkedIds, base.id]);
    this.showLinkPicker = false;
    this.linkSearch = '';
    this.toast.success(`Linked "${base.name}"`);
  }

  unlink(base: KnowledgeBase): void {
    this.linkedIdsChange.emit(this.linkedIds.filter((id) => id !== base.id));
    if (this.expandedId() === base.id) {
      this.expandedId.set(null);
    }
    this.toast.success(`Unlinked "${base.name}"`);
  }

  openCreateForm(): void {
    this.showCreateForm = true;
    this.createName = '';
    this.createError = '';
  }

  cancelCreate(): void {
    this.showCreateForm = false;
    this.createName = '';
    this.createError = '';
  }

  createAndLink(): void {
    const name = this.createName.trim();
    if (!name) {
      this.toast.error('Name is required');
      return;
    }
    if (knowledgeBaseNameExists(this.allBases(), name)) {
      this.createError = 'A knowledge base with this name already exists';
      return;
    }
    this.creating = true;
    this.knowledgeBaseService.createKnowledgeBase(name).subscribe({
      next: (created) => {
        this.creating = false;
        this.allBases.update((list) => [...list, created]);
        this.linkedIdsChange.emit([...this.linkedIds, created.id]);
        this.showCreateForm = false;
        this.toast.success('Knowledge base created and linked');
      },
      error: (err: unknown) => {
        this.creating = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.createError = 'A knowledge base with this name already exists';
          return;
        }
        this.toast.error('Failed to create knowledge base');
      },
    });
  }
}
