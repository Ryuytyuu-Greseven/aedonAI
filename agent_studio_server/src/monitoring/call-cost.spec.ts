/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { priceCall, USD_INR } from './call-cost';

const start = new Date('2026-11-02T10:00:00Z');
const end = new Date('2026-11-02T10:02:00Z'); // 2 minutes

const baseLog = {
  _id: 'CA1',
  provider: 'exotel',
  direction: 'outbound',
  status: 'completed',
  customer_details: {},
  phone_number: '+919800000001',
  agent_id: 'agent-abc',
  agent_number: '+918000000000',
  connected_human_agents: [],
  starting_time: start,
  ending_time: end,
  created_at: start,
  updated_at: end,
  usage: {
    stt: [{ provider: 'sarvam', seconds: 120 }],
    tts: [{ provider: 'sarvam', characters: 1000 }],
    llm: [
      {
        model: 'gemini-3.1-flash-lite',
        input_tokens: 40_000,
        output_tokens: 2_000,
        calls: 10,
      },
    ],
    analysis_llm: [
      {
        model: 'gemini-3.1-flash-lite',
        input_tokens: 4_000,
        output_tokens: 400,
        calls: 1,
      },
    ],
  },
} as const;

describe('priceCall', () => {
  it('prices each part of an Exotel call', () => {
    const cost = priceCall(baseLog as any)!;

    expect(cost.telephony).toBeCloseTo((2 * 0.8) / USD_INR, 5); // 2 billed minutes
    expect(cost.stt).toBeCloseTo((120 * 30) / 3600 / USD_INR, 5);
    expect(cost.tts).toBeCloseTo((1000 * 20) / 10_000 / USD_INR, 5);
    expect(cost.llm).toBeCloseTo((40_000 * 0.25 + 2_000 * 1.5) / 1e6, 5);
    expect(cost.analysis).toBeCloseTo((4_000 * 0.25 + 400 * 1.5) / 1e6, 5);
    expect(cost.total).toBeCloseTo(
      cost.telephony + cost.stt + cost.tts + cost.llm + cost.analysis,
      4,
    );
    expect(cost.per_minute).toBeCloseTo(cost.total / 2, 4);
    expect(cost.total_inr).toBeCloseTo(cost.total * USD_INR, 1);
    expect(cost.unpriced).toEqual([]);
  });

  it('bills Twilio outbound by destination, per started minute, plus streaming', () => {
    const cost = priceCall({
      ...baseLog,
      provider: 'twilio',
      phone_number: '+971500000000',
      ending_time: new Date('2026-11-02T10:01:01Z'), // 61s → 2 minutes
      usage: { stt: [], tts: [], llm: [] },
    } as any)!;

    expect(cost.telephony).toBeCloseTo(2 * (0.2995 + 0.004), 5);
  });

  it('charges no carrier for web calls and flags unknown rates', () => {
    const cost = priceCall({
      ...baseLog,
      provider: 'webrtc',
      usage: {
        stt: [{ provider: 'mystery-stt', seconds: 10 }],
        tts: [],
        llm: [
          {
            model: 'some-new-model',
            input_tokens: 1,
            output_tokens: 1,
            calls: 1,
          },
        ],
      },
    } as any)!;

    expect(cost.telephony).toBe(0);
    expect(cost.total).toBe(0);
    expect(cost.unpriced).toEqual(['mystery-stt', 'some-new-model']);
  });

  it('is null until the call has ended with usage recorded', () => {
    expect(priceCall({ ...baseLog, usage: null } as any)).toBeNull();
    expect(priceCall({ ...baseLog, ending_time: null } as any)).toBeNull();
  });
});
