import { Injectable, Logger } from '@nestjs/common';
import { MetaLeadsRepository } from '../repos/meta-leads.repository';
import { MetaLead } from '../schemas/meta-lead.schema';
import { UpsertMetaLeadInput } from '../common/interfaces/meta-lead.interface';

@Injectable()
export class MetaLeadsService {
  private readonly logger = new Logger(MetaLeadsService.name);

  constructor(private readonly metaLeadsRepository: MetaLeadsRepository) {}

  async saveLead(input: UpsertMetaLeadInput): Promise<MetaLead> {
    const lead = await this.metaLeadsRepository.upsertByLeadgenId(input);
    this.logger.log(`Stored lead ${input.leadgenId} for page ${input.pageId}`);
    return lead;
  }

  /** Stores the lead only if it isn't already in the DB; returns true if it was new. */
  async saveLeadIfNew(input: UpsertMetaLeadInput): Promise<boolean> {
    const inserted = await this.metaLeadsRepository.insertIfNew(input);
    if (inserted) this.logger.log(`Stored new lead ${input.leadgenId} for page ${input.pageId}`);
    return inserted;
  }
}
