import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { ListLeadsQueryDto } from '../common/dto/list-leads-query.dto';
import { buildLeadFilter } from '../common/utils/lead-query.util';
import { ManualLeadFields } from '../common/utils/manual-lead.util';
import { AgentLead } from '../schemas/agent-leads.schema';

const DUPLICATE_KEY = 11000;

interface BulkWriteErrorLike {
  writeErrors?: {
    index?: number;
    code?: number;
    err?: { index?: number; code?: number };
  }[];
}

@Injectable()
export class AgentLeadsRepository {
  constructor(
    @InjectModel(AgentLead.name)
    private readonly agentLeadModel: Model<AgentLead>,
  ) {}

  /**
   * One source's leads (`query.source`), or — when none is given — every
   * source except manual ones, which have their own tab.
   */
  async findByAgentId(
    customerId: string,
    agentId: string,
    query: ListLeadsQueryDto,
  ): Promise<{ items: AgentLead[]; total: number }> {
    const filter = buildLeadFilter(
      {
        customerId,
        agentId,
        source: query.source ?? { $ne: 'manual' },
      },
      {
        search: query.search,
        fromDate: query.fromDate,
        toDate: query.toDate,
        dateField: 'leadCreatedAt',
      },
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.agentLeadModel
        .find(filter)
        .sort({ leadCreatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.agentLeadModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /** Phone numbers among `phoneNumbers` already added to the agent on `leadDay`. */
  async findManualPhonesForDay(
    agentId: string,
    leadDay: string,
    phoneNumbers: string[],
  ): Promise<Set<string>> {
    const existing = await this.agentLeadModel
      .find(
        {
          agentId,
          source: 'manual',
          leadDay,
          phoneNumber: { $in: phoneNumbers },
        },
        { phoneNumber: 1 },
      )
      .lean()
      .exec();
    return new Set(existing.map((lead) => lead.phoneNumber));
  }

  /**
   * Inserts manual leads, skipping any that hit the agent+phone+day unique
   * index (a concurrent upload). Returns the indexes that were skipped.
   */
  async insertManual(
    customerId: string,
    agentId: string,
    leadDay: string,
    leads: ManualLeadFields[],
  ): Promise<Set<number>> {
    if (leads.length === 0) return new Set();
    const now = new Date();
    const docs = leads.map((lead) => ({
      ...lead,
      customerId,
      agentId,
      leadId: randomUUID(),
      source: 'manual',
      customFields: {},
      leadCreatedAt: now,
      leadDay,
    }));
    try {
      await this.agentLeadModel.insertMany(docs, { ordered: false });
      return new Set();
    } catch (error) {
      const writeErrors = (error as BulkWriteErrorLike).writeErrors;
      if (!writeErrors?.length) throw error;
      const skipped = new Set<number>();
      for (const writeError of writeErrors) {
        const code = writeError.code ?? writeError.err?.code;
        const index = writeError.index ?? writeError.err?.index;
        if (code !== DUPLICATE_KEY || index === undefined) throw error;
        skipped.add(index);
      }
      return skipped;
    }
  }
}
