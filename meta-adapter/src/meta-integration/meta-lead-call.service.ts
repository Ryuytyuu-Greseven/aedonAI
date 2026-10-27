import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AgentsRepository } from '../repos/agents.repository';
import { ConnectedPagesRepository } from '../repos/connected-pages.repository';
import { MetaLeadsRepository } from '../repos/meta-leads.repository';
import { AgentDocument } from '../schemas/agent.schema';
import { MetaLead } from '../schemas/meta-lead.schema';

export interface LeadCallRunResult {
  initiated: number;
  failed: number;
}

export interface ManualLeadCallResult {
  leadgenId: string;
  callSid: string;
  agentId: string;
  callStatus: 'initiated';
}

/**
 * Dials stored leads through calls_input_gateway, which owns the telephony
 * provider (Twilio/Exotel/...) and streams the Page's linked agent onto the
 * call. The cron dials each lead at most once, within its auto-call window;
 * anything after that is a manual call triggered from the leads page.
 */
@Injectable()
export class MetaLeadCallService {
  private readonly logger = new Logger(MetaLeadCallService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly connectedPagesRepository: ConnectedPagesRepository,
    private readonly agentsRepository: AgentsRepository,
    private readonly metaLeadsRepository: MetaLeadsRepository,
  ) { }

  async dispatchPendingCalls(): Promise<LeadCallRunResult> {
    const result: LeadCallRunResult = { initiated: 0, failed: 0 };

    const gatewayUrl = this.configService.get<string>('CALLS_GATEWAY_URL')?.replace(/\/+$/, '');
    if (!gatewayUrl) {
      this.logger.error('CALLS_GATEWAY_URL not set — cannot place lead calls');
      return result;
    }

    // Auto-calling only covers a lead's first 48h by default; after that it's
    // left for the user to call manually from the leads page (and turning
    // the cron on never dials through an old backlog).
    const maxAgeHours = Number(this.configService.get<string>('META_LEAD_CALL_MAX_AGE_HOURS', '48'));
    const batchSize = Number(this.configService.get<string>('META_LEAD_CALL_BATCH_SIZE', '10'));
    const createdAfter = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const agentsByPageId = await this.resolveAgentsByPageId();
    const pageIds = [...agentsByPageId.keys()];
    if (pageIds.length === 0) return result;

    for (let i = 0; i < batchSize; i++) {
      const lead = await this.metaLeadsRepository.claimNextForCalling(pageIds, createdAfter);
      if (!lead) break;

      const agent = agentsByPageId.get(lead.pageId)!;
      const agentId = String(agent._id);
      try {
        const callSid = await this.placeCall(gatewayUrl, lead, agent);
        await this.metaLeadsRepository.recordCallInitiated(lead.leadgenId, callSid, agentId);
        result.initiated++;
        this.logger.log(`Call ${callSid} placed to lead ${lead.leadgenId} with agent "${agent.agent_name}"`);
      } catch (error) {
        await this.metaLeadsRepository.recordCallFailed(lead.leadgenId, error.message, agentId);
        result.failed++;
        this.logger.error(`Call to lead ${lead.leadgenId} failed: ${error.message}`);
      }
    }

    if (result.initiated || result.failed) {
      this.logger.log(`Lead call run done: ${result.initiated} initiated, ${result.failed} failed`);
    }
    return result;
  }

  /**
   * Places a call to one lead on a user's request (leads page), regardless
   * of the lead's age or earlier attempts — this is how leads past the
   * auto-call window, or whose auto-call failed, get called. Scoped to the
   * caller's company so one tenant can never dial another tenant's leads.
   */
  async callLeadManually(leadgenId: string, companyId: string): Promise<ManualLeadCallResult> {
    const gatewayUrl = this.configService.get<string>('CALLS_GATEWAY_URL')?.replace(/\/+$/, '');
    if (!gatewayUrl) throw new ServiceUnavailableException('Calling is not configured');

    const lead = await this.metaLeadsRepository.findByLeadgenIdForCustomer(leadgenId, companyId);
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.phoneNumber) throw new BadRequestException('Lead has no phone number');
    if (lead.callStatus === 'skipped') throw new ConflictException('Lead is marked as skipped for calling');

    const page = await this.connectedPagesRepository.findActiveByPageId(lead.pageId);
    if (!page?.agentId) throw new BadRequestException("Lead's Page has no agent linked");
    const agent = await this.resolveCallableAgent(page.pageId, page.agentId);
    if (!agent) throw new BadRequestException("Lead's linked agent can't place calls (missing agent, phone number or template)");

    // Atomic claim so a double-click (or the cron) can't dial the same lead twice at once
    const claimed = await this.metaLeadsRepository.claimForManualCall(leadgenId, companyId);
    if (!claimed) throw new ConflictException('A call to this lead is already in progress');

    const agentId = String(agent._id);
    try {
      console.log('call details');
      const callSid = await this.placeCall(gatewayUrl, claimed, agent);
      console.log('call details 2');

      await this.metaLeadsRepository.recordCallInitiated(leadgenId, callSid, agentId);
      this.logger.log(`Manual call ${callSid} placed to lead ${leadgenId} with agent "${agent.agent_name}"`);
      return { leadgenId, callSid, agentId, callStatus: 'initiated' };
    } catch (error) {
      console.log(error);
      await this.metaLeadsRepository.recordCallFailed(leadgenId, error.message, agentId);
      this.logger.error(`Manual call to lead ${leadgenId} failed: ${error.message}`);
      throw new BadGatewayException('The call could not be placed');
    }
  }

  /** Maps each active Page to its linked agent, dropping Pages whose agent can't place calls. */
  private async resolveAgentsByPageId(): Promise<Map<string, AgentDocument>> {
    const agentsByPageId = new Map<string, AgentDocument>();

    for (const page of await this.connectedPagesRepository.findAllActiveWithAgent()) {
      const agent = await this.resolveCallableAgent(page.pageId, page.agentId!);
      if (agent) agentsByPageId.set(page.pageId, agent);
    }

    return agentsByPageId;
  }

  /** Loads a Page's linked agent, or null (with a warning) if it can't place calls. */
  private async resolveCallableAgent(pageId: string, agentId: string): Promise<AgentDocument | null> {
    const agent = await this.agentsRepository.findById(agentId);
    if (!agent) {
      this.logger.warn(`Page ${pageId} is linked to agent ${agentId}, which doesn't exist — not calling its leads`);
      return null;
    }
    // The gateway picks the agent by the call's `from` number and its
    // server by `business`; without both the call would reach the wrong agent.
    if (!agent.phone_number || !agent.base_template_id) {
      this.logger.warn(
        `Agent "${agent.agent_name}" (Page ${pageId}) has no phone_number or base_template_id — not calling its leads`,
      );
      return null;
    }
    return agent;
  }

  /** POST {CALLS_GATEWAY_URL}/twilio/call — returns the provider's call id. */
  private async placeCall(gatewayUrl: string, lead: MetaLead, agent: AgentDocument): Promise<string> {
    const res = await fetch(`${gatewayUrl}/twilio/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The gateway rejects outbound-call requests without its internal key
        'x-internal-api-key': this.configService.get<string>('CALLS_GATEWAY_API_KEY') ?? '',
      },
      body: JSON.stringify({
        to: lead.phoneNumber,
        from: agent.phone_number,
        business: agent.base_template_id,
        agentId: agent.agent_id,
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gateway responded ${res.status}: ${JSON.stringify(data)}`);
    if (!data.callSid) throw new Error(`Gateway returned no callSid: ${JSON.stringify(data)}`);
    return data.callSid;
  }
}
