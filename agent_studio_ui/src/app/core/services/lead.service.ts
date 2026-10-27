import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AgentLead, LeadsPage, LeadsQuery, PageLead, PageLeadCallResult } from '../models/lead.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly api = inject(ApiService);

  /**
   * Real `GET /api/agents/:id/leads` (agents-lead.md) — nothing writes to `agent_leads`
   * server-side yet, so this returns empty for every agent for now. That's expected, not an error.
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
}
