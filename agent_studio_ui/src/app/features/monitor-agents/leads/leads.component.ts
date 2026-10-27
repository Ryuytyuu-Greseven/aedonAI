import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { CallRecord } from '../../../core/models/call-record.model';
import { AgentLead, LeadQualification, PageLead } from '../../../core/models/lead.model';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { LeadService } from '../../../core/services/lead.service';
import { MetaIntegrationService } from '../../../core/services/meta-integration.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

type LeadView = 'agent' | 'page';

const AGENT_LEADS_LIMIT = 20;
const META_LEADS_LIMIT = 20;

@Component({
  selector: 'app-leads',
  standalone: true,
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.css',
})
export class LeadsComponent implements OnChanges {
  private readonly leadService = inject(LeadService);
  private readonly metaIntegration = inject(MetaIntegrationService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) agentId!: string;
  @Output() openCall = new EventEmitter<CallRecord>();

  // Default view: Agent Leads loads automatically; Page Leads (Meta leads) only fetches on click.
  readonly view = signal<LeadView>('agent');

  // Agent Leads — real, server-paginated (GET /api/agents/:id/leads). Currently always empty:
  // nothing writes to `agent_leads` server-side yet.
  readonly agentLoading = signal(true);
  readonly agentLeads = signal<AgentLead[]>([]);
  readonly agentPage = signal(1);
  readonly agentTotal = signal(0);
  readonly agentTotalPages = computed(() => Math.max(1, Math.ceil(this.agentTotal() / AGENT_LEADS_LIMIT)));

  // Page Leads — real, scoped to this agent's linked Page via mandatory `agentId`, server-paginated
  // (GET /api/integrations/meta/leads). Only fetched once the Page Leads toggle is clicked.
  readonly pageLoading = signal(true);
  readonly pageLeads = signal<PageLead[]>([]);
  readonly pagePage = signal(1);
  readonly pageTotal = signal(0);
  readonly pageTotalPages = computed(() => Math.max(1, Math.ceil(this.pageTotal() / META_LEADS_LIMIT)));
  private pageLeadsRequested = false;
  // leadgen ids with a manual call request in flight — disables just that lead's Call button.
  readonly callingLeadIds = signal<ReadonlySet<string>>(new Set());

  ngOnChanges(): void {
    if (!this.agentId) return;

    this.agentPage.set(1);
    this.loadAgentLeads();

    this.pagePage.set(1);
    this.pageLeadsRequested = false;
    if (this.view() === 'page') this.loadPageLeads();
  }

  private loadAgentLeads(): void {
    this.agentLoading.set(true);
    this.leadService.getAgentLeads(this.agentId, { page: this.agentPage(), limit: AGENT_LEADS_LIMIT }).subscribe({
      next: (result) => {
        this.agentLeads.set(result.leads);
        this.agentTotal.set(result.total);
        this.agentLoading.set(false);
      },
      error: () => this.agentLoading.set(false),
    });
  }

  private loadPageLeads(): void {
    this.pageLeadsRequested = true;
    this.pageLoading.set(true);
    this.leadService.getPageLeads(this.agentId, { page: this.pagePage(), limit: META_LEADS_LIMIT }).subscribe({
      next: (result) => {
        this.pageLeads.set(result.leads);
        this.pageTotal.set(result.total);
        this.pageLoading.set(false);
      },
      error: () => this.pageLoading.set(false),
    });
  }

  prevAgentLeadsPage(): void {
    if (this.agentPage() === 1) return;
    this.agentPage.update((p) => p - 1);
    this.loadAgentLeads();
  }

  nextAgentLeadsPage(): void {
    if (this.agentPage() === this.agentTotalPages()) return;
    this.agentPage.update((p) => p + 1);
    this.loadAgentLeads();
  }

  prevPageLeadsPage(): void {
    if (this.pagePage() === 1) return;
    this.pagePage.update((p) => p - 1);
    this.loadPageLeads();
  }

  nextPageLeadsPage(): void {
    if (this.pagePage() === this.pageTotalPages()) return;
    this.pagePage.update((p) => p + 1);
    this.loadPageLeads();
  }

  pageName(pageId: string): string {
    return this.metaIntegration.pages()?.find((p) => p.id === pageId)?.name ?? pageId;
  }

  customFieldEntries(lead: PageLead): [string, string][] {
    return Object.entries(lead.custom_fields ?? {});
  }

  callAttemptsLabel(lead: PageLead): string {
    if (lead.call_status === 'dialing') return 'Calling…';
    if (lead.call_status === 'failed') return 'Last call failed';
    const count = lead.call_attempts_count;
    if (count === 0) return 'Not called yet';
    return `Called ${count} time${count === 1 ? '' : 's'}`;
  }

  /** Mirrors the backend's rules: needs a phone number, not mid-call, not excluded from calling. */
  canCallLead(lead: PageLead): boolean {
    return (
      !!lead.phone_number &&
      lead.call_status !== 'dialing' &&
      lead.call_status !== 'skipped' &&
      !this.callingLeadIds().has(lead.leadgen_id)
    );
  }

  callButtonTitle(lead: PageLead): string {
    if (!lead.phone_number) return 'This lead has no phone number';
    if (lead.call_status === 'skipped') return 'This lead is excluded from calling';
    if (lead.call_status === 'dialing') return 'A call to this lead is already in progress';
    return `Call ${lead.phone_number} with this agent`;
  }

  /** Places a real outbound call to the lead (after confirmation), then reflects it on the card. */
  callLead(lead: PageLead): void {
    if (!this.canCallLead(lead)) return;

    const isRecall = lead.call_attempts_count > 0;
    this.confirmDialog
      .confirm({
        title: isRecall ? 'Call this lead again?' : 'Call this lead?',
        message: `The agent will call ${lead.full_name || 'this lead'} on ${lead.phone_number} right away.`,
        confirmLabel: 'Call now',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        const leadgenId = lead.leadgen_id;
        this.setCalling(leadgenId, true);
        this.leadService.callPageLead(leadgenId).subscribe({
          next: () => {
            this.setCalling(leadgenId, false);
            this.updatePageLead(leadgenId, (l) => ({
              ...l,
              call_status: 'initiated',
              call_attempts_count: l.call_attempts_count + 1,
              last_call_error: null,
            }));
            this.toast.success(`Calling ${lead.full_name || lead.phone_number}…`);
          },
          error: (err) => {
            this.setCalling(leadgenId, false);
            // 502 = the gateway/telephony provider rejected it; the backend has marked the lead failed.
            if (err?.status === 502) {
              this.updatePageLead(leadgenId, (l) => ({ ...l, call_status: 'failed' }));
            }
            this.toast.error(extractErrorMessage(err, 'The call could not be placed'));
          },
        });
      });
  }

  private setCalling(leadgenId: string, calling: boolean): void {
    this.callingLeadIds.update((ids) => {
      const next = new Set(ids);
      if (calling) next.add(leadgenId);
      else next.delete(leadgenId);
      return next;
    });
  }

  private updatePageLead(leadgenId: string, change: (lead: PageLead) => PageLead): void {
    this.pageLeads.update((leads) => leads.map((l) => (l.leadgen_id === leadgenId ? change(l) : l)));
  }

  setView(view: LeadView): void {
    this.view.set(view);
    // On-click fetch: Meta leads are only requested once the Page Leads toggle is actually clicked.
    if (view === 'page' && !this.pageLeadsRequested) {
      this.loadPageLeads();
    }
    // Lazy + cached: only fetch Pages (for name resolution below) the first time Page Leads is
    // actually opened, and only if nothing's loaded yet this session — `pages()` acts as the cache.
    if (view === 'page' && this.metaIntegration.pages() === null) {
      this.metaIntegration.loadPages().subscribe();
    }
  }

  viewCall(lead: AgentLead): void {
    if (!lead.call) return;
    this.openCall.emit(lead.call);
  }

  qualificationLabel(qualification: LeadQualification | null): string {
    switch (qualification) {
      case 'qualified':
        return 'Qualified';
      case 'unqualified':
        return 'Unqualified';
      case 'needs_follow_up':
        return 'Needs Follow-up';
      default:
        return '';
    }
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
