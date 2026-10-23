import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { ProductStatsSortKey } from '../agents/dto/list-product-stats-query.dto';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import {
  PRODUCT_ENQUIRIES_COLLECTION,
  ProductEnquiry,
  ProductEnquiryDocument,
} from '../schemas/product-enquiry.schema';
import {
  SalesProperty,
  SalesPropertyDocument,
} from '../schemas/sales-property.schema';

export interface ProductStatsRow {
  propertyId: string;
  name: string;
  description: string | null;
  enquiries: number;
  uniqueCallers: number;
  shortlisted: number;
  purchaseIntent: number;
  siteVisits: number;
  conversionRate: number;
  lastEnquiredAt: Date | null;
}

export interface ProductStatsParams {
  agentId: string;
  from: Date;
  to: Date;
  search?: string;
  sort: ProductStatsSortKey;
  order: 'asc' | 'desc';
  page: number;
  limit: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Distinct conversations that reached `stage` — `$size` of a filtered `$setUnion`. */
function distinctConversationsAt(stage: string) {
  return {
    $size: {
      $setUnion: [
        {
          $map: {
            input: {
              $filter: {
                input: '$events',
                as: 'e',
                cond: { $eq: ['$$e.stage', stage] },
              },
            },
            as: 'e',
            in: '$$e.conversationId',
          },
        },
      ],
    },
  };
}

/**
 * Builds the product-stats aggregation over `sales_properties`. Starting from
 * the agent's products (not from enquiries) is what keeps zero-enquiry
 * products in the table; preview-channel events are excluded in the lookup.
 * Exported for unit tests.
 */
export function buildProductStatsPipeline(
  params: ProductStatsParams,
): PipelineStage[] {
  const match: Record<string, unknown> = { agentId: params.agentId };
  if (params.search?.trim()) {
    match.name = new RegExp(escapeRegExp(params.search.trim()), 'i');
  }

  const direction = params.order === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> =
    params.sort === 'name'
      ? { nameLower: direction }
      : { [params.sort]: direction, nameLower: 1 };
  sort._id = 1;

  return [
    { $match: match },
    { $addFields: { propertyIdStr: { $toString: '$_id' } } },
    {
      $lookup: {
        from: PRODUCT_ENQUIRIES_COLLECTION,
        let: { pid: '$propertyIdStr' },
        pipeline: [
          {
            $match: {
              agentId: params.agentId,
              channel: 'live',
              at: { $gte: params.from, $lte: params.to },
              $expr: { $eq: ['$propertyId', '$$pid'] },
            },
          },
          {
            $project: {
              _id: 0,
              stage: 1,
              conversationId: 1,
              customerPhone: 1,
              at: 1,
            },
          },
        ],
        as: 'events',
      },
    },
    {
      $project: {
        _id: 1,
        propertyId: '$propertyIdStr',
        name: 1,
        nameLower: { $toLower: '$name' },
        description: 1,
        enquiries: { $size: { $setUnion: ['$events.conversationId', []] } },
        uniqueCallers: {
          $size: {
            $setDifference: [
              { $setUnion: ['$events.customerPhone', []] },
              [null, ''],
            ],
          },
        },
        shortlisted: distinctConversationsAt('shortlisted'),
        purchaseIntent: distinctConversationsAt('purchase_intent'),
        siteVisits: distinctConversationsAt('site_visit'),
        lastEnquiredAt: { $max: '$events.at' },
      },
    },
    {
      $addFields: {
        conversionRate: {
          $cond: [
            { $gt: ['$enquiries', 0] },
            { $divide: ['$purchaseIntent', '$enquiries'] },
            0,
          ],
        },
      },
    },
    {
      $facet: {
        items: [
          { $sort: sort },
          { $skip: (params.page - 1) * params.limit },
          { $limit: params.limit },
          { $project: { _id: 0, nameLower: 0 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ];
}

@Injectable()
export class ProductEnquiriesRepository {
  constructor(
    @InjectModel(ProductEnquiry.name)
    private readonly productEnquiryModel: Model<ProductEnquiryDocument>,
    @InjectModel(SalesProperty.name)
    private readonly salesPropertyModel: Model<SalesPropertyDocument>,
  ) {}

  /**
   * Idempotent insert keyed by `(conversationId, propertyId, stage)` — an
   * existing event is left untouched (first writer's `source`/`at` win).
   */
  async upsertEvent(event: ProductEnquiry): Promise<void> {
    const { conversationId, propertyId, stage } = event;
    try {
      await this.productEnquiryModel
        .updateOne(
          { conversationId, propertyId, stage },
          { $setOnInsert: event },
          { upsert: true },
        )
        .exec();
    } catch (error) {
      // Two concurrent upserts for the same key — the other one won.
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  async aggregateStatsForAgent(
    params: ProductStatsParams,
  ): Promise<{ items: ProductStatsRow[]; total: number }> {
    const [result] = await this.salesPropertyModel
      .aggregate<{ items: ProductStatsRow[]; total: { count: number }[] }>(
        buildProductStatsPipeline(params),
      )
      .exec();
    return {
      items: result?.items ?? [],
      total: result?.total[0]?.count ?? 0,
    };
  }
}
