import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  KnowledgeBase,
  knowledgeBaseItemCount,
  knowledgeBaseNameExists,
} from '../../../core/models/knowledge-base.model';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { AgentService } from '../../../core/services/agent.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/modal/modal.component';

type StatusFilter = 'all' | 'active' | 'disabled';

interface KnowledgeBaseSummary {
  base: KnowledgeBase;
  agentCount: number;
}

@Component({
  selector: 'app-knowledge-base-list',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './knowledge-base-list.component.html',
  styleUrl: './knowledge-base-list.component.css',
})
export class KnowledgeBaseListComponent implements OnInit {
  private readonly knowledgeBaseService = inject(KnowledgeBaseService);
  private readonly agentService = inject(AgentService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly summaries = signal<KnowledgeBaseSummary[]>([]);
  readonly statusUpdatingId = signal<string | null>(null);

  readonly knowledgeBaseItemCount = knowledgeBaseItemCount;

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  readonly stats = computed(() => {
    const list = this.summaries();
    return {
      total: list.length,
      active: list.filter((s) => s.base.status === 'active').length,
      disabled: list.filter((s) => s.base.status === 'disabled').length,
      sources: list.reduce((sum, s) => sum + knowledgeBaseItemCount(s.base), 0),
      linkedAgents: list.reduce((sum, s) => sum + s.agentCount, 0),
    };
  });

  readonly filteredSummaries = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.summaries().filter(
      (s) => (status === 'all' || s.base.status === status) && (!term || s.base.name.toLowerCase().includes(term)),
    );
  });

  showCreateForm = false;
  createName = '';
  createError = '';
  creating = false;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.knowledgeBaseService.getKnowledgeBases().subscribe({
      next: (bases) => {
        if (bases.length === 0) {
          this.summaries.set([]);
          this.loading.set(false);
          return;
        }
        const requests = bases.map((base) =>
          this.agentService.getAgentsUsingKnowledgeBase(base.id).pipe(catchError(() => of([]))),
        );
        forkJoin(requests).subscribe((allAgents) => {
          this.summaries.set(bases.map((base, i) => ({ base, agentCount: allAgents[i].length })));
          this.loading.set(false);
        });
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed to load knowledge bases');
      },
    });
  }

  openKnowledgeBase(id: string): void {
    this.router.navigate(['/knowledge-base', id]);
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

  create(): void {
    const name = this.createName.trim();
    if (!name) {
      this.toast.error('Name is required');
      return;
    }
    if (knowledgeBaseNameExists(
      this.summaries().map((s) => s.base),
      name,
    )) {
      this.createError = 'A knowledge base with this name already exists';
      return;
    }
    this.creating = true;
    this.knowledgeBaseService.createKnowledgeBase(name).subscribe({
      next: (created) => {
        this.creating = false;
        this.toast.success('Knowledge base created');
        this.router.navigate(['/knowledge-base', created.id]);
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

  toggleStatus(event: Event, summary: KnowledgeBaseSummary): void {
    event.stopPropagation();
    if (this.statusUpdatingId()) return;

    const base = summary.base;
    this.statusUpdatingId.set(base.id);

    if (base.status === 'active') {
      this.knowledgeBaseService.disableKnowledgeBase(base.id).subscribe({
        next: (updated) => {
          this.statusUpdatingId.set(null);
          this.summaries.update((list) =>
            list.map((s) => (s.base.id === updated.id ? { ...s, base: updated } : s)),
          );
          this.toast.success('Knowledge base disabled');
        },
        error: (err: unknown) => {
          this.statusUpdatingId.set(null);
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.toast.error('Unlink from active agents first, then disable');
            return;
          }
          this.toast.error('Failed to disable knowledge base');
        },
      });
      return;
    }

    this.knowledgeBaseService.enableKnowledgeBase(base.id).subscribe({
      next: (updated) => {
        this.statusUpdatingId.set(null);
        this.summaries.update((list) =>
          list.map((s) => (s.base.id === updated.id ? { ...s, base: updated } : s)),
        );
        this.toast.success('Knowledge base enabled');
      },
      error: () => {
        this.statusUpdatingId.set(null);
        this.toast.error('Failed to enable knowledge base');
      },
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
