/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { AgentsService } from './agents.service';

describe('AgentsService knowledge base linking', () => {
  const agentsRepository = {
    create: jest.fn(),
    filterById: jest.fn(),
    update: jest.fn(),
  };
  const knowledgeBasesRepository = { countByIds: jest.fn() };
  const service = new AgentsService(
    agentsRepository as any,
    {} as any,
    {} as any,
    knowledgeBasesRepository as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const dto = {
    agent_name: 'Sales',
    language: 'en',
    country_code: '+91',
    knowledge_base_ids: ['kb-a', 'kb-a', 'kb-b'],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    agentsRepository.create.mockImplementation((data) => Promise.resolve(data));
  });

  it('accepts knowledge bases of the caller’s own company', async () => {
    knowledgeBasesRepository.countByIds.mockResolvedValue(2);

    const agent = await service.create(dto as any, 'co-a');

    expect(knowledgeBasesRepository.countByIds).toHaveBeenCalledWith(
      ['kb-a', 'kb-b'],
      'co-a',
    );
    expect(agent.knowledge_base_ids).toEqual(['kb-a', 'kb-b']);
  });

  it('rejects a knowledge base owned by another company', async () => {
    // kb-b belongs to another company, so only kb-a counts.
    knowledgeBasesRepository.countByIds.mockResolvedValue(1);

    await expect(service.create(dto as any, 'co-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(agentsRepository.create).not.toHaveBeenCalled();
  });

  it('scopes an agent without a company to company-less knowledge bases', async () => {
    knowledgeBasesRepository.countByIds.mockResolvedValue(0);

    await expect(service.create(dto as any, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(knowledgeBasesRepository.countByIds).toHaveBeenCalledWith(
      ['kb-a', 'kb-b'],
      null,
    );
  });
});
