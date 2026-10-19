import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Agent } from '../../../core/models/agent.model';
import { MetaPage } from '../../../core/models/meta-integration.model';
import { AgentService } from '../../../core/services/agent.service';
import { MetaIntegrationService } from '../../../core/services/meta-integration.service';
import { MetaOAuthService } from '../../../core/services/meta-oauth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-meta-integration',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './meta-integration.component.html',
  styleUrl: './meta-integration.component.css',
})
export class MetaIntegrationComponent implements OnInit {
  private readonly agentService = inject(AgentService);
  private readonly metaIntegration = inject(MetaIntegrationService);
  private readonly metaOAuth = inject(MetaOAuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly pages = this.metaIntegration.pages;
  readonly connected = computed(() => this.pages() !== null);
  readonly appIdConfigured = !!environment.metaAppId;

  /** All agents, any status — used only to resolve a linked agent's display name (a Page can stay linked to a no-longer-live agent). */
  readonly allAgents = signal<Agent[]>([]);
  /** Live agents only — the assignable options in the modal. A Page shouldn't be handed off to a draft/staged/disabled agent. */
  readonly liveAgents = signal<Agent[]>([]);
  readonly loading = signal(true);
  readonly pageTogglingId = signal<string | null>(null);
  readonly disconnecting = signal(false);

  // Assign Agent modal
  readonly assignModalPage = signal<MetaPage | null>(null);
  readonly assignModalAgentId = signal<string>('');
  readonly assignSaving = signal(false);

  /** Live agents, plus the Page's currently-linked agent if it's no longer live — so opening the modal never silently drops an existing (non-live) link. */
  readonly modalAgentOptions = computed<Agent[]>(() => {
    const live = this.liveAgents();
    const linkedId = this.assignModalPage()?.linkedAgentId;
    if (!linkedId || live.some((a) => a.id === linkedId)) return live;
    const current = this.allAgents().find((a) => a.id === linkedId);
    return current ? [...live, current] : live;
  });

  ngOnInit(): void {
    this.agentService.getAgents().subscribe((agents) => this.allAgents.set(agents));
    this.agentService.getLiveAgents().subscribe((agents) => this.liveAgents.set(agents));

    // Restore connection state after a refresh — `connect()`'s response isn't persisted client-side.
    this.metaIntegration.loadPages().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  agentName(agentId: string | null): string | null {
    if (!agentId) return null;
    return this.allAgents().find((a) => a.id === agentId)?.agent_name ?? null;
  }

  connect(): void {
    window.location.href = this.metaOAuth.buildAuthorizeUrl();
  }

  togglePage(page: MetaPage): void {
    if (this.pageTogglingId()) return;
    this.pageTogglingId.set(page.id);
    const request = page.enabled ? this.metaIntegration.disablePage(page.id) : this.metaIntegration.enablePage(page.id);
    request.subscribe({
      next: (updated) => {
        this.pageTogglingId.set(null);
        this.toast.success(`${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}`);
      },
      error: (err: unknown) => {
        this.pageTogglingId.set(null);
        this.toast.error(extractErrorMessage(err, 'Failed to update Page'));
      },
    });
  }

  disconnectAll(): void {
    this.confirmDialog
      .confirm({
        title: 'Disconnect Meta?',
        message: 'This permanently deletes all connected Pages and their agent assignments. You\'ll need to reconnect via Meta to bring them back.',
        confirmLabel: 'Disconnect',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.disconnecting.set(true);
        this.metaIntegration.disconnectAll().subscribe({
          next: () => {
            this.disconnecting.set(false);
            this.toast.success('Meta disconnected');
          },
          error: (err: unknown) => {
            this.disconnecting.set(false);
            this.toast.error(extractErrorMessage(err, 'Failed to disconnect Meta'));
          },
        });
      });
  }

  openAssignModal(page: MetaPage): void {
    this.assignModalPage.set(page);
    this.assignModalAgentId.set(page.linkedAgentId ?? '');
  }

  closeAssignModal(): void {
    if (this.assignSaving()) return;
    this.assignModalPage.set(null);
  }

  saveAssignModal(): void {
    const page = this.assignModalPage();
    if (!page) return;

    const selectedAgentId = this.assignModalAgentId();
    const request = selectedAgentId
      ? this.metaIntegration.assignAgent(page.id, selectedAgentId)
      : this.metaIntegration.unassignAgent(page.id);

    this.assignSaving.set(true);
    request.subscribe({
      next: (updated) => {
        this.assignSaving.set(false);
        this.assignModalPage.set(null);
        const name = this.agentName(updated.linkedAgentId);
        this.toast.success(name ? `${updated.name} assigned to ${name}` : `${updated.name} unassigned`);
      },
      error: (err: unknown) => {
        this.assignSaving.set(false);
        this.toast.error(extractErrorMessage(err, 'Failed to update agent assignment'));
      },
    });
  }
}
