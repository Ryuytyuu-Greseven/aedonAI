import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/modal/modal.component';
import { McpServer, mcpServerNameExists, redactApiKey } from '../../../core/models/agent.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-mcp-servers-manager',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './mcp-servers-manager.component.html',
  styleUrl: './mcp-servers-manager.component.css',
})
export class McpServersManagerComponent {
  private readonly toast = inject(ToastService);

  @Input({ required: true }) mcpServers: McpServer[] = [];
  @Output() mcpServersChange = new EventEmitter<McpServer[]>();

  showAddForm = false;
  nameError = '';

  draft: { name: string; url: string; api_key: string } = this.emptyDraft();

  editingId: string | null = null;
  editDraft: McpServer | null = null;
  editApiKeyInput = '';
  deleteTarget: McpServer | null = null;

  emptyDraft() {
    return { name: '', url: '', api_key: '' };
  }

  maskedApiKey(server: McpServer): string {
    return server.api_key ? redactApiKey(server.api_key) : '';
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.draft = this.emptyDraft();
    this.nameError = '';
  }

  saveServer(): void {
    if (!this.draft.name.trim() || !this.draft.url.trim()) {
      this.toast.error('Name and URL are required');
      return;
    }
    if (mcpServerNameExists(this.mcpServers, this.draft.name)) {
      this.nameError = 'An MCP server with this name already exists';
      return;
    }

    const server: McpServer = {
      id: `mcp-${Date.now()}`,
      name: this.draft.name.trim(),
      url: this.draft.url.trim(),
      api_key: this.draft.api_key.trim() || undefined,
    };

    this.mcpServersChange.emit([...this.mcpServers, server]);
    this.toast.success('MCP server added');
    this.showAddForm = false;
  }

  startEdit(server: McpServer): void {
    this.editingId = server.id;
    this.editDraft = { ...server };
    this.editApiKeyInput = '';
  }

  saveEdit(): void {
    if (!this.editDraft) return;
    if (!this.editDraft.name.trim() || !this.editDraft.url.trim()) {
      this.toast.error('Name and URL are required');
      return;
    }
    if (mcpServerNameExists(this.mcpServers, this.editDraft.name, this.editDraft.id)) {
      this.toast.error('An MCP server with this name already exists');
      return;
    }
    const updated: McpServer = {
      ...this.editDraft,
      api_key: this.editApiKeyInput.trim() ? this.editApiKeyInput.trim() : this.editDraft.api_key,
    };
    this.mcpServersChange.emit(this.mcpServers.map((s) => (s.id === updated.id ? updated : s)));
    this.editingId = null;
    this.editDraft = null;
    this.editApiKeyInput = '';
    // this.toast.success('MCP server updated');
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = null;
    this.editApiKeyInput = '';
  }

  confirmDelete(server: McpServer): void {
    this.deleteTarget = server;
  }

  cancelDelete(): void {
    this.deleteTarget = null;
  }

  deleteServer(): void {
    const server = this.deleteTarget;
    if (!server) return;
    this.mcpServersChange.emit(this.mcpServers.filter((s) => s.id !== server.id));
    this.deleteTarget = null;
    this.toast.success('MCP server deleted');
  }
}
