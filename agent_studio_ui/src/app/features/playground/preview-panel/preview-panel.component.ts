import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CallPreviewComponent } from '../call-preview/call-preview.component';
import { ChatPreviewComponent } from '../chat-preview/chat-preview.component';
import { WebCallPreviewComponent } from '../web-call-preview/web-call-preview.component';

type PreviewMode = 'call' | 'chat' | 'web-call';

@Component({
  selector: 'app-preview-panel',
  standalone: true,
  imports: [CallPreviewComponent, ChatPreviewComponent, WebCallPreviewComponent],
  templateUrl: './preview-panel.component.html',
  styleUrl: './preview-panel.component.css',
})
export class PreviewPanelComponent {
  @Input({ required: true }) agentId!: string;
  @Input() business?: string;
  @Output() previewPassed = new EventEmitter<void>();

  readonly modes: { id: PreviewMode; label: string; icon: string; hint: string }[] = [
    { id: 'call', label: 'Phone call', icon: 'fa-phone', hint: 'Agent calls a real number' },
    // { id: 'chat', label: 'Chat', icon: 'fa-comments', hint: 'Type and see replies' },
    { id: 'web-call', label: 'Web call', icon: 'fa-microphone', hint: 'Talk from your browser' },
  ];

  readonly activeMode = signal<PreviewMode>('call');

  selectMode(mode: PreviewMode): void {
    this.activeMode.set(mode);
  }

  onPassed(): void {
    this.previewPassed.emit();
  }
}
