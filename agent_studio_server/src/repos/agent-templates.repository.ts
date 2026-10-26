import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AgentTemplate,
  AgentTemplateDocument,
} from '../schemas/agent-template.schema';

/**
 * The only template the studio lists — this deployment is a personal one
 * for the lobster_agent companion. Opening other templates by id still
 * works (filterById), so existing agents built from them keep loading.
 */
export const LISTED_TEMPLATE_IDS = ['lobster_agent'];

@Injectable()
export class AgentTemplatesRepository {
  constructor(
    @InjectModel(AgentTemplate.name)
    private readonly templateModel: Model<AgentTemplateDocument>,
  ) { }

  async upsertByTemplateId(template: AgentTemplate): Promise<void> {
    await this.templateModel.updateOne(
      { template_id: template.template_id },
      { $setOnInsert: template },
      { upsert: true },
    );
  }

  async filterAll(): Promise<AgentTemplateDocument[]> {
    return this.templateModel
      .find({ status: true, template_id: { $in: LISTED_TEMPLATE_IDS } })
      .sort({ name: 1 })
      .exec();
  }

  async filterById(templateId: string): Promise<AgentTemplateDocument | null> {
    return this.templateModel.findOne({ template_id: templateId }).exec();
  }
}
