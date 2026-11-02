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

import { AgentLeadsRepository } from '../repos/agent-leads.repository';
import { AgentsRepository } from '../repos/agents.repository';
import { ScheduledCallsRepository } from '../repos/scheduled-calls.repository';
import { AgentDocument } from '../schemas/agent.schema';
import { AgentLead } from '../schemas/agent-lead.schema';
import { CallsGatewayClient } from './calls-gateway.client';
import { callSettingsOf, isWithinCallingHours } from '../common/utils/calling-hours';
import { DialManualLeadDto } from './dto/dial-manual-lead.dto';
import { LeadCallRunResult } from './meta-lead-call.service';

export interface ManualLeadCallResult {
  leadId: string;
  callSid: string;
  agentId: string;
  callStatus: 'initiated';
}

/**
 * Dials manual leads (`agent_leads`, uploaded or typed in on the leads page)
 * exactly like Meta leads: the cron calls each one once within its auto-call
 * window (a week by default), anything else is a manual call.
 */
@Injectable()
export class ManualLeadCallService {
  private readonly logger = new Logger(ManualLeadCallService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly agentsRepository: AgentsRepository,
    private readonly agentLeadsRepository: AgentLeadsRepository,
    private readonly callsGateway: CallsGatewayClient,
    private readonly scheduledCallsRepository: ScheduledCallsRepository,
  ) { }

  async dispatchPendingCalls(): Promise<LeadCallRunResult> {
    const result: LeadCallRunResult = { initiated: 0, failed: 0 };

    const gatewayUrl = this.callsGateway.baseUrl();
    if (!gatewayUrl) {
      this.logger.error('CALLS_GATEWAY_URL not set — cannot place manual lead calls');
      return result;
    }

    const maxAgeHours = Number(this.configService.get<string>('MANUAL_LEAD_CALL_MAX_AGE_HOURS', '168'));
    const batchSize = Number(this.configService.get<string>('META_LEAD_CALL_BATCH_SIZE', '10'));
    const createdAfter = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const agentsById = new Map<string, AgentDocument>();
    for (const agentId of await this.agentLeadsRepository.findAgentIdsWithPendingManualLeads(createdAfter)) {
      const agent = await this.resolveCallableAgent(agentId);
      // Outside the agent's calling hours its new leads wait for the next opening.
      if (agent && isWithinCallingHours(new Date(), callSettingsOf(agent))) agentsById.set(agentId, agent);
    }
    if (agentsById.size === 0) return result;

    for (let i = 0; i < batchSize; i++) {
      const lead = await this.agentLeadsRepository.claimNextManualForCalling([...agentsById.keys()], createdAfter);
      if (!lead) break;

      const agent = agentsById.get(lead.agentId)!;
      if (await this.dial(gatewayUrl, lead, agent)) result.initiated++;
      else result.failed++;
    }

    if (result.initiated || result.failed) {
      this.logger.log(`Manual lead call run done: ${result.initiated} initiated, ${result.failed} failed`);
    }
    return result;
  }

  /** Calls one of the company's manual leads now, regardless of age or earlier attempts. */
  async callLeadManually(leadId: string, companyId: string): Promise<ManualLeadCallResult> {
    const gatewayUrl = this.requireGatewayUrl();

    const lead = await this.agentLeadsRepository.findManualForCustomer(leadId, companyId);
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.phoneNumber) throw new BadRequestException('Lead has no phone number');
    if (lead.callStatus === 'skipped') throw new ConflictException('Lead is marked as skipped for calling');

    const agent = await this.requireCallableAgent(lead.agentId);

    // Atomic claim so a double-click (or the cron) can't dial the same lead twice at once
    const claimed = await this.agentLeadsRepository.claimForManualCall(leadId, companyId);
    if (!claimed) throw new ConflictException('A call to this lead is already in progress');

    return this.dialOrThrow(gatewayUrl, claimed, agent);
  }

  /**
   * Calls a typed-in number with the agent, storing it as today's manual
   * lead (or reusing today's lead for that number) so it shows in the list.
   */
  async dialNumber(dto: DialManualLeadDto, companyId: string): Promise<ManualLeadCallResult> {
    const gatewayUrl = this.requireGatewayUrl();

    const agent = await this.requireCallableAgent(dto.agentId);
    if (agent.companyId !== companyId) throw new NotFoundException('Agent not found');

    const lead = await this.agentLeadsRepository.claimDialLead({
      customerId: companyId,
      agentId: dto.agentId,
      phoneNumber: dto.phoneNumber,
      fullName: dto.fullName?.trim() ?? '',
      leadDay: dto.leadDay,
    });
    if (!lead) throw new ConflictException('A call to this number is already in progress');

    return this.dialOrThrow(gatewayUrl, lead, agent);
  }

  /** Places the call and records the outcome on the lead; false when it failed. */
  private async dial(gatewayUrl: string, lead: AgentLead, agent: AgentDocument): Promise<boolean> {
    try {
      const callSid = await this.callsGateway.placeCall(gatewayUrl, lead.phoneNumber, agent);
      await this.agentLeadsRepository.recordCallInitiated(lead.leadId, callSid, lead.agentId);
      this.logger.log(`Call ${callSid} placed to manual lead ${lead.leadId} with agent "${agent.agent_name}"`);
      return true;
    } catch (error) {
      await this.agentLeadsRepository.recordCallFailed(lead.leadId, error.message);
      this.logger.error(`Call to manual lead ${lead.leadId} failed: ${error.message}`);
      return false;
    }
  }

  private async dialOrThrow(gatewayUrl: string, lead: AgentLead, agent: AgentDocument): Promise<ManualLeadCallResult> {
    const callSid = await this.callsGateway.placeCall(gatewayUrl, lead.phoneNumber, agent).catch(async (error) => {
      await this.agentLeadsRepository.recordCallFailed(lead.leadId, error.message);
      this.logger.error(`Manual call to lead ${lead.leadId} failed: ${error.message}`);
      throw new BadGatewayException('The call could not be placed');
    });
    await this.agentLeadsRepository.recordCallInitiated(lead.leadId, callSid, lead.agentId);
    // This call replaces any queued retry; its own outcome decides what's next.
    await this.scheduledCallsRepository.cancelPendingForLead('manual', lead.leadId, 'Called manually');
    this.logger.log(`Manual call ${callSid} placed to lead ${lead.leadId} with agent "${agent.agent_name}"`);
    return { leadId: lead.leadId, callSid, agentId: lead.agentId, callStatus: 'initiated' };
  }

  private requireGatewayUrl(): string {
    const gatewayUrl = this.callsGateway.baseUrl();
    if (!gatewayUrl) throw new ServiceUnavailableException('Calling is not configured');
    return gatewayUrl;
  }

  private async requireCallableAgent(agentId: string): Promise<AgentDocument> {
    const agent = await this.resolveCallableAgent(agentId);
    if (!agent) {
      throw new BadRequestException("This agent can't place calls yet (missing agent, phone number or template)");
    }
    return agent;
  }

  /** The agent, or null (with a warning) if it can't place calls — same rule as for Meta leads. */
  private async resolveCallableAgent(agentId: string): Promise<AgentDocument | null> {
    const agent = await this.agentsRepository.findById(agentId);
    if (!agent) {
      this.logger.warn(`Manual leads belong to agent ${agentId}, which doesn't exist — not calling them`);
      return null;
    }
    // The gateway picks the agent by the call's `from` number and its server by `business`
    if (!agent.phone_number || !agent.base_template_id) {
      this.logger.warn(`Agent "${agent.agent_name}" has no phone_number or base_template_id — not calling its manual leads`);
      return null;
    }
    return agent;
  }
}
