import { Component, EventEmitter, HostListener, inject, Input, OnInit, Output, signal } from '@angular/core';
import { AgentVersion } from '../../../core/models/agent.model';
import { AgentHistoryService } from '../../../core/services/agent-history.service';
import { diffAgentJson, DiffLine, previousVersion } from '../../../core/utils/version-diff.util';
import { ModalComponent } from '../../../shared/modal/modal.component';

@Component({
  selector: 'app-agent-history-panel',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './agent-history-panel.component.html',
  styleUrl: './agent-history-panel.component.css',
})
export class AgentHistoryPanelComponent implements OnInit {
  private readonly agentHistoryService = inject(AgentHistoryService);

  @Input({ required: true }) agentId!: string;
  /** Gates history availability — history exists once an agent has been staged at least once. */
  @Input({ required: true }) currentStageVersion!: number;
  @Output() closed = new EventEmitter<void>();
  @Output() restore = new EventEmitter<AgentVersion>();

  readonly versions = signal<AgentVersion[]>([]);
  readonly loading = signal(true);
  readonly selectedVersion = signal<AgentVersion | null>(null);
  readonly diffLines = signal<DiffLine[]>([]);

  ngOnInit(): void {
    if (this.currentStageVersion <= 0) {
      this.loading.set(false);
      return;
    }
    this.agentHistoryService.getVersions(this.agentId).subscribe((versions) => {
      this.versions.set(versions);
      this.loading.set(false);
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  selectVersion(version: AgentVersion): void {
    this.selectedVersion.set(version);
    const prev = previousVersion(this.versions(), version);
    this.diffLines.set(diffAgentJson(prev?.snapshot ?? null, version.snapshot));
  }

  closeDetail(): void {
    this.selectedVersion.set(null);
    this.diffLines.set([]);
  }

  restoreVersion(version: AgentVersion): void {
    this.restore.emit(version);
  }

  close(): void {
    this.closed.emit();
  }

  /** Escape closes the drawer; while a version is open, the modal handles Escape itself. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.selectedVersion()) this.close();
  }
}
