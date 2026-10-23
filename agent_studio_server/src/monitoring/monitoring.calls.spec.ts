/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import { toCallSummary, toCallTranscript } from './call-log.mapper';
import { MonitoringService } from './monitoring.service';

const start = new Date('2026-10-21T10:00:00Z');
const end = new Date('2026-10-21T10:03:05Z');

const baseLog = {
  _id: 'CA1',
  provider: 'twilio',
  direction: 'inbound',
  status: 'completed',
  customer_details: { name: '  Ravi ' },
  phone_number: '+919800000001',
  agent_id: 'agent-abc',
  agent_number: '+918872376734',
  connected_human_agents: [],
  starting_time: start,
  ending_time: end,
  created_at: start,
  updated_at: end,
} as const;

describe('call log mapper', () => {
  it('summarises a finished phone call', () => {
    expect(toCallSummary({ ...baseLog, message_count: 4 } as any)).toEqual({
      id: 'CA1',
      agent_id: 'agent-abc',
      provider: 'twilio',
      direction: 'inbound',
      status: 'completed',
      occurred_at: start,
      ended_at: end,
      duration_seconds: 185,
      phone_number: '+919800000001',
      customer_name: 'Ravi',
      message_count: 4,
      summary: null,
    });
  });

  it('has no duration while in progress, and no caller number for web calls', () => {
    const summary = toCallSummary({
      ...baseLog,
      provider: 'webrtc',
      status: 'in_progress',
      ending_time: null,
      customer_details: {},
      message_count: 0,
    } as any);
    expect(summary.duration_seconds).toBeNull();
    expect(summary.phone_number).toBeNull();
    expect(summary.customer_name).toBeNull();
  });

  it('returns the conversation oldest first', () => {
    const transcript = toCallTranscript({
      ...baseLog,
      call_conversation: [
        {
          id: 'm2',
          message: 'Yes, in red.',
          speaker: 'ai_agent',
          timestamp: new Date('2026-10-21T10:00:20Z'),
        },
        {
          id: 'm1',
          message: 'Is the Classic 350 available?',
          speaker: 'customer',
          timestamp: new Date('2026-10-21T10:00:10Z'),
        },
      ],
    } as any);

    expect(transcript.message_count).toBe(2);
    expect(transcript.messages.map((m) => [m.id, m.speaker, m.text])).toEqual([
      ['m1', 'customer', 'Is the Classic 350 available?'],
      ['m2', 'ai_agent', 'Yes, in red.'],
    ]);
  });
});

describe('MonitoringService calls', () => {
  const agentsService = { findById: jest.fn() };
  const repo = {
    listByAgentId: jest.fn(),
    findOneForAgent: jest.fn(),
    filterByAgentIdSince: jest.fn(),
  };
  const service = new MonitoringService(repo as any, agentsService as any);

  beforeEach(() => {
    jest.resetAllMocks();
    agentsService.findById.mockResolvedValue({
      _id: 'mongo-1',
      agent_id: 'agent-abc',
    });
  });

  it("looks calls up by the agent's agent_id, scoped to the caller's company", async () => {
    repo.listByAgentId.mockResolvedValue([]);
    await service.listCallsForAgent('mongo-1', 'co-1');

    expect(agentsService.findById).toHaveBeenCalledWith('mongo-1', 'co-1');
    expect(repo.listByAgentId).toHaveBeenCalledWith('agent-abc');
  });

  it("404s a call that isn't this agent's", async () => {
    repo.findOneForAgent.mockResolvedValue(null);
    await expect(
      service.getCallTranscript('mongo-1', 'CA-other', 'co-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findOneForAgent).toHaveBeenCalledWith('CA-other', 'agent-abc');
  });

  it('counts stats against the same agent_id as the list', async () => {
    repo.filterByAgentIdSince.mockResolvedValue([]);
    const stats = await service.getStatsForAgent('mongo-1', 'co-1');

    expect(repo.filterByAgentIdSince.mock.calls[0][0]).toBe('agent-abc');
    expect(stats.byDay).toHaveLength(14);
  });
});
