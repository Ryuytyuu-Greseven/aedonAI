/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { AgentsService } from './agents.service';

function setup(callSettings?: Record<string, unknown>) {
  const agent = {
    _id: 'a1',
    companyId: 'c1',
    status: 'live',
    toObject: () => ({ call_settings: callSettings }),
  };
  const agentsRepository = {
    filterById: jest.fn().mockResolvedValue(agent),
    update: jest
      .fn()
      .mockImplementation((_id, patch) => ({ ...agent, ...patch })),
  };
  const service = new AgentsService(
    agentsRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, agentsRepository };
}

describe('AgentsService.updateCallSettings', () => {
  it('fills defaults, applies the change and leaves the status alone', async () => {
    const { service, agentsRepository } = setup();
    await service.updateCallSettings('a1', { missed_call_retries: 4 }, 'c1');

    expect(agentsRepository.update).toHaveBeenCalledWith('a1', {
      call_settings: {
        timezone: 'Asia/Kolkata',
        calling_hours_start: '09:00',
        calling_hours_end: '18:00',
        missed_call_retries: 4,
        missed_call_retry_gap_minutes: 360,
      },
    });
    expect(agentsRepository.update.mock.calls[0][1]).not.toHaveProperty(
      'status',
    );
  });

  it('keeps stored values for fields not sent', async () => {
    const { service, agentsRepository } = setup({
      timezone: 'America/New_York',
      calling_hours_start: '10:00',
      calling_hours_end: '17:00',
      missed_call_retries: 2,
      missed_call_retry_gap_minutes: 120,
    });
    await service.updateCallSettings(
      'a1',
      { calling_hours_end: '19:30' },
      'c1',
    );

    expect(agentsRepository.update.mock.calls[0][1].call_settings).toEqual({
      timezone: 'America/New_York',
      calling_hours_start: '10:00',
      calling_hours_end: '19:30',
      missed_call_retries: 2,
      missed_call_retry_gap_minutes: 120,
    });
  });

  it('rejects calling hours that end before they start', async () => {
    const { service, agentsRepository } = setup();
    await expect(
      service.updateCallSettings(
        'a1',
        { calling_hours_start: '18:00', calling_hours_end: '09:00' },
        'c1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(agentsRepository.update).not.toHaveBeenCalled();
  });
});
