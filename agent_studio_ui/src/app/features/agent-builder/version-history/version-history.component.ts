import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { AgentVersion } from '../../../core/models/agent.model';
import { VersionHistoryService } from '../../../core/services/version-history.service';
import { diffAgentJson, DiffLine, previousVersion } from '../../../core/utils/version-diff.util';

@Component({
  selector: 'app-version-history',
  standalone: true,
  templateUrl: './version-history.component.html',
  styleUrl: './version-history.component.css',
})
export class VersionHistoryComponent implements OnInit {
  private readonly versionService = inject(VersionHistoryService);

  @Input({ required: true }) agentId!: string;
  @Output() restore = new EventEmitter<AgentVersion>();

  readonly versions = signal<AgentVersion[]>([]);
  readonly loading = signal(true);
  readonly selectedVersion = signal<AgentVersion | null>(null);
  readonly diffLines = signal<DiffLine[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.versionService.getVersions(this.agentId).subscribe({
      next: (v) => {
        this.versions.set(v);
        this.loading.set(false);
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
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

  loadVersion(version: AgentVersion): void {
    if (!confirm(`Restore version #${version.versionNumber} from ${this.formatDate(version.timestamp)}?`)) {
      return;
    }
    this.restore.emit(version);
    this.closeDetail();
  }
}
