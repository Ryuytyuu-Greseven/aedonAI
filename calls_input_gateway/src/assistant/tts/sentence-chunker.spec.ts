/* eslint-disable @typescript-eslint/require-await */
import { splitIntoSentences } from './sentence-chunker';

async function* chunks(...parts: string[]) {
  for (const text of parts) yield { text };
}

async function collect(
  source: AsyncIterable<{ text?: string }>,
  isActive: () => boolean = () => true,
): Promise<string[]> {
  const out: string[] = [];
  for await (const sentence of splitIntoSentences(source, isActive)) {
    out.push(sentence);
  }
  return out;
}

describe('splitIntoSentences', () => {
  it('cuts at sentence ends across chunk boundaries and flushes the remainder', async () => {
    expect(
      await collect(chunks('Hello the', 're! Is it', ' red? Yes', ' it is')),
    ).toEqual(['Hello there!', 'Is it red?', 'Yes it is']);
  });

  it('strips a leading [lang]: tag', async () => {
    expect(await collect(chunks('[te]: నమస్కారం. ', 'మరి?'))).toEqual([
      'నమస్కారం.',
      'మరి?',
    ]);
  });

  it('breaks long clauses at a comma once the buffer is long enough', async () => {
    const long =
      'The Classic 350 comes in five colours including red and black, and the on-road price is about two lakh';
    const [first] = await collect(chunks(long));
    expect(first.endsWith(',')).toBe(true);
  });

  it('stops as soon as the turn is interrupted', async () => {
    let active = true;
    const out: string[] = [];
    for await (const sentence of splitIntoSentences(
      chunks('One. ', 'Two. ', 'Three.'),
      () => active,
    )) {
      out.push(sentence);
      active = false;
    }
    expect(out).toEqual(['One.']);
  });

  it('reports each source chunk before sentences complete', async () => {
    const onChunk = jest.fn();
    const gen = splitIntoSentences(chunks('Hel', 'lo.'), () => true, onChunk);
    const first = await gen.next();
    expect(first.value).toBe('Hello.');
    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it('speaks a short filler immediately, before the reply arrives', async () => {
    async function* source() {
      yield { text: 'Just a moment.', filler: true };
      yield { text: 'The pool is 25 m long. It has a deck.' };
    }
    const gen = splitIntoSentences(source(), () => true);
    expect((await gen.next()).value).toBe('Just a moment.');
    expect((await gen.next()).value).toBe('The pool is 25 m long.');
    expect((await gen.next()).value).toBe('It has a deck.');
  });

  it('yields a filler whole even without punctuation, flushing buffered text first', async () => {
    async function* source() {
      yield { text: 'Partial reply' };
      yield { text: 'ఒక్క క్షణం', filler: true };
      yield { text: ' rest.' };
    }
    expect(await collect(source())).toEqual([
      'Partial reply',
      'ఒక్క క్షణం',
      'rest.',
    ]);
  });

  it('keeps an ellipsis or ?! run with its sentence instead of yielding bare dots', async () => {
    expect(
      await collect(chunks('అయ్యో, పాపం... ఏమైంది?', '! చెప్పు…', ' వింటున్నా.')),
    ).toEqual(['అయ్యో, పాపం...', 'ఏమైంది?!', 'చెప్పు…', 'వింటున్నా.']);
  });

  it('holds a trailing dot until the next chunk shows whether it is an ellipsis', async () => {
    expect(await collect(chunks('హ్మ్.', '.. సరే.'))).toEqual(['హ్మ్...', 'సరే.']);
  });

  it('never yields a fragment with nothing speakable in it', async () => {
    async function* source() {
      yield { text: '...', filler: true };
      yield { text: 'సరే. . ! ' };
      yield { text: '😂' };
    }
    expect(await collect(source())).toEqual(['సరే.']);
  });
});
