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
});
