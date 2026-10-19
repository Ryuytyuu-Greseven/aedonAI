import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AgentTemplate,
  AgentTemplateDocument,
} from '../schemas/agent-template.schema';

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
    return this.templateModel.find({ status: true }).sort({ name: 1 }).exec();
  }

  async filterById(templateId: string): Promise<AgentTemplateDocument | null> {
    return this.templateModel.findOne({ template_id: templateId }).exec();
  }
}
