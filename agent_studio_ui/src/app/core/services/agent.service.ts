import { Injectable } from '@angular/core';
import { Observable, switchMap, throwError, map } from 'rxjs';
import {
  Agent,
  AgentVersion,
  CallSettings,
  toExportJson,
  AgentExportJson,
} from '../models/agent.model';
import { ApiService } from '../http/api.service';
import { toDialCode } from '../models/phone.model';

@Injectable({ providedIn: 'root' })
export class AgentService {
  constructor(private readonly api: ApiService) {}

  getAgents(): Observable<Agent[]> {
    return this.api.getAllAgents();
  }

  /** Published live snapshots for runtime UIs (Monitor). Prefer over filtering `getAgents()`. */
  getLiveAgents(): Observable<Agent[]> {
    return this.api.getLiveAgents();
  }

  getAgent(id: string): Observable<Agent> {
    return this.api.getAgent(id);
  }

  createAgent(draft?: Partial<Agent>): Observable<Agent> {
    return this.api.createNewAgent({
      ...draft,
      country_code: draft?.country_code ?? '+91',
      phone_number: draft?.phone_number,
      status: 'draft',
    });
  }

  updateAgent(id: string, data: Partial<Agent>): Observable<Agent> {
    if (data.agent_id) {
      return this.api.updateAgent(id, data, data.agent_id);
    }
    return this.api.getAgent(id).pipe(
      switchMap((existing) => {
        if (!existing.agent_id) {
          return throwError(() => new Error(`agent_id missing for agent ${id}`));
        }
        return this.api.updateAgent(id, { ...data, agent_id: existing.agent_id }, existing.agent_id);
      }),
    );
  }

  deleteAgent(id: string): Observable<void> {
    return this.api.deleteAgent(id);
  }

  cloneAgent(id: string): Observable<Agent> {
    return this.api.cloneAgent(id);
  }

  /** `draft` → `staged`. */
  stageAgent(id: string): Observable<Agent> {
    return this.api.stageAgent(id);
  }

  /**
   * Re-validate the preview hash on the server, then `staged` → `live`. `phoneNumberId`
   * is the production number selected for the live-agents clone (not the staging number).
   */
  goLive(id: string, phoneNumberId: string): Observable<Agent> {
    return this.api.previewAgent(id).pipe(switchMap(() => this.api.liveAgent(id, phoneNumberId)));
  }

  /** `live` → `disabled`. */
  /** Timezone, calling hours and missed-call retries; keeps the agent's status. */
  updateCallSettings(id: string, settings: Partial<CallSettings>): Observable<Agent> {
    return this.api.updateAgentCallSettings(id, settings);
  }

  disableAgent(id: string): Observable<Agent> {
    return this.api.disableAgent(id);
  }

  /** `disabled` → `live`. */
  enableAgent(id: string): Observable<Agent> {
    return this.api.enableAgent(id);
  }

  /** Archived stage/live versions for an agent, newest first. */
  getAgentHistory(id: string): Observable<AgentVersion[]> {
    return this.api.getAgentHistory(id);
  }

  previewAgent(id: string): Observable<{ transcript: string }> {
    return this.api.previewAgent(id);
  }

  callCustomer(
    agentId: string,
    phone: { countryCode: string; number: string },
    business?: string,
  ): Observable<unknown> {
    // Places the real outbound call via Twilio; the conversation happens on the phone.
    return this.api.startTwilioCall({ agentId, business, countryCode: toDialCode(phone.countryCode), phone: phone.number });
  }

  toExportJson(agent: Agent): AgentExportJson {
    return toExportJson(agent);
  }

  getAgentsUsingKnowledgeBase(kbId: string): Observable<Agent[]> {
    return this.getAgents().pipe(
      map((agents) => agents.filter((a) => a.knowledge_base_ids.includes(kbId))),
    );
  }

  /** No dedicated unlink API yet — no-op until knowledge-base endpoints exist. */
  unlinkKnowledgeBaseEverywhere(_kbId: string): void {
    // Intentionally empty: KB unlink is not available on the current backend.
  }
}
