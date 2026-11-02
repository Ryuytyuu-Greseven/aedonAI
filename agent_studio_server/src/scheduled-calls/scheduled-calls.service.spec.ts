/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ScheduledCallsService } from './scheduled-calls.service';

function setup(callSettings?: Record<string, unknown>) {
  const agents = {
    findById: jest.fn().mockResolvedValue({
      _id: 'agent-1',
      toObject: () => ({ call_settings: callSettings }),
    }),
  };
  const due = new Date('2026-10-31T03:30:00Z');
  const scheduled = {
    findForAgent: jest.fn().mockResolvedValue({
      items: [
        {
          _id: 'j1',
          leadSource: 'meta',
          leadKey: 'lg-1',
          phoneNumber: '+919000000001',
          reason: 'missed_retry',
          attempt: 1,
          dueAt: due,
          status: 'pending',
        },
        {
          _id: 'j2',
          leadSource: 'manual',
          leadKey: 'ml-1',
          phoneNumber: '+919000000002',
          reason: 'missed_retry',
          attempt: 2,
          dueAt: due,
          status: 'pending',
        },
      ],
      total: 2,
    }),
  };
  const metaLeads = {
    findNamesByLeadgenIds: jest
      .fn()
      .mockResolvedValue(new Map([['lg-1', 'Asha']])),
  };
  const agentLeads = {
    findNamesByLeadIds: jest
      .fn()
      .mockResolvedValue(new Map([['ml-1', 'Ravi']])),
  };
  const service = new ScheduledCallsService(
    agents as any,
    scheduled as any,
    metaLeads as any,
    agentLeads as any,
    {} as any,
  );
  return { service, scheduled, metaLeads, agentLeads };
}

describe('ScheduledCallsService.list', () => {
  it("names each call's lead from its own collection", async () => {
    const { service, metaLeads, agentLeads } = setup({
      timezone: 'America/New_York',
      missed_call_retries: 4,
    });
    const result = await service.list('agent-1', 'c1', {});

    expect(metaLeads.findNamesByLeadgenIds).toHaveBeenCalledWith('c1', [
      'lg-1',
    ]);
    expect(agentLeads.findNamesByLeadIds).toHaveBeenCalledWith('c1', ['ml-1']);
    expect(result.calls.map((c) => [c.id, c.leadName, c.attempt])).toEqual([
      ['j1', 'Asha', 1],
      ['j2', 'Ravi', 2],
    ]);
    expect(result).toMatchObject({
      total: 2,
      timezone: 'America/New_York',
      maxRetries: 4,
    });
  });

  it('defaults the zone and retries for agents without call settings', async () => {
    const { service, scheduled } = setup();
    const result = await service.list('agent-1', 'c1', { view: 'past' });
    expect(scheduled.findForAgent).toHaveBeenCalledWith(
      'c1',
      'agent-1',
      'past',
      1,
      20,
    );
    expect(result).toMatchObject({ timezone: 'Asia/Kolkata', maxRetries: 0 });
  });
});
