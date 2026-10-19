import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentTemplatesRepository } from '../repos/agent-templates.repository';
import { AgentTemplate } from '../schemas/agent-template.schema';
// import { AGENT_TEMPLATE_SEEDS } from './templates.seed';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly agentTemplatesRepository: AgentTemplatesRepository,
  ) { }

  async seed(): Promise<void> {
    // for (const template of AGENT_TEMPLATE_SEEDS) {
    //   await this.agentTemplatesRepository.upsertByTemplateId(template);
    // }
  }

  async findAll(): Promise<AgentTemplate[]> {
    return this.agentTemplatesRepository.filterAll();
  }

  async findById(templateId: string): Promise<AgentTemplate> {
    const template =
      await this.agentTemplatesRepository.filterById(templateId);
    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }
    return template;
  }
}
