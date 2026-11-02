/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgentsService } from './agents.service';
import { ListProductStatsQueryDto } from './dto/list-product-stats-query.dto';

describe('AgentsService.productStats', () => {
  const agentsRepository = { filterById: jest.fn() };
  const productEnquiriesRepository = { aggregateStatsForAgent: jest.fn() };
  const service = new AgentsService(
    agentsRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    productEnquiriesRepository as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    agentsRepository.filterById.mockResolvedValue({
      _id: 'agent-1',
      agent_id: 'agent-uuid-1',
      companyId: 'co-1',
    });
    productEnquiriesRepository.aggregateStatsForAgent.mockResolvedValue({
      items: [],
      total: 0,
    });
  });

  it('defaults to the last 14 days, enquiries desc, page 1 of 20', async () => {
    const before = Date.now();
    const result = await service.productStats('agent-1', 'co-1', {});
    const params =
      productEnquiriesRepository.aggregateStatsForAgent.mock.calls[0][0];

    expect(params).toMatchObject({
      agentId: 'agent-uuid-1',
      sort: 'enquiries',
      order: 'desc',
      page: 1,
      limit: 20,
    });
    expect(params.to.getTime()).toBeGreaterThanOrEqual(before);
    expect(params.to.getTime() - params.from.getTime()).toBe(14 * 86_400_000);
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it('passes an explicit range, search, sort and page through', async () => {
    await service.productStats('agent-1', 'co-1', {
      fromDate: '2026-10-01',
      toDate: '2026-10-07',
      search: 'pro',
      sort: 'purchaseIntent',
      order: 'asc',
      page: 3,
      limit: 5,
    });
    expect(
      productEnquiriesRepository.aggregateStatsForAgent,
    ).toHaveBeenCalledWith({
      agentId: 'agent-uuid-1',
      from: new Date('2026-10-01'),
      to: new Date('2026-10-07'),
      search: 'pro',
      sort: 'purchaseIntent',
      order: 'asc',
      page: 3,
      limit: 5,
    });
  });

  it('404s for an agent in another company', async () => {
    await expect(
      service.productStats('agent-1', 'co-2', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      productEnquiriesRepository.aggregateStatsForAgent,
    ).not.toHaveBeenCalled();
  });

  it('rejects a range that ends before it starts', async () => {
    await expect(
      service.productStats('agent-1', 'co-1', {
        fromDate: '2026-10-10',
        toDate: '2026-10-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ListProductStatsQueryDto', () => {
  const errorsFor = (query: Record<string, unknown>) =>
    validate(plainToInstance(ListProductStatsQueryDto, query));

  it('accepts whitelisted sort keys and coerces paging', async () => {
    const dto = plainToInstance(ListProductStatsQueryDto, {
      sort: 'conversionRate',
      order: 'asc',
      page: '2',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
  });

  it('rejects an unsupported sort key', async () => {
    const errors = await errorsFor({ sort: 'description' });
    expect(errors.map((e) => e.property)).toEqual(['sort']);
  });

  it('rejects an out-of-range limit', async () => {
    const errors = await errorsFor({ limit: '500' });
    expect(errors.map((e) => e.property)).toEqual(['limit']);
  });
});
