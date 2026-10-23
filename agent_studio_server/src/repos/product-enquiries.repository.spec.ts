/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { buildProductStatsPipeline } from './product-enquiries.repository';

const base = {
  agentId: 'agent-1',
  from: new Date('2026-10-01T00:00:00Z'),
  to: new Date('2026-10-14T23:59:59Z'),
  sort: 'enquiries' as const,
  order: 'desc' as const,
  page: 2,
  limit: 10,
};

function stage<T = any>(pipeline: any[], key: string): T {
  return pipeline.find((s) => key in s)[key];
}

describe('buildProductStatsPipeline', () => {
  it('starts from the agent products so zero-enquiry products are kept', () => {
    const pipeline = buildProductStatsPipeline(base);
    expect(stage(pipeline, '$match')).toEqual({ agentId: 'agent-1' });
    expect('$match' in pipeline[0]).toBe(true);
    // $lookup (not $unwind) keeps products whose events array is empty.
    expect(pipeline.some((s) => '$unwind' in s)).toBe(false);
  });

  it('only counts live-channel events inside the date range', () => {
    const lookup = stage(buildProductStatsPipeline(base), '$lookup');
    expect(lookup.pipeline[0].$match).toMatchObject({
      agentId: 'agent-1',
      channel: 'live',
      at: { $gte: base.from, $lte: base.to },
    });
  });

  it('escapes regex characters in the search term', () => {
    const match = stage<{ name: RegExp }>(
      buildProductStatsPipeline({ ...base, search: ' Pro (150) ' }),
      '$match',
    );
    expect(match.name.source).toBe('Pro \\(150\\)');
    expect(match.name.flags).toContain('i');
    expect(match.name.test('pro (150) deluxe')).toBe(true);
  });

  it('ignores a blank search', () => {
    const match = stage(
      buildProductStatsPipeline({ ...base, search: '   ' }),
      '$match',
    );
    expect(match).not.toHaveProperty('name');
  });

  it('sorts by the metric with a name tie-break and paginates', () => {
    const items = stage(buildProductStatsPipeline(base), '$facet').items;
    expect(items[0]).toEqual({
      $sort: { enquiries: -1, nameLower: 1, _id: 1 },
    });
    expect(items[1]).toEqual({ $skip: 10 });
    expect(items[2]).toEqual({ $limit: 10 });
  });

  it('sorts by name case-insensitively', () => {
    const items = stage(
      buildProductStatsPipeline({ ...base, sort: 'name', order: 'asc' }),
      '$facet',
    ).items;
    expect(items[0]).toEqual({ $sort: { nameLower: 1, _id: 1 } });
  });

  it('counts distinct conversations per stage', () => {
    const project = stage(buildProductStatsPipeline(base), '$project');
    expect(project.enquiries).toEqual({
      $size: { $setUnion: ['$events.conversationId', []] },
    });
    const filter = project.purchaseIntent.$size.$setUnion[0].$map.input.$filter;
    expect(filter.cond).toEqual({ $eq: ['$$e.stage', 'purchase_intent'] });
  });
});
