import { Injectable, NotFoundException } from '@nestjs/common';
import { assertSameCompany } from '../../common/utils/company-scope.util';
import { AgentsRepository } from '../../repos/agents.repository';
import { AgentDocument } from '../../schemas/agent.schema';
import { SalesPropertiesRepository } from '../../repos/sales-properties.repository';
import { SalesPropertyDocument } from '../../schemas/sales-property.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class SalesPropertiesService {
  constructor(
    private readonly salesPropertiesRepository: SalesPropertiesRepository,
    private readonly agentsRepository: AgentsRepository,
  ) {}

  async create(
    dto: CreatePropertyDto,
    companyId: string | null,
  ): Promise<SalesPropertyDocument> {
    const agent = await this.assertAgentInCompany(dto.agentId, companyId);
    return this.salesPropertiesRepository.create({
      companyId,
      agentId: agent.agent_id,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
    });
  }

  async findAllByAgent(
    agentId: string,
    companyId: string | null,
  ): Promise<SalesPropertyDocument[]> {
    const agent = await this.assertAgentInCompany(agentId, companyId);
    return this.salesPropertiesRepository.filterByAgentId(agent.agent_id);
  }

  async findById(
    id: string,
    companyId: string | null,
  ): Promise<SalesPropertyDocument> {
    const property = await this.salesPropertiesRepository.filterById(id);
    if (!property) {
      throw new NotFoundException(`Property ${id} not found`);
    }
    assertSameCompany(
      companyId,
      property.companyId,
      `Property ${id} not found`,
    );
    return property;
  }

  async update(
    id: string,
    dto: UpdatePropertyDto,
    companyId: string | null,
  ): Promise<SalesPropertyDocument> {
    await this.findById(id, companyId);
    const updated = await this.salesPropertiesRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && {
        description: dto.description.trim(),
      }),
    });
    if (!updated) {
      throw new NotFoundException(`Property ${id} not found`);
    }
    return updated;
  }

  async delete(id: string, companyId: string | null): Promise<void> {
    await this.findById(id, companyId);
    await this.salesPropertiesRepository.delete(id);
  }

  /**
   * Resolves the agent by its Mongo `_id` (what the UI sends) and checks it
   * belongs to the requester's company. Properties are stored against the
   * returned agent's `agent_id`, since that's the id the agent servers read
   * from `agentDetails` at call time.
   */
  private async assertAgentInCompany(
    agentId: string,
    companyId: string | null,
  ): Promise<AgentDocument> {
    const agent = await this.agentsRepository.filterById(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    assertSameCompany(companyId, agent.companyId, `Agent ${agentId} not found`);
    return agent;
  }
}
