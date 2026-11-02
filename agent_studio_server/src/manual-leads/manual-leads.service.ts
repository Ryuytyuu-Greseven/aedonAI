import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import {
  ManualLeadFields,
  manualLeadDay,
  validateManualLead,
} from '../common/utils/manual-lead.util';
import { MetaIntegrationsService } from '../integrations/meta/meta-integrations.service';
import { AgentLeadsRepository } from '../repos/agent-leads.repository';
import { DialManualLeadDto } from './dto/dial-manual-lead.dto';

/** Outcome per submitted row; `index` is the row's position in the request. */
export interface ManualLeadsUploadResult {
  inserted: number;
  /** Already added to this agent today — accepted, not inserted again. */
  duplicates: { index: number; phoneNumber: string }[];
  /** Failed validation — not inserted; fix and resubmit just these. */
  rejected: { index: number; lead: ManualLeadFields; errors: string[] }[];
}

@Injectable()
export class ManualLeadsService {
  private readonly logger = new Logger(ManualLeadsService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentLeadsRepository: AgentLeadsRepository,
    private readonly metaIntegrationsService: MetaIntegrationsService,
  ) {}

  /**
   * Validates each row, drops duplicates (same agent + phone on the same IST
   * day, in the file or already stored) and inserts the rest. Invalid rows
   * are returned instead of failing the whole upload.
   */
  async upload(
    agentId: string,
    companyId: string | null,
    rows: Record<string, unknown>[],
  ): Promise<ManualLeadsUploadResult> {
    const customerId = this.requireCompanyId(companyId);
    const agent = await this.agentsService.findById(agentId, companyId);
    const agentKey = String(agent._id);
    const leadDay = manualLeadDay();
    const result: ManualLeadsUploadResult = {
      inserted: 0,
      duplicates: [],
      rejected: [],
    };

    const valid: { index: number; lead: ManualLeadFields }[] = [];
    rows.forEach((row, index) => {
      const { lead, errors } = validateManualLead(row);
      if (errors.length) result.rejected.push({ index, lead, errors });
      else valid.push({ index, lead });
    });

    const stored = await this.agentLeadsRepository.findManualPhonesForDay(
      agentKey,
      leadDay,
      [...new Set(valid.map(({ lead }) => lead.phoneNumber))],
    );
    const seen = new Set<string>();
    const toInsert: { index: number; lead: ManualLeadFields }[] = [];
    for (const row of valid) {
      const phone = row.lead.phoneNumber;
      if (stored.has(phone) || seen.has(phone)) {
        result.duplicates.push({ index: row.index, phoneNumber: phone });
      } else {
        seen.add(phone);
        toInsert.push(row);
      }
    }

    const skipped = await this.agentLeadsRepository.insertManual(
      customerId,
      agentKey,
      leadDay,
      toInsert.map(({ lead }) => lead),
    );
    toInsert.forEach((row, i) => {
      if (skipped.has(i)) {
        result.duplicates.push({
          index: row.index,
          phoneNumber: row.lead.phoneNumber,
        });
      } else {
        result.inserted++;
      }
    });
    result.duplicates.sort((a, b) => a.index - b.index);

    this.logger.log(
      `Manual leads for agent ${agentKey}: ${result.inserted} inserted, ${result.duplicates.length} duplicate, ${result.rejected.length} rejected`,
    );
    return result;
  }

  /** Calls one manual lead now (meta-adapter places the call). */
  async callLead(
    agentId: string,
    leadId: string,
    companyId: string | null,
    authorizationHeader: string,
  ): Promise<unknown> {
    this.requireCompanyId(companyId);
    await this.agentsService.findById(agentId, companyId);
    return this.metaIntegrationsService.callManualLead(
      leadId,
      authorizationHeader,
    );
  }

  /**
   * Calls a typed-in number. meta-adapter stores it as a manual lead (or
   * reuses today's lead for that number) so the call shows in the list.
   */
  async dial(
    agentId: string,
    companyId: string | null,
    dto: DialManualLeadDto,
    authorizationHeader: string,
  ): Promise<unknown> {
    this.requireCompanyId(companyId);
    const agent = await this.agentsService.findById(agentId, companyId);
    return this.metaIntegrationsService.dialManualLead(
      {
        agentId: String(agent._id),
        phoneNumber: dto.phoneNumber,
        fullName: dto.fullName?.trim() ?? '',
        leadDay: manualLeadDay(),
      },
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
