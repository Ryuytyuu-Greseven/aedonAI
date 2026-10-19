import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Agent,
  createToolParam,
  nodesReferencingTool,
  Tool,
  ToolParameter,
  ToolParameterType,
} from '../../../core/models/agent.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-tools-manager',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tools-manager.component.html',
  styleUrl: './tools-manager.component.css',
})
export class ToolsManagerComponent {
  private readonly toast = inject(ToastService);

  @Input({ required: true }) agent!: Agent;
  @Output() agentChange = new EventEmitter<Agent>();

  showAddForm = false;
  showBulk = false;
  nameError = '';

  draft: {
    name: string;
    description: string;
    returns: string;
    parameters: ToolParameter[];
  } = this.emptyDraft();

  bulkRows: Array<{ name: string; description: string; parameters: string }> = [
    { name: '', description: '', parameters: '' },
  ];

  editingId: string | null = null;
  editDraft: Tool | null = null;
  deleteTarget: Tool | null = null;

  readonly paramTypes: ToolParameterType[] = ['string', 'number', 'boolean', 'array', 'object'];

  emptyDraft() {
    return { name: '', description: '', returns: '', parameters: [] as ToolParameter[] };
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.draft = this.emptyDraft();
    this.nameError = '';
  }

  addParamRow(): void {
    this.draft.parameters.push(createToolParam('', 'string', '', false));
  }

  removeParamRow(index: number): void {
    this.draft.parameters.splice(index, 1);
  }

  isDuplicateName(name: string, excludeId?: string): boolean {
    return this.agent.tools.some(
      (t) => t.name.toLowerCase() === name.trim().toLowerCase() && t.id !== excludeId
    );
  }

  saveTool(andAnother = false): void {
    if (!this.draft.name.trim() || !this.draft.description.trim()) {
      this.toast.error('Name and description are required');
      return;
    }
    if (this.isDuplicateName(this.draft.name)) {
      this.nameError = 'A tool with this name already exists';
      return;
    }

    const tool: Tool = {
      id: `tool-${Date.now()}`,
      name: this.draft.name.trim(),
      description: this.draft.description.trim(),
      returns: this.draft.returns.trim() || undefined,
      parameters: this.draft.parameters.filter((p) => p.name.trim()),
    };

    this.agentChange.emit({ ...this.agent, tools: [...this.agent.tools, tool] });
    this.toast.success('Tool created');
    if (andAnother) {
      this.draft = this.emptyDraft();
      this.nameError = '';
    } else {
      this.showAddForm = false;
    }
  }

  addRow(): void {
    this.bulkRows.push({ name: '', description: '', parameters: '' });
  }

  removeRow(index: number): void {
    this.bulkRows.splice(index, 1);
  }

  createBulkTools(): void {
    const newTools: Tool[] = [];
    for (const [i, row] of this.bulkRows.entries()) {
      if (!row.name.trim()) continue;
      if (this.isDuplicateName(row.name) || newTools.some((t) => t.name === row.name.trim())) {
        this.toast.error(`Duplicate tool name: ${row.name}`);
        return;
      }
      newTools.push({
        id: `tool-${Date.now()}-${i}`,
        name: row.name.trim(),
        description: row.description.trim(),
        parameters: this.parseParameters(row.parameters),
      });
    }
    if (newTools.length === 0) return;
    this.agentChange.emit({ ...this.agent, tools: [...this.agent.tools, ...newTools] });
    this.bulkRows = [{ name: '', description: '', parameters: '' }];
    this.showBulk = false;
    this.toast.success(`${newTools.length} tool(s) created`);
  }

  startEdit(tool: Tool): void {
    this.editingId = tool.id;
    this.editDraft = {
      ...tool,
      parameters: tool.parameters.map((p) => ({ ...p })),
    };
  }

  saveEdit(): void {
    if (!this.editDraft) return;
    if (this.isDuplicateName(this.editDraft.name, this.editDraft.id)) {
      this.toast.error('A tool with this name already exists');
      return;
    }
    const tools = this.agent.tools.map((t) =>
      t.id === this.editDraft!.id ? { ...this.editDraft! } : t
    );
    this.agentChange.emit({ ...this.agent, tools });
    this.editingId = null;
    this.editDraft = null;
    this.toast.success('Tool updated');
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = null;
  }

  confirmDelete(tool: Tool): void {
    this.deleteTarget = tool;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  deleteTool(): void {
    const tool = this.deleteTarget;
    if (!tool) return;
    const tools = this.agent.tools.filter((t) => t.id !== tool.id);
    const nodes = this.agent.nodes.map((n) => ({
      ...n,
      tools: n.tools.filter((id) => id !== tool.id),
    }));
    this.agentChange.emit({ ...this.agent, tools, nodes });
    this.deleteTarget = null;
    this.toast.success('Tool deleted');
  }

  nodesUsing(toolId: string): string[] {
    return nodesReferencingTool(this.agent, toolId).map((n) => n.name);
  }

  referenceCount(toolId: string): number {
    return nodesReferencingTool(this.agent, toolId).length;
  }

  private parseParameters(raw: string): ToolParameter[] {
    if (!raw.trim()) return [];
    return raw.split(',').map((part) => {
      const [name, type] = part.split(':').map((s) => s.trim());
      return createToolParam(name, (type as ToolParameterType) || 'string', '', true);
    });
  }
}
