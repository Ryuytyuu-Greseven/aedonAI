import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Agent } from '../../../core/models/agent.model';
import {
  KnowledgeBase,
  KnowledgeBaseEntry,
  NewKnowledgeBaseFileInput,
  NewKnowledgeBaseUrlInput,
  knowledgeBaseToEntries,
} from '../../../core/models/knowledge-base.model';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';
import { KnowledgeBaseComponent } from '../../playground/knowledge-base/knowledge-base.component';
import { ModalComponent } from '../../../shared/modal/modal.component';

@Component({
  selector: 'app-knowledge-base-detail',
  standalone: true,
  imports: [RouterLink, KnowledgeBaseComponent, ModalComponent],
  templateUrl: './knowledge-base-detail.component.html',
  styleUrl: './knowledge-base-detail.component.css',
})
export class KnowledgeBaseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly agentService = inject(AgentService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly base = signal<KnowledgeBase | null>(null);
  readonly linkedAgents = signal<Agent[]>([]);
  readonly statusUpdating = signal(false);
  readonly confirmingDisable = signal(false);

  readonly knowledgeBaseToEntries = knowledgeBaseToEntries;

  activeLinkedCount(): number {
    return this.linkedAgents().filter((a) => a.status === 'live').length;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigateByUrl('/knowledge-base');
      return;
    }
    this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.knowledgeBaseService.getKnowledgeBase(id).subscribe({
      next: (base) => {
        this.base.set(base);
        this.agentService.getAgentsUsingKnowledgeBase(id).subscribe({
          next: (agents) => {
            this.linkedAgents.set(agents);
            this.loading.set(false);
          },
          error: () => {
            this.linkedAgents.set([]);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.toast.error('Knowledge base not found');
        this.router.navigateByUrl('/knowledge-base');
      },
    });
  }

  onFilesAdded(files: NewKnowledgeBaseFileInput[]): void {
    const base = this.base();
    if (!base) return;
    this.knowledgeBaseService.addFiles(base.id, files).subscribe({
      next: (updated) => {
        this.base.set(updated);
        this.toast.success(files.length === 1 ? 'File added' : `${files.length} files added`);
      },
      error: () => this.toast.error('Failed to add files'),
    });
  }

  onUrlsAdded(urls: NewKnowledgeBaseUrlInput[]): void {
    const base = this.base();
    if (!base) return;
    this.knowledgeBaseService.addUrls(base.id, urls).subscribe({
      next: (updated) => {
        this.base.set(updated);
        this.toast.success(urls.length === 1 ? 'URL added' : `${urls.length} URLs added`);
      },
      error: () => this.toast.error('Failed to add URLs'),
    });
  }

  onEntryDisable(entry: KnowledgeBaseEntry): void {
    const base = this.base();
    if (!base) return;
    const request =
      entry.kind === 'file'
        ? this.knowledgeBaseService.disableFile(base.id, entry.id)
        : this.knowledgeBaseService.disableUrl(base.id, entry.id);
    request.subscribe({
      next: (updated) => {
        this.base.set(updated);
        this.toast.success('Entry disabled');
      },
      error: () => this.toast.error('Failed to disable entry'),
    });
  }

  onEntryEnable(entry: KnowledgeBaseEntry): void {
    const base = this.base();
    if (!base) return;
    const request =
      entry.kind === 'file'
        ? this.knowledgeBaseService.enableFile(base.id, entry.id)
        : this.knowledgeBaseService.enableUrl(base.id, entry.id);
    request.subscribe({
      next: (updated) => {
        this.base.set(updated);
        this.toast.success('Entry enabled');
      },
      error: () => this.toast.error('Failed to enable entry'),
    });
  }

  confirmDisable(): void {
    this.confirmingDisable.set(true);
  }

  cancelDisable(): void {
    this.confirmingDisable.set(false);
  }

  disableKnowledgeBase(): void {
    const base = this.base();
    if (!base) return;

    const liveLinked = this.linkedAgents().filter((a) => a.status === 'live');
    if (liveLinked.length > 0) {
      this.toast.error('Unlink this knowledge base from live agents (or disable them) before disabling');
      this.confirmingDisable.set(false);
      return;
    }

    this.statusUpdating.set(true);
    this.knowledgeBaseService.disableKnowledgeBase(base.id).subscribe({
      next: (updated) => {
        this.statusUpdating.set(false);
        this.confirmingDisable.set(false);
        this.base.set(updated);
        this.toast.success('Knowledge base disabled');
      },
      error: (err: unknown) => {
        this.statusUpdating.set(false);
        this.confirmingDisable.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.toast.error('Unlink from live agents first, then disable');
          return;
        }
        this.toast.error('Failed to disable knowledge base');
      },
    });
  }

  enableKnowledgeBase(): void {
    const base = this.base();
    if (!base) return;
    this.statusUpdating.set(true);
    this.knowledgeBaseService.enableKnowledgeBase(base.id).subscribe({
      next: (updated) => {
        this.statusUpdating.set(false);
        this.base.set(updated);
        this.toast.success('Knowledge base enabled');
      },
      error: () => {
        this.statusUpdating.set(false);
        this.toast.error('Failed to enable knowledge base');
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
