import { resolveChannel } from './agent-router.service';
import { UserConfig } from '../types/assistant.types';

const config = (overrides: Partial<UserConfig>): UserConfig => ({
  model: 'm',
  voice: 'v',
  systemInstruction: '',
  agentId: 'a',
  ...overrides,
});

describe('resolveChannel', () => {
  it('treats webrtc sessions (and the default provider) as previews', () => {
    expect(resolveChannel(config({ provider: 'webrtc' }))).toBe('preview');
    expect(resolveChannel(config({}))).toBe('preview');
  });

  it('treats telephony as live unless tagged as a preview', () => {
    expect(resolveChannel(config({ provider: 'twilio' }))).toBe('live');
    expect(resolveChannel(config({ provider: 'exotel' }))).toBe('live');
    expect(
      resolveChannel(config({ provider: 'twilio', channel: 'preview' })),
    ).toBe('preview');
  });
});
