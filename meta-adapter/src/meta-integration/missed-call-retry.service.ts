import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { callSettingsOf, isWithinCallingHours, nextCallingTime } from '../common/utils/calling-hours';
import { AgentLeadsRepository } from '../repos/agent-leads.repository';
import { AgentsRepository } from '../repos/agents.repository';
import { MetaLeadsRepository } from '../repos/meta-leads.repository';
import { ScheduledCallsRepository } from '../repos/scheduled-calls.repository';
import { CallAttempt } from '../schemas/meta-lead.schema';
import { LeadSource, ScheduledCall } from '../schemas/scheduled-call.schema';
import { CallsGatewayClient } from './calls-gateway.client';
import { CallOutcomeDto } from './dto/call-outcome.dto';
import { LeadCallRunResult } from './meta-lead-call.service';

/** The parts of a Meta or manual lead this service needs. */
interface LeadView {
  source: LeadSource;
  key: string;
  customerId: string;
  agentId?: string;
  phoneNumber: string;
  callAttempts: CallAttempt[];
}

/**
 * Missed-call retries, per agent: `call_settings.missed_call_retries` (0–4)
 * more attempts, `missed_call_retry_gap_minutes` apart, always inside the
 * agent's calling hours. Driven by the outcome calls_input_gateway reports
 * for each call; an answered call (or any new call) ends the retries.
 */
@Injectable()
export class MissedCallRetryService {
  private readonly logger = new Logger(MissedCallRetryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly agentsRepository: AgentsRepository,
    private readonly metaLeadsRepository: MetaLeadsRepository,
    private readonly agentLeadsRepository: AgentLeadsRepository,
    private readonly scheduledCallsRepository: ScheduledCallsRepository,
    private readonly callsGateway: CallsGatewayClient,
  ) { }

  /** Records a call's outcome on its lead and schedules (or clears) the next retry. */
  async handleOutcome(dto: CallOutcomeDto): Promise<{ handled: boolean; nextCallAt?: Date }> {
    const lead = await this.recordOutcome(dto);
    if (!lead) return { handled: false }; // not a lead call, or already reported

    if (dto.outcome === 'answered') {
      await this.clearRetry(lead, 'Answered');
      return { handled: true };
    }

    const missedInARow = countTrailingMissed(lead.callAttempts);
    const lastAttempt = lead.callAttempts[lead.callAttempts.length - 1];
    const agentId = lastAttempt?.agentId ?? lead.agentId;
    const agent = agentId ? await this.agentsRepository.findById(agentId) : null;
    const settings = agent ? callSettingsOf(agent) : null;

    // n misses in a row have used n - 1 retries; retry while some are left.
    if (!agent || !settings || missedInARow > settings.missed_call_retries) {
      await this.clearRetry(lead, 'No retries left');
      return { handled: true };
    }

    const dueAt = nextCallingTime(
      new Date(Date.now() + settings.missed_call_retry_gap_minutes * 60_000),
      settings,
    );
    await this.scheduledCallsRepository.schedule({
      customerId: lead.customerId,
      agentId: String(agent._id),
      leadSource: lead.source,
      leadKey: lead.key,
      phoneNumber: lead.phoneNumber,
      reason: 'missed_retry',
      attempt: missedInARow,
      afterCallId: dto.callSid,
      dueAt,
    });
    await this.setNextCallAt(lead, dueAt);
    this.logger.log(
      `Missed call ${dto.callSid} (${dto.providerStatus}) to ${lead.source} lead ${lead.key} — retry ${missedInARow}/${settings.missed_call_retries} at ${dueAt.toISOString()}`,
    );
    return { handled: true, nextCallAt: dueAt };
  }

  /** A user cancelling a queued call from the leads page. */
  async cancelScheduled(id: string, companyId: string): Promise<{ id: string; status: 'cancelled' }> {
    const job = await this.scheduledCallsRepository.cancelPendingForCustomer(id, companyId, 'Cancelled by user');
    if (!job) throw new NotFoundException('No pending scheduled call with this id');
    const lead = await this.findLead(job.leadSource, job.leadKey);
    if (lead) await this.setNextCallAt(lead, null);
    this.logger.log(`Scheduled call ${id} (${job.leadSource} lead ${job.leadKey}) cancelled by user`);
    return { id, status: 'cancelled' };
  }

  /** Places due retries (up to the batch size), postponing any that fall outside calling hours. */
  async dispatchDue(): Promise<LeadCallRunResult> {
    const result: LeadCallRunResult = { initiated: 0, failed: 0 };
    const gatewayUrl = this.callsGateway.baseUrl();
    if (!gatewayUrl) return result;

    const batchSize = Number(this.configService.get<string>('META_LEAD_CALL_BATCH_SIZE', '10'));
    for (let i = 0; i < batchSize; i++) {
      const job = await this.scheduledCallsRepository.claimNextDue(new Date());
      if (!job) break;
      const outcome = await this.dispatch(gatewayUrl, job);
      if (outcome === 'initiated') result.initiated++;
      else if (outcome === 'failed') result.failed++;
    }

    if (result.initiated || result.failed) {
      this.logger.log(`Scheduled call run done: ${result.initiated} initiated, ${result.failed} failed`);
    }
    return result;
  }

  private async dispatch(gatewayUrl: string, job: ScheduledCall): Promise<'initiated' | 'failed' | 'skipped'> {
    const jobId = String(job._id);
    const lead = await this.findLead(job.leadSource, job.leadKey);
    const lastCallId = lead?.callAttempts[lead.callAttempts.length - 1]?.callId;
    if (!lead || lastCallId !== job.afterCallId) {
      // Gone, or called again since the miss — that call decides what's next.
      await this.scheduledCallsRepository.finish(jobId, 'cancelled', { note: 'Lead was called again or removed' });
      return 'skipped';
    }

    const agent = await this.agentsRepository.findById(job.agentId);
    if (!agent || !agent.phone_number || !agent.base_template_id) {
      await this.cancel(job, lead, "Agent can't place calls");
      return 'skipped';
    }
    const settings = callSettingsOf(agent);
    if (job.attempt > settings.missed_call_retries) {
      await this.cancel(job, lead, 'Retries were turned down since this was scheduled');
      return 'skipped';
    }
    if (!isWithinCallingHours(new Date(), settings)) {
      const dueAt = nextCallingTime(new Date(), settings);
      await this.postpone(job, lead, dueAt);
      return 'skipped';
    }

    const claimed = await this.claimLead(lead);
    if (!claimed) {
      await this.cancel(job, lead, 'Lead is being called or is skipped');
      return 'skipped';
    }

    try {
      const callSid = await this.callsGateway.placeCall(gatewayUrl, lead.phoneNumber, agent);
      await this.recordCallInitiated(lead, callSid, String(agent._id));
      await this.scheduledCallsRepository.finish(jobId, 'done', { callId: callSid });
      this.logger.log(`Retry ${job.attempt} placed to ${lead.source} lead ${lead.key}: call ${callSid}`);
      return 'initiated';
    } catch (error) {
      await this.recordCallFailed(lead, error.message, String(agent._id));
      await this.scheduledCallsRepository.finish(jobId, 'failed', { note: error.message });
      this.logger.error(`Retry ${job.attempt} to ${lead.source} lead ${lead.key} failed: ${error.message}`);
      return 'failed';
    }
  }

  private async postpone(job: ScheduledCall, lead: LeadView, dueAt: Date): Promise<void> {
    try {
      await this.scheduledCallsRepository.postpone(String(job._id), dueAt);
      await this.setNextCallAt(lead, dueAt);
    } catch {
      // A newer pending call for this lead already exists (unique index) — this one is stale.
      await this.scheduledCallsRepository.finish(String(job._id), 'cancelled', { note: 'Superseded' });
    }
  }

  private async cancel(job: ScheduledCall, lead: LeadView, note: string): Promise<void> {
    await this.scheduledCallsRepository.finish(String(job._id), 'cancelled', { note });
    await this.setNextCallAt(lead, null);
    this.logger.warn(`Retry ${job.attempt} to ${lead.source} lead ${lead.key} cancelled: ${note}`);
  }

  private async clearRetry(lead: LeadView, note: string): Promise<void> {
    await this.scheduledCallsRepository.cancelPendingForLead(lead.source, lead.key, note);
    await this.setNextCallAt(lead, null);
  }

  // ── Meta / manual lead access ────────────────────────────

  private async recordOutcome(dto: CallOutcomeDto): Promise<LeadView | null> {
    const meta = await this.metaLeadsRepository.recordCallOutcome(dto.callSid, dto.outcome, dto.providerStatus);
    if (meta) return { source: 'meta', key: meta.leadgenId, ...pickLead(meta) };
    const manual = await this.agentLeadsRepository.recordCallOutcome(dto.callSid, dto.outcome, dto.providerStatus);
    if (manual) return { source: 'manual', key: manual.leadId, ...pickLead(manual) };
    return null;
  }

  private async findLead(source: LeadSource, key: string): Promise<LeadView | null> {
    if (source === 'meta') {
      const lead = await this.metaLeadsRepository.findByLeadgenId(key);
      return lead ? { source, key, ...pickLead(lead) } : null;
    }
    const lead = await this.agentLeadsRepository.findByLeadId(key);
    return lead ? { source, key, ...pickLead(lead) } : null;
  }

  private claimLead(lead: LeadView): Promise<unknown> {
    return lead.source === 'meta'
      ? this.metaLeadsRepository.claimForScheduledCall(lead.key)
      : this.agentLeadsRepository.claimForScheduledCall(lead.key);
  }

  private recordCallInitiated(lead: LeadView, callSid: string, agentId: string): Promise<void> {
    return lead.source === 'meta'
      ? this.metaLeadsRepository.recordCallInitiated(lead.key, callSid, agentId)
      : this.agentLeadsRepository.recordCallInitiated(lead.key, callSid, agentId);
  }

  private recordCallFailed(lead: LeadView, error: string, agentId: string): Promise<void> {
    return lead.source === 'meta'
      ? this.metaLeadsRepository.recordCallFailed(lead.key, error, agentId)
      : this.agentLeadsRepository.recordCallFailed(lead.key, error);
  }

  private setNextCallAt(lead: LeadView, nextCallAt: Date | null): Promise<void> {
    return lead.source === 'meta'
      ? this.metaLeadsRepository.setNextCallAt(lead.key, nextCallAt)
      : this.agentLeadsRepository.setNextCallAt(lead.key, nextCallAt);
  }
}

function pickLead(lead: {
  customerId: string;
  agentId?: string;
  phoneNumber: string;
  callAttempts?: CallAttempt[];
}): Omit<LeadView, 'source' | 'key'> {
  return {
    customerId: lead.customerId,
    agentId: lead.agentId,
    phoneNumber: lead.phoneNumber,
    callAttempts: lead.callAttempts ?? [],
  };
}

/** Missed calls at the end of the history, back to the last answered (or unreported) one. */
export function countTrailingMissed(attempts: CallAttempt[]): number {
  let count = 0;
  for (let i = attempts.length - 1; i >= 0 && attempts[i].outcome === 'missed'; i--) count++;
  return count;
}
