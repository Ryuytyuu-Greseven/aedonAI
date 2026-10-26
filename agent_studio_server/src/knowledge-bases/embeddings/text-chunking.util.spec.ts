import {
  buildChunkHeader,
  buildChunks,
  RAW_SECTION,
  splitText,
} from './text-chunking.util';

const words = (n: number, word = 'word') =>
  Array.from({ length: n }, () => word).join(' ');
/** A sentence of exactly `n` words ending in a full stop. */
const sentence = (n: number, word = 'word') => `${words(n - 1, word)} end.`;
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

describe('splitText', () => {
  it('keeps short text as a single chunk, preserving paragraphs', () => {
    const text = `${sentence(10)}\n\n${sentence(10)}`;
    expect(splitText(text)).toEqual([text]);
  });

  it('keeps one list item per line', () => {
    const text =
      'Hospitals nearby:\n- Apollo Hospitals: 4 km\n- KGH:   5 km\n* CARE Hospitals: 4.5 km\n1. Medicover: 3 km';
    expect(splitText(text)).toEqual([
      'Hospitals nearby:\n- Apollo Hospitals: 4 km\n- KGH: 5 km\n* CARE Hospitals: 4.5 km\n1. Medicover: 3 km',
    ]);
  });

  it('returns nothing for blank text', () => {
    expect(splitText('  \n\n ')).toEqual([]);
  });

  it('splits long text on sentence boundaries within the size limit', () => {
    const text = Array.from({ length: 30 }, () => sentence(30)).join(' ');
    const chunks = splitText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(wordCount(chunk)).toBeLessThanOrEqual(300);
      expect(chunk.endsWith('end.')).toBe(true);
    }
  });

  it('repeats trailing sentences of the previous chunk as overlap', () => {
    const sentences = Array.from({ length: 30 }, (_, i) =>
      sentence(30, `s${i}`),
    );
    const chunks = splitText(sentences.join(' '));
    const lastOfFirst = chunks[0].split(/(?<=\.)\s+/).pop()!;

    expect(chunks[1].startsWith(lastOfFirst)).toBe(true);
  });

  it('covers every sentence at least once', () => {
    const sentences = Array.from({ length: 40 }, (_, i) =>
      sentence(25, `s${i}`),
    );
    const joined = splitText(sentences.join('\n\n')).join(' ');

    for (const s of sentences) {
      expect(joined).toContain(s);
    }
  });

  it('hard-splits a single sentence longer than the chunk size', () => {
    const chunks = splitText(words(1000));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(wordCount(chunk)).toBeLessThanOrEqual(300);
    }
  });
});

describe('buildChunkHeader', () => {
  it('includes every known part', () => {
    expect(
      buildChunkHeader({
        subject: 'The Sky View Grand',
        source: 'skyview-brochure.pdf',
        section: 'Amenities',
      }),
    ).toBe(
      'Subject: The Sky View Grand | Source: skyview-brochure.pdf | Section: Amenities',
    );
  });

  it('omits unknown parts', () => {
    expect(
      buildChunkHeader({ subject: null, source: 'site', section: 'Amenities' }),
    ).toBe('Source: site | Section: Amenities');
  });
});

describe('buildChunks', () => {
  it('produces one headed chunk per short section', () => {
    const chunks = buildChunks(
      {
        subjectName: 'The Sky View Grand',
        sections: [
          { key: 'amenities', heading: 'Amenities', text: sentence(120) },
          {
            key: 'locationConnectivity',
            heading: 'Location & Connectivity',
            text: sentence(80),
          },
        ],
      },
      'ignored raw text',
      'skyview-brochure.pdf',
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0].section).toBe('amenities');
    expect(chunks[0].text).toBe(
      `Subject: The Sky View Grand | Source: skyview-brochure.pdf | Section: Amenities\n${sentence(120)}`,
    );
    expect(chunks[1].section).toBe('locationConnectivity');
  });

  it('never mixes two sections in one chunk', () => {
    const chunks = buildChunks(
      {
        subjectName: null,
        sections: [
          {
            key: 'propertyDetails',
            heading: 'Property Details',
            text: Array.from({ length: 30 }, () => sentence(30, 'detail')).join(
              ' ',
            ),
          },
          { key: 'amenities', heading: 'Amenities', text: sentence(20, 'pool') },
        ],
      },
      '',
      'brochure.pdf',
    );

    const details = chunks.filter((c) => c.section === 'propertyDetails');
    expect(details.length).toBeGreaterThan(1);
    expect(details.every((c) => !c.text.includes('pool'))).toBe(true);
    expect(chunks.at(-1)).toEqual({
      section: 'amenities',
      text: `Source: brochure.pdf | Section: Amenities\n${sentence(20, 'pool')}`,
    });
  });

  it('chunks raw text with a source-only header when formatting fell back', () => {
    const chunks = buildChunks(null, sentence(40), 'https://example.com');

    expect(chunks).toEqual([
      {
        section: RAW_SECTION,
        text: `Source: https://example.com\n${sentence(40)}`,
      },
    ]);
  });
});
