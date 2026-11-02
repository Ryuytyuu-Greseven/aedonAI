import { BadRequestException, Injectable } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { MetaIntegrationsService } from '../integrations/meta/meta-integrations.service';
import { AgentLeadsRepository } from '../repos/agent-leads.repository';
import { MetaLeadsRepository } from '../repos/meta-leads.repository';
import { ScheduledCallsRepository } from '../repos/scheduled-calls.repository';
import { CallSettings } from '../schemas/agent.schema';
import { ListScheduledCallsQueryDto } from './dto/list-scheduled-calls-query.dto';

export interface ScheduledCallItem {
  id: string;
  leadSource: 'meta' | 'manual';
  /** meta_leads.leadgenId or agent_leads.leadId — what the lead's Call endpoint takes. */
  leadKey: string;
  leadName: string;
  phoneNumber: string;
  reason: string;
  attempt: number;
  dueAt: Date;
  status: string;
  note: string | null;
  callId: string | null;
  updatedAt: Date;
}

@Injectable()
export class ScheduledCallsService {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly scheduledCallsRepository: ScheduledCallsRepository,
    private readonly metaLeadsRepository: MetaLeadsRepository,
    private readonly agentLeadsRepository: AgentLeadsRepository,
    private readonly metaIntegrationsService: MetaIntegrationsService,
  ) {}

  /**
   * The agent's queued (or past) calls with each lead's name, plus the
   * agent's time zone and retry limit so the UI can say "retry 2 of 4".
   */
  async list(
    agentId: string,
    companyId: string | null,
    query: ListScheduledCallsQueryDto,
  ): Promise<{
    calls: ScheduledCallItem[];
    total: number;
    page: number;
    limit: number;
    timezone: string;
    maxRetries: number;
  }> {
    const customerId = this.requireCompanyId(companyId);
    const agent = await this.agentsService.findById(agentId, companyId);
    const settings = (agent.toObject().call_settings ??
      {}) as Partial<CallSettings>;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { items, total } = await this.scheduledCallsRepository.findForAgent(
      customerId,
      String(agent._id),
      query.view ?? 'upcoming',
      page,
      limit,
    );

    const keysOf = (source: 'meta' | 'manual') =>
      items.filter((c) => c.leadSource === source).map((c) => c.leadKey);
    const [metaNames, manualNames] = await Promise.all([
      this.metaLeadsRepository.findNamesByLeadgenIds(
        customerId,
        keysOf('meta'),
      ),
      this.agentLeadsRepository.findNamesByLeadIds(
        customerId,
        keysOf('manual'),
      ),
    ]);

    return {
      calls: items.map((call) => ({
        id: String(call._id),
        leadSource: call.leadSource,
        leadKey: call.leadKey,
        leadName:
          (call.leadSource === 'meta' ? metaNames : manualNames).get(
            call.leadKey,
          ) ?? '',
        phoneNumber: call.phoneNumber,
        reason: call.reason,
        attempt: call.attempt,
        dueAt: call.dueAt,
        status: call.status,
        note: call.note ?? null,
        callId: call.callId ?? null,
        updatedAt: call.updatedAt,
      })),
      total,
      page,
      limit,
      timezone: settings.timezone ?? 'Asia/Kolkata',
      maxRetries: settings.missed_call_retries ?? 0,
    };
  }

  async cancel(
    agentId: string,
    scheduledCallId: string,
    companyId: string | null,
    authorizationHeader: string,
  ): Promise<unknown> {
    this.requireCompanyId(companyId);
    await this.agentsService.findById(agentId, companyId);
    return this.metaIntegrationsService.cancelScheduledCall(
      scheduledCallId,
      authorizationHeader,
    );
  }

  private requireCompanyId(companyId: string | null): string {
    if (!companyId) {
      throw new BadRequestException('User is not associated with a company');
    }
    return companyId;
  }
}
