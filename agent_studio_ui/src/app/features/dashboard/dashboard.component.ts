import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Agent, AgentStatus } from '../../core/models/agent.model';
import { AgentTemplate } from '../../core/models/agent-template.model';
import { AgentService } from '../../core/services/agent.service';
import { AgentTemplateService } from '../../core/services/agent-template.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly agentService = inject(AgentService);
  private readonly agentTemplateService = inject(AgentTemplateService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly agents = signal<Agent[]>([]);
  readonly templates = signal<AgentTemplate[]>([]);
  readonly loading = signal(true);
  readonly filter = signal<AgentStatus | 'all'>('all');
  readonly searchQuery = signal('');

  readonly filteredAgents = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const f = this.filter();
    return this.agents().filter((a) => {
      const statusMatch = f === 'all' || a.status === f;
      const searchMatch = !q || a.agent_name.toLowerCase().includes(q);
      return statusMatch && searchMatch;
    });
  });

  readonly counts = computed(() => {
    const all = this.agents();
    return {
      all: all.length,
      live: all.filter((a) => a.status === 'live').length,
      disabled: all.filter((a) => a.status === 'disabled').length,
      staged: all.filter((a) => a.status === 'staged').length,
      draft: all.filter((a) => a.status === 'draft').length,
    };
  });

  ngOnInit(): void {
    this.loadAgents();
    this.agentTemplateService.getTemplates().subscribe((templates) => this.templates.set(templates));
  }

  loadAgents(): void {
    this.loading.set(true);
    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents.set(agents);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  templateName(agent: Agent): string | null {
    if (!agent.base_template_id) return null;
    return this.templates().find((t) => t.template_id === agent.base_template_id)?.name ?? null;
  }

  setFilter(status: AgentStatus | 'all'): void {
    this.filter.set(status);
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  openAgent(agent: Agent): void {
    this.router.navigate(['/playground', agent.id]);
  }

  toggleStatus(agent: Agent, event: Event): void {
    event.stopPropagation();
    const previous = agent.status;
    const target: AgentStatus = previous === 'live' ? 'disabled' : 'live';

    this.confirmDialog
      .confirm({
        title: target === 'live' ? 'Enable agent?' : 'Disable agent?',
        message: `Are you sure you want to mark "${agent.agent_name}" as ${target}?`,
        confirmLabel: target === 'live' ? 'Enable' : 'Disable',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.agents.update((list) => list.map((a) => (a.id === agent.id ? { ...a, status: target } : a)));
        const request = target === 'live' ? this.agentService.enableAgent(agent.id) : this.agentService.disableAgent(agent.id);
        request.subscribe({
          next: (updated) => {
            this.agents.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
            this.toast.success(`Agent marked ${updated.status}`);
          },
          error: (err) => {
            this.agents.update((list) =>
              list.map((a) => (a.id === agent.id ? { ...a, status: previous } : a))
            );
            this.toast.error(extractErrorMessage(err, 'Failed to update agent status'));
          },
        });
      });
  }

  confirmDelete(agent: Agent, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .confirm({
        title: 'Delete agent?',
        message: `Are you sure you want to delete "${agent.agent_name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.agentService.deleteAgent(agent.id).subscribe({
          next: () => {
            this.agents.update((list) => list.filter((a) => a.id !== agent.id));
            this.toast.success('Agent deleted');
          },
          error: () => this.toast.error('Failed to delete agent'),
        });
      });
  }

  cloneAgent(agent: Agent, event: Event): void {
    event.stopPropagation();
    this.agentService.cloneAgent(agent.id).subscribe({
      next: (clone) => {
        this.agents.update((list) => [...list, clone]);
        this.toast.success(`Cloned as "${clone.agent_name}"`);
      },
      error: () => this.toast.error('Failed to clone agent'),
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  nodeCount(agent: Agent): number {
    return agent.nodes.length;
  }

  skeletonItems = [1, 2, 3, 4];

  /** Stable per-agent gradient so cards are easy to tell apart. */
  avatarBackground(name: string): string {
    let hash = 0;
    for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue} 72% 62%), hsl(${(hue + 40) % 360} 70% 48%))`;
  }
}
