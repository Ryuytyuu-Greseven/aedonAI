import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ListLeadsQueryDto } from '../common/dto/list-leads-query.dto';
import { buildLeadFilter } from '../common/utils/lead-query.util';
import { AgentLead } from '../schemas/agent-leads.schema';

@Injectable()
export class AgentLeadsRepository {
  constructor(
    @InjectModel(AgentLead.name)
    private readonly agentLeadModel: Model<AgentLead>,
  ) {}

  async findByAgentId(
    customerId: string,
    agentId: string,
    query: ListLeadsQueryDto,
  ): Promise<{ items: AgentLead[]; total: number }> {
    const filter = buildLeadFilter(
      { customerId, agentId },
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
}
