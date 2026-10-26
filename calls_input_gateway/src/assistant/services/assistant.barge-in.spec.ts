/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { AssistantService } from './assistant.service';

function build() {
  const service = new AssistantService(
    {
      hasValidApiKey: () => true,
      getDefaultConfig: () => ({ business: 'real_estate_sales' }),
    } as any,
    {} as any,
    { saveMessage: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { set: jest.fn(), get: jest.fn() } as any,
  );
  const processQueryQueue = jest
    .spyOn(service as any, 'processQueryQueue')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as any, 'updateSessionCurrentLanguage')
    .mockImplementation(() => undefined);
  const client = { readyState: 1, send: jest.fn() };
  service.initializeSession(client);
  const session = (service as any).sessions.get(client);
  const abortTts = jest.fn();
  // A turn in progress that has spoken only a filler so far.
  Object.assign(session, { isGenerating: true, fillerOnly: true, abortTts });
  return { service, client, session, abortTts, processQueryQueue };
}

describe('AssistantService barge-in during a filler', () => {
  it('lets the reply play when the caller just says "okay"', () => {
    const { service, client, session, abortTts, processQueryQueue } = build();

    service.handleBargeIn(client, 'okay');
    service.onTranscriptReady(client, 'Okay.', 'en');

    expect(abortTts).not.toHaveBeenCalled();
    expect(session.isGenerating).toBe(true);
    expect(session.queryQueue).toEqual([]);
    expect(processQueryQueue).not.toHaveBeenCalled();
  });

  it('interrupts late when the acknowledgement turns into a question', () => {
    const { service, client, session, abortTts } = build();

    service.handleBargeIn(client, 'okay');
    expect(abortTts).not.toHaveBeenCalled();

    service.onTranscriptReady(client, 'okay so what about the price', 'en');
    expect(abortTts).toHaveBeenCalled();
    expect(session.turnInterrupted).toBe(true);
    expect(session.queryQueue).toEqual(['okay so what about the price']);
  });

  it('interrupts immediately on a real question', () => {
    const { service, client, session, abortTts } = build();

    service.handleBargeIn(client, 'what about the price');

    expect(abortTts).toHaveBeenCalled();
    expect(session.isGenerating).toBe(false);
  });

  it('waits for the words when the STT gives none (Sarvam)', () => {
    const { service, client, abortTts } = build();

    service.handleBargeIn(client);
    expect(abortTts).not.toHaveBeenCalled();

    service.onTranscriptReady(client, 'is there parking', 'en');
    expect(abortTts).toHaveBeenCalled();
  });

  it('interrupts as before once the real reply has started', () => {
    const { service, client, session, abortTts } = build();
    session.fillerOnly = false;

    service.handleBargeIn(client, 'okay');

    expect(abortTts).toHaveBeenCalled();
  });
});
