/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AgentsService } from './agents.service';

const AGENT_DOC_ID = 'agent-doc-1';
const NUMBER_ID = '6650a1b2c3d4e5f601234567';

const config = { greeting: 'Hi', behavior_prompt: 'Sell', behavior_notes: '' };
const previewHash = createHash('sha256')
  .update(JSON.stringify(config))
  .digest('hex');

const stagedAgent = {
  _id: AGENT_DOC_ID,
  agent_id: 'agent-uuid-1',
  companyId: 'c1',
  agent_name: 'Sales',
  country_code: '+91',
  status: 'staged',
  current_stage_version: 2,
  preview_hash: previewHash,
  ...config,
};

const productionNumber = {
  companyId: 'c1',
  status: 'Available',
  envType: 'production',
  assigned_agent: null,
  e164: '+918047112233',
  country_code: '+91',
  phone_number: '8047112233',
};

function setup() {
  const agentsRepository = {
    filterById: jest.fn().mockResolvedValue(stagedAgent),
    update: jest.fn().mockResolvedValue({ ...stagedAgent, status: 'live' }),
  };
  const liveAgentsRepository = {
    filterByAgentId: jest.fn().mockResolvedValue(null),
    publishByAgentId: jest.fn().mockResolvedValue({}),
  };
  const agentHistoriesRepository = {
    existsBySourceAgentIdAndStageVersion: jest.fn().mockResolvedValue(true),
    filterBySourceAgentIdAndStageVersion: jest
      .fn()
      .mockResolvedValue({ _id: 'hist-1' }),
  };
  const phoneNumbersRepository = {
    filterById: jest.fn().mockResolvedValue(productionNumber),
    claimForAgent: jest
      .fn()
      .mockResolvedValue({ ...productionNumber, assigned_agent: AGENT_DOC_ID }),
    unassignFromAgent: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AgentsService(
    agentsRepository as any,
    liveAgentsRepository as any,
    agentHistoriesRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    phoneNumbersRepository as any,
  );
  return {
    service,
    agentsRepository,
    liveAgentsRepository,
    phoneNumbersRepository,
  };
}

const goLive = (service: AgentsService) =>
  service.moveToLive(AGENT_DOC_ID, { phone_number_id: NUMBER_ID }, 'c1');

describe('AgentsService.moveToLive phone number', () => {
  it('claims the number and publishes its id and E.164', async () => {
    const { service, liveAgentsRepository, phoneNumbersRepository } = setup();
    await goLive(service);

    expect(phoneNumbersRepository.claimForAgent).toHaveBeenCalledWith(
      NUMBER_ID,
      AGENT_DOC_ID,
    );
    expect(liveAgentsRepository.publishByAgentId).toHaveBeenCalledWith(
      'agent-uuid-1',
      expect.objectContaining({
        phone_number: '+918047112233',
        phone_number_id: NUMBER_ID,
      }),
      undefined,
    );
  });

  it.each([
    ['assigned to another agent', { assigned_agent: 'other-agent' }],
    ['a staging number', { envType: 'staging' }],
    ['disabled', { status: 'Disabled' }],
    ['released', { status: 'Released' }],
  ])('rejects a number that is %s', async (_label, override) => {
    const { service, phoneNumbersRepository, liveAgentsRepository } = setup();
    phoneNumbersRepository.filterById.mockResolvedValue({
      ...productionNumber,
      ...override,
    });
    await expect(goLive(service)).rejects.toBeInstanceOf(ConflictException);
    expect(phoneNumbersRepository.claimForAgent).not.toHaveBeenCalled();
    expect(liveAgentsRepository.publishByAgentId).not.toHaveBeenCalled();
  });

  it("hides another company's number", async () => {
    const { service, phoneNumbersRepository } = setup();
    phoneNumbersRepository.filterById.mockResolvedValue({
      ...productionNumber,
      companyId: 'c2',
    });
    await expect(goLive(service)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the agent keep the number it is already live on', async () => {
    const { service, phoneNumbersRepository } = setup();
    phoneNumbersRepository.filterById.mockResolvedValue({
      ...productionNumber,
      assigned_agent: AGENT_DOC_ID,
    });
    await expect(goLive(service)).resolves.toBeDefined();
  });

  it('fails when another agent claimed the number first', async () => {
    const { service, phoneNumbersRepository, liveAgentsRepository } = setup();
    phoneNumbersRepository.claimForAgent.mockResolvedValue(null);
    await expect(goLive(service)).rejects.toBeInstanceOf(ConflictException);
    expect(liveAgentsRepository.publishByAgentId).not.toHaveBeenCalled();
  });

  it('frees a newly claimed number when publishing fails', async () => {
    const { service, phoneNumbersRepository, liveAgentsRepository } = setup();
    liveAgentsRepository.publishByAgentId.mockRejectedValue(new Error('db'));
    await expect(goLive(service)).rejects.toThrow('db');
    expect(phoneNumbersRepository.unassignFromAgent).toHaveBeenCalledWith(
      NUMBER_ID,
      AGENT_DOC_ID,
    );
  });

  it('frees the previous production number when switching numbers', async () => {
    const { service, phoneNumbersRepository, liveAgentsRepository } = setup();
    liveAgentsRepository.filterByAgentId.mockResolvedValue({
      agent_id: 'agent-uuid-1',
      stage_version: 1,
      phone_number_id: 'old-number-id',
    });
    await goLive(service);
    expect(phoneNumbersRepository.unassignFromAgent).toHaveBeenCalledWith(
      'old-number-id',
      AGENT_DOC_ID,
    );
  });
});
