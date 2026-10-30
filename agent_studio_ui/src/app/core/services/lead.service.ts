import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AgentLead,
  LeadsPage,
  LeadsQuery,
  ManualLead,
  ManualLeadCallResult,
  ManualLeadInput,
  ManualLeadsUploadResult,
  PageLead,
  PageLeadCallResult,
  ScheduledCallsPage,
} from '../models/lead.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly api = inject(ApiService);

  /**
   * Real `GET /api/agents/:id/leads` (agents-lead.md) — every source but manual leads, which
   * have their own view. Nothing else writes to `agent_leads` yet, so this is usually empty.
   */
  getAgentLeads(agentId: string, query: LeadsQuery = {}): Observable<LeadsPage<AgentLead>> {
    return this.api.getAgentLeads(agentId, query);
  }

  /**
   * Real Meta `leadgen` leads (`GET /api/integrations/meta/leads`) — `agentId` is mandatory,
   * scoping results to the leads for that agent's linked Page. Paginated per `agents-lead.md`.
   */
  getPageLeads(agentId: string, query: LeadsQuery = {}): Observable<LeadsPage<PageLead>> {
    return this.api.getMetaLeads(agentId, query);
  }

  /**
   * Manually calls one Meta lead (`POST /api/integrations/meta/leads/:leadgenId/call`) — the way to
   * reach leads past the 48h auto-call window, or whose auto-call failed.
   */
  callPageLead(leadgenId: string): Observable<PageLeadCallResult> {
    return this.api.callMetaLead(leadgenId);
  }

  /** Manual leads (uploaded or dialled) — `GET /api/agents/:id/leads?source=manual`. */
  getManualLeads(agentId: string, query: LeadsQuery = {}): Observable<LeadsPage<ManualLead>> {
    return this.api.getManualLeads(agentId, query);
  }

  /** Adds reviewed sheet rows; invalid rows come back in `rejected`, today's repeats in `duplicates`. */
  uploadManualLeads(agentId: string, leads: ManualLeadInput[]): Observable<ManualLeadsUploadResult> {
    return this.api.uploadManualLeads(agentId, leads);
  }

  callManualLead(agentId: string, leadId: string): Observable<ManualLeadCallResult> {
    return this.api.callManualLead(agentId, leadId);
  }

  dialManualLead(agentId: string, phoneNumber: string, fullName?: string): Observable<ManualLeadCallResult> {
    return this.api.dialManualLead(agentId, { phoneNumber, ...(fullName ? { fullName } : {}) });
  }

  /** Upcoming (pending / dialing) or past (done / failed / cancelled) queued calls for an agent. */
  getScheduledCalls(agentId: string, view: 'upcoming' | 'past', page: number, limit: number): Observable<ScheduledCallsPage> {
    return this.api.getScheduledCalls(agentId, view, page, limit);
  }

  cancelScheduledCall(agentId: string, callId: string): Observable<void> {
    return this.api.cancelScheduledCall(agentId, callId);
  }
}
