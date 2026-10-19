import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Agent,
  agentsEqual,
  cloneAgent,
  createEmptyAgent,
} from '../../core/models/agent.model';
import { AgentService } from '../../core/services/agent.service';
import { VersionHistoryService } from '../../core/services/version-history.service';
import { ToastService } from '../../core/services/toast.service';
import { CanComponentDeactivate } from '../../core/guards/unsaved-changes.guard';
import { applyAutoLayout, nodesNeedAutoLayout } from '../../core/utils/graph-layout.util';
import { GraphCanvasComponent } from './graph-canvas/graph-canvas.component';
import { NodeInspectorComponent } from './node-inspector/node-inspector.component';
import { ToolsManagerComponent } from './tools-manager/tools-manager.component';
import { VersionHistoryComponent } from './version-history/version-history.component';
import { TestConsoleComponent } from './test-console/test-console.component';

type BuilderTab = 'graph' | 'tools' | 'history' | 'test';

@Component({
  selector: 'app-agent-builder',
  standalone: true,
  imports: [
    RouterLink,
    GraphCanvasComponent,
    NodeInspectorComponent,
    ToolsManagerComponent,
    VersionHistoryComponent,
    TestConsoleComponent,
  ],
  templateUrl: './agent-builder.component.html',
  styleUrl: './agent-builder.component.css',
})
export class AgentBuilderComponent implements OnInit, CanComponentDeactivate {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agentService = inject(AgentService);
  private readonly versionHistoryService = inject(VersionHistoryService);
  private readonly toast = inject(ToastService);

  readonly agent = signal<Agent | null>(null);
  readonly savedAgent = signal<Agent | null>(null);
  readonly selectedNodeId = signal<string | null>(null);
  readonly activeTab = signal<BuilderTab>('graph');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isNew = signal(false);
  readonly showExport = signal(false);
  readonly nameError = signal(false);

  readonly isDirty = computed(() => {
    const current = this.agent();
    const saved = this.savedAgent();
    if (!current || !saved) return false;
    return !agentsEqual(current, saved);
  });

  readonly exportJson = computed(() => {
    const current = this.agent();
    if (!current) return '';
    return JSON.stringify(this.agentService.toExportJson(current), null, 2);
  });

  private promptSaveTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const isNewRoute = this.route.snapshot.routeConfig?.path === 'agents/new' || !id;

    if (isNewRoute) {
      this.isNew.set(true);
      const draft = createEmptyAgent('');
      this.agent.set(draft);
      this.savedAgent.set(cloneAgent(draft));
      this.loading.set(false);
      return;
    }

    this.agentService.getAgent(id!).subscribe({
      next: (agent) => {
        let loaded = cloneAgent(agent);
        if (nodesNeedAutoLayout(loaded.nodes)) {
          loaded = applyAutoLayout(loaded);
        }
        this.agent.set(loaded);
        this.savedAgent.set(cloneAgent(loaded));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
    });
  }

  canDeactivate(): boolean {
    if (!this.isDirty()) return true;
    return confirm('You have unsaved changes. Leave without saving?');
  }

  setTab(tab: BuilderTab): void {
    this.activeTab.set(tab);
  }

  updateAgent(partial: Partial<Agent>): void {
    const current = this.agent();
    if (!current) return;
    this.agent.set({ ...current, ...partial });
    if (partial.agent_name !== undefined) {
      this.nameError.set(!partial.agent_name.trim());
    }
  }

  onAgentChange(agent: Agent): void {
    this.agent.set(cloneAgent(agent));
  }

  selectNode(nodeId: string | null): void {
    this.selectedNodeId.set(nodeId);
  }

  selectedNode() {
    const a = this.agent();
    const id = this.selectedNodeId();
    if (!a || !id) return null;
    return a.nodes.find((n) => n.id === id) ?? null;
  }

  save(): void {
    const current = this.agent();
    if (!current || this.saving()) return;

    if (!current.agent_name.trim()) {
      this.nameError.set(true);
      this.toast.error('Agent name is required');
      return;
    }

    this.nameError.set(false);
    this.saving.set(true);

    const emptyPromptNodes = current.nodes.filter((n) => !n.prompt.trim());
    if (emptyPromptNodes.length > 0) {
      const names = emptyPromptNodes.map((n) => n.name).join(', ');
      this.toast.warning(`Node(s) with no prompt: ${names}`);
    }

    if (this.isNew() || !current.id) {
      this.agentService.createAgent(current).subscribe({
        next: (saved) => {
          this.agent.set(saved);
          this.savedAgent.set(cloneAgent(saved));
          this.isNew.set(false);
          this.saving.set(false);
          this.versionHistoryService.saveVersion(saved, 'Manual save').subscribe();
          this.toast.success('Agent created successfully');
          this.router.navigate(['/agents', saved.id], { replaceUrl: true });
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Failed to create agent');
        },
      });
      return;
    }

    this.agentService.updateAgent(current.id, current).subscribe({
      next: (saved) => {
        this.agent.set(saved);
        this.savedAgent.set(cloneAgent(saved));
        this.versionHistoryService.saveVersion(saved, 'Manual save').subscribe();
        this.saving.set(false);
        this.toast.success('Agent saved successfully');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Failed to save agent');
      },
    });
  }

  onPromptChange(): void {
    if (this.promptSaveTimer) clearTimeout(this.promptSaveTimer);
    this.promptSaveTimer = setTimeout(() => {
      const current = this.agent();
      if (current) {
        this.versionHistoryService.saveVersion(current, 'Auto-save on prompt change').subscribe();
      }
    }, 1500);
  }

  exportAgentJson(): void {
    this.showExport.set(true);
  }

  downloadJson(): void {
    const current = this.agent();
    if (!current) return;
    const blob = new Blob([this.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = current.agent_name.trim() || 'agent';
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  closeExport(): void {
    this.showExport.set(false);
  }

  onVersionRestore(snapshot: Agent, versionNumber: number): void {
    this.agent.set(cloneAgent(snapshot));
    this.selectedNodeId.set(null);
    this.toast.info(`Restored to version #${versionNumber}. Save to keep these changes.`);
  }

  navigateDashboard(event: Event): void {
    if (this.isDirty() && !confirm('You have unsaved changes. Leave without saving?')) {
      event.preventDefault();
    }
  }

  displayName(): string {
    const name = this.agent()?.agent_name?.trim();
    return name || 'Untitled Agent';
  }

  validationWarnings(): string[] {
    const a = this.agent();
    if (!a) return [];
    const warnings: string[] = [];
    const connected = new Set<string>();
    for (const node of a.nodes) {
      if (node.nextNode) connected.add(node.id);
      if (node.previousNode) connected.add(node.id);
    }
    const orphans = a.nodes.filter((n) => a.nodes.length > 1 && !connected.has(n.id));
    if (orphans.length > 0) {
      warnings.push(`${orphans.length} node(s) are not connected to the graph.`);
    }
    return warnings;
  }
}
