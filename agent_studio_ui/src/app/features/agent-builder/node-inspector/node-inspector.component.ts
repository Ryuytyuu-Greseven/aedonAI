import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Agent,
  AgentNode,
  cloneAgent,
  PromptHistoryEntry,
  Tool,
} from '../../../core/models/agent.model';
import { VersionHistoryService } from '../../../core/services/version-history.service';

@Component({
  selector: 'app-node-inspector',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './node-inspector.component.html',
  styleUrl: './node-inspector.component.css',
})
export class NodeInspectorComponent implements OnInit, OnChanges {
  private readonly versionService = inject(VersionHistoryService);

  @Input({ required: true }) node!: AgentNode;
  @Input({ required: true }) tools: Tool[] = [];
  @Input({ required: true }) agent!: Agent;
  @Input({ required: true }) agentId!: string;

  @Output() nodeChange = new EventEmitter<Agent>();
  @Output() promptBlur = new EventEmitter<void>();
  @Output() goToToolsTab = new EventEmitter<void>();
  @Output() usePrompt = new EventEmitter<Agent>();

  readonly promptHistory = signal<PromptHistoryEntry[]>([]);
  showHistory = false;
  comparePrompt: string | null = null;

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnChanges(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    if (!this.agentId || !this.node?.id) return;
    this.versionService.getPromptHistory(this.agentId, this.node.id).subscribe({
      next: (entries) => this.promptHistory.set(entries),
    });
  }

  updateField<K extends keyof AgentNode>(field: K, value: AgentNode[K]): void {
    const nodes = this.agent.nodes.map((n) =>
      n.id === this.node.id ? { ...n, [field]: value } : n
    );
    this.nodeChange.emit({ ...this.agent, nodes });
  }

  toggleTool(toolId: string): void {
    const current = this.node.tools.includes(toolId)
      ? this.node.tools.filter((id) => id !== toolId)
      : [...this.node.tools, toolId];
    this.updateField('tools', current);
  }

  isToolSelected(toolId: string): boolean {
    return this.node.tools.includes(toolId);
  }

  onPromptBlur(): void {
    this.promptBlur.emit();
  }

  charCount(): number {
    return this.node.prompt.length;
  }

  applyHistoricalPrompt(entry: PromptHistoryEntry): void {
    const nodes = this.agent.nodes.map((n) =>
      n.id === this.node.id ? { ...n, prompt: entry.prompt } : n
    );
    this.usePrompt.emit({ ...this.agent, nodes });
    this.comparePrompt = entry.prompt;
  }

  previewPrompt(entry: PromptHistoryEntry): void {
    this.comparePrompt = entry.prompt;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }
}
