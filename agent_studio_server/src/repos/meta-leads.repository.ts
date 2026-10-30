import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ListLeadsQueryDto } from '../common/dto/list-leads-query.dto';
import { buildLeadFilter } from '../common/utils/lead-query.util';
import { MetaLead } from '../schemas/meta-leads.schema';

@Injectable()
export class MetaLeadsRepository {
  constructor(
    @InjectModel(MetaLead.name)
    private readonly metaLeadModel: Model<MetaLead>,
  ) {}

  async findByCustomerIdAndPageIds(
    customerId: string,
    pageIds: string[],
    query: ListLeadsQueryDto,
  ): Promise<{ items: MetaLead[]; total: number }> {
    const filter = buildLeadFilter(
      { customerId, pageId: { $in: pageIds } },
      {
        search: query.search,
        fromDate: query.fromDate,
        toDate: query.toDate,
        dateField: 'metaCreatedAt',
      },
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await Promise.all([
      this.metaLeadModel
        .find(filter)
        .sort({ metaCreatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.metaLeadModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /** Names of a company's Meta leads, by leadgenId (for the scheduled calls list). */
  async findNamesByLeadgenIds(
    customerId: string,
    leadgenIds: string[],
  ): Promise<Map<string, string>> {
    if (leadgenIds.length === 0) return new Map();
    const leads = await this.metaLeadModel
      .find(
        { customerId, leadgenId: { $in: leadgenIds } },
        { leadgenId: 1, fullName: 1 },
      )
      .lean()
      .exec();
    return new Map(leads.map((lead) => [lead.leadgenId, lead.fullName ?? '']));
  }
}
