import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Tool, ToolKind, createDestinationTool, isDestinationTool } from '../../../core/models/agent.model';

const REQUIRES_URL: ToolKind[] = ['api_webhook'];
const REQUIRES_RECIPIENT: ToolKind[] = ['sms', 'whatsapp', 'email'];

type DestinationKind = Exclude<ToolKind, 'custom'>;

/** Display metadata for each destination channel (picker cards + list rows). */
const DESTINATION_KINDS: { kind: DestinationKind; label: string; icon: string; hint: string }[] = [
  { kind: 'api_webhook', label: 'API webhook', icon: 'fa-solid fa-code', hint: 'POST lead data to your system' },
  { kind: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', hint: 'Message the owner on WhatsApp' },
  { kind: 'sms', label: 'SMS', icon: 'fa-solid fa-message', hint: 'Text a summary after each call' },
  { kind: 'email', label: 'Email', icon: 'fa-solid fa-envelope', hint: 'Email the outcome to an inbox' },
];

@Component({
  selector: 'app-export-destinations',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './export-destinations.component.html',
  styleUrl: './export-destinations.component.css',
})
export class ExportDestinationsComponent {
  @Input({ required: true }) tools: Tool[] = [];
  @Output() toolsChange = new EventEmitter<Tool[]>();

  readonly kinds = DESTINATION_KINDS;

  editingId: string | null = null;
  formKind: Exclude<ToolKind, 'custom'> = 'api_webhook';
  formUrl = '';
  formDescription = '';
  formRecipient = '';
  error: string | null = null;

  get destinations(): Tool[] {
    return this.tools.filter(isDestinationTool);
  }

  get needsUrl(): boolean {
    return REQUIRES_URL.includes(this.formKind);
  }

  get needsRecipient(): boolean {
    return REQUIRES_RECIPIENT.includes(this.formKind);
  }

  startEdit(tool: Tool): void {
    this.editingId = tool.id;
    this.formKind = (tool.kind as Exclude<ToolKind, 'custom'>) ?? 'api_webhook';
    this.formUrl = tool.destinationConfig?.url ?? '';
    this.formDescription = tool.description;
    this.formRecipient = tool.destinationConfig?.recipient ?? '';
    this.error = null;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.formUrl = '';
    this.formDescription = '';
    this.formRecipient = '';
    this.error = null;
  }

  save(): void {
    if (this.needsUrl && (!this.formUrl.trim() || !this.formDescription.trim())) {
      this.error = 'URL and description are required for an API webhook destination.';
      return;
    }
    if (this.needsRecipient && !this.formRecipient.trim()) {
      this.error = 'A recipient is required for this destination type.';
      return;
    }
    this.error = null;

    const destination = createDestinationTool({
      kind: this.formKind,
      url: this.needsUrl ? this.formUrl.trim() : undefined,
      recipient: this.needsRecipient ? this.formRecipient.trim() : undefined,
      description: this.needsUrl ? this.formDescription.trim() : undefined,
      id: this.editingId ?? undefined,
    });

    const updated = this.editingId
      ? this.tools.map((t) => (t.id === this.editingId ? destination : t))
      : [...this.tools, destination];

    this.toolsChange.emit(updated);
    this.cancelEdit();
  }

  kindMeta(tool: Tool): (typeof DESTINATION_KINDS)[number] {
    return DESTINATION_KINDS.find((k) => k.kind === tool.kind) ?? DESTINATION_KINDS[0];
  }

  identifyingField(tool: Tool): string {
    return tool.destinationConfig?.url ?? tool.destinationConfig?.recipient ?? '';
  }

  remove(tool: Tool): void {
    this.toolsChange.emit(this.tools.filter((t) => t.id !== tool.id));
    if (this.editingId === tool.id) {
      this.cancelEdit();
    }
  }
}
