/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {
  manualLeadDay,
  normalizeLeadPhone,
  validateManualLead,
} from '../common/utils/manual-lead.util';
import { ManualLeadsService } from './manual-leads.service';

const row = (phoneNumber: string, fullName = 'Asha', email = 'a@x.in') => ({
  fullName,
  phoneNumber,
  email,
});

function setup(stored: string[] = [], skippedOnInsert: number[] = []) {
  const agents = {
    findById: jest.fn().mockResolvedValue({ _id: 'agent-1' }),
  };
  const repo = {
    findManualPhonesForDay: jest.fn().mockResolvedValue(new Set(stored)),
    insertManual: jest.fn().mockResolvedValue(new Set(skippedOnInsert)),
  };
  const meta = { callManualLead: jest.fn(), dialManualLead: jest.fn() };
  const service = new ManualLeadsService(
    agents as any,
    repo as any,
    meta as any,
  );
  return { service, repo, agents, meta };
}

describe('normalizeLeadPhone', () => {
  it('keeps E.164 and defaults bare 10 digits to +91', () => {
    expect(normalizeLeadPhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizeLeadPhone('98765-43210')).toBe('+919876543210');
    expect(normalizeLeadPhone(9876543210)).toBe('+919876543210');
  });

  it('asks for a country code otherwise', () => {
    expect(normalizeLeadPhone('09876543210')).toBeNull();
    expect(normalizeLeadPhone('919876543210')).toBeNull();
    expect(normalizeLeadPhone('12345')).toBeNull();
  });
});

describe('validateManualLead', () => {
  it('requires name, phone and email for uploads', () => {
    expect(validateManualLead({}).errors).toEqual([
      'Name is required',
      'Phone number is required',
      'Email is required',
    ]);
    expect(validateManualLead(row('9876543210', 'A', 'nope')).errors).toEqual([
      'Email is not valid',
    ]);
  });
});

describe('manualLeadDay', () => {
  it('uses the IST calendar day', () => {
    // 20:00 UTC is already the next day in India.
    expect(manualLeadDay(new Date('2026-10-30T20:00:00Z'))).toBe('2026-10-31');
  });
});

describe('ManualLeadsService.upload', () => {
  it('inserts valid rows and returns rejected ones by index', async () => {
    const { service, repo } = setup();
    const result = await service.upload('agent-1', 'c1', [
      row('9876543210'),
      row('12345'),
      row('+14155550199'),
    ]);

    expect(result.inserted).toBe(2);
    expect(result.rejected).toEqual([
      expect.objectContaining({ index: 1, errors: [expect.any(String)] }),
    ]);
    expect(repo.insertManual).toHaveBeenCalledWith(
      'c1',
      'agent-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      [
        expect.objectContaining({ phoneNumber: '+919876543210' }),
        expect.objectContaining({ phoneNumber: '+14155550199' }),
      ],
    );
  });

  it("accepts but skips today's stored numbers and repeats in the file", async () => {
    const { service, repo } = setup(['+919876543210']);
    const result = await service.upload('agent-1', 'c1', [
      row('9876543210'),
      row('9000000001'),
      row('+919000000001'),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.duplicates).toEqual([
      { index: 0, phoneNumber: '+919876543210' },
      { index: 2, phoneNumber: '+919000000001' },
    ]);
    expect(repo.insertManual.mock.calls[0][3]).toHaveLength(1);
  });

  it('counts unique-index collisions from a concurrent upload as duplicates', async () => {
    const { service } = setup([], [0]);
    const result = await service.upload('agent-1', 'c1', [
      row('9876543210'),
      row('9000000001'),
    ]);
    expect(result.inserted).toBe(1);
    expect(result.duplicates).toEqual([
      { index: 0, phoneNumber: '+919876543210' },
    ]);
  });
});
