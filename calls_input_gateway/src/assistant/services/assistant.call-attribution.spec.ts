/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { AssistantService } from './assistant.service';

const AGENT = { _id: 'mongo-1', agent_id: 'agent-abc', language: 'en' };

function build(agentByPhone: unknown, agentById: unknown = null) {
  const callLogService = {
    startCallLog: jest.fn().mockResolvedValue(undefined),
  };
  const agentsRepository = {
    filterByPhoneNumber: jest.fn().mockResolvedValue(agentByPhone),
    filterByAgentId: jest.fn().mockResolvedValue(agentById),
    addActiveSession: jest.fn().mockResolvedValue(undefined),
  };
  const sharedAiService = {
    hasValidApiKey: () => true,
    getDefaultConfig: () => ({}),
    parseSetupConfig: (setup: any) => ({ ...setup }),
  };
  const service = new AssistantService(
    sharedAiService as any,
    {} as any,
    {} as any,
    callLogService as any,
    { applyPreferredLanguage: jest.fn() } as any,
    agentsRepository as any,
    {} as any,
    {} as any,
    { set: jest.fn(), get: jest.fn() } as any,
  );
  jest
    .spyOn(service as any, 'processQueryQueue')
    .mockImplementation(() => undefined);
  const client = {};
  service.initializeSession(client);
  return { service, client, callLogService };
}

describe('AssistantService call attribution', () => {
  it('attributes telephony call logs to the agent owning the business number', async () => {
    const { service, client, callLogService } = build(AGENT);

    await service.initiateAgentState(client, {
      provider: 'twilio',
      callId: 'CA123',
      agentNumber: '+15550001',
      agentId: '',
    });

    expect(callLogService.startCallLog).toHaveBeenCalledWith(
      expect.objectContaining({ callId: 'CA123', agentId: 'agent-abc' }),
    );
  });

  it('keeps webrtc attribution to the agent the client named', async () => {
    const { service, client, callLogService } = build(null, AGENT);

    await service.initiateAgentState(client, {
      provider: 'webrtc',
      agentId: 'agent-abc',
    });

    expect(callLogService.startCallLog).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-abc' }),
    );
  });

  it("uses the agent's saved voice over the one the client sent", async () => {
    const { service, client } = build({ ...AGENT, voice: 'male_2' });

    await service.initiateAgentState(client, {
      provider: 'twilio',
      callId: 'CA124',
      agentNumber: '+15550001',
      agentId: '',
      voice: 'Aoede',
    });

    expect((service as any).sessions.get(client).config.voice).toBe('male_2');
  });

  it("falls back to 'unknown' when no agent resolves", async () => {
    const { service, client, callLogService } = build(null);

    await service.initiateAgentState(client, {
      provider: 'twilio',
      callId: 'CA999',
      agentNumber: '+15550009',
      agentId: '',
    });

    expect(callLogService.startCallLog).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'unknown' }),
    );
  });
});
