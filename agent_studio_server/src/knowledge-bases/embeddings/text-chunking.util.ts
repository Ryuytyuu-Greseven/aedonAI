import { FormattedSalesDocument } from '../sales/real-estate-sales.profile';

const DEFAULT_SINGLE_CHUNK_MAX_WORDS = 350;
const DEFAULT_CHUNK_SIZE_WORDS = 300;
const DEFAULT_CHUNK_OVERLAP_WORDS = 50;

/** Section value for chunks of unformatted (raw fallback) text. */
export const RAW_SECTION = 'raw';

export interface ChunkingOptions {
  /** Text up to this many words stays a single chunk. */
  singleChunkMaxWords?: number;
  /** Target maximum words per chunk when text has to be split. */
  chunkSizeWords?: number;
  /** Words of trailing context repeated at the start of the next chunk. */
  overlapWords?: number;
}

export interface TextChunk {
  /** Formatter section key (e.g. `amenities`), or `raw`. */
  section: string;
  /** Header line + chunk body — what gets embedded and stored. */
  text: string;
}

interface Unit {
  text: string;
  words: number;
  /** What joins this unit to the previous one: paragraph break, list line break, or a space. */
  separator: '\n\n' | '\n' | ' ';
}

const countWords = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

// A line starting with "-", "*", "•" or "1." / "1)" begins a list item.
const LIST_ITEM_START = /\n(?=[ \t]*(?:[-*•]|\d+[.)])\s)/;

/**
 * Splits text into sentence-sized units, remembering paragraph and list-item
 * starts so they survive chunking. A sentence longer than `maxWords` (e.g. a
 * long run-on line) is hard-split by words, since it can't fit otherwise.
 */
function toUnits(text: string, maxWords: number): Unit[] {
  const units: Unit[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    paragraph.split(LIST_ITEM_START).forEach((line, lineIndex) => {
      const sentences = line
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      sentences.forEach((sentence, sentenceIndex) => {
        const words = sentence.split(/\s+/);
        for (let i = 0; i < words.length; i += maxWords) {
          const piece = words.slice(i, i + maxWords);
          const startsLine = sentenceIndex === 0 && i === 0;
          units.push({
            text: piece.join(' '),
            words: piece.length,
            separator: !startsLine ? ' ' : lineIndex === 0 ? '\n\n' : '\n',
          });
        }
      });
    });
  }
  return units;
}

function joinUnits(units: Unit[]): string {
  return units
    .map((unit, index) => (index === 0 ? unit.text : `${unit.separator}${unit.text}`))
    .join('');
}

/**
 * Splits text into chunks aligned to paragraph/sentence boundaries. Short
 * text stays one chunk; longer text is packed into ~`chunkSizeWords` chunks,
 * each starting with the previous chunk's trailing sentences (up to
 * `overlapWords`) so an answer spanning a boundary still lands whole in one.
 */
export function splitText(
  text: string,
  {
    singleChunkMaxWords = DEFAULT_SINGLE_CHUNK_MAX_WORDS,
    chunkSizeWords = DEFAULT_CHUNK_SIZE_WORDS,
    overlapWords = DEFAULT_CHUNK_OVERLAP_WORDS,
  }: ChunkingOptions = {},
): string[] {
  if (overlapWords >= chunkSizeWords) {
    throw new Error(
      'splitText: overlapWords must be smaller than chunkSizeWords',
    );
  }

  const units = toUnits(text, chunkSizeWords);
  if (units.length === 0) {
    return [];
  }
  if (countWords(text) <= singleChunkMaxWords) {
    return [joinUnits(units)];
  }

  const chunks: string[] = [];
  let current: Unit[] = [];
  let currentWords = 0;
  // Units carried over from the previous chunk as overlap; a chunk made
  // only of overlap is never emitted.
  let overlapCount = 0;

  for (const unit of units) {
    if (currentWords + unit.words > chunkSizeWords && current.length > overlapCount) {
      chunks.push(joinUnits(current));
      const overlap: Unit[] = [];
      let overlapTotal = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        if (overlapTotal + current[i].words > overlapWords) break;
        overlap.unshift(current[i]);
        overlapTotal += current[i].words;
      }
      // Overlap must leave room for the next unit.
      while (overlap.length > 0 && overlapTotal + unit.words > chunkSizeWords) {
        overlapTotal -= overlap.shift()!.words;
      }
      current = overlap;
      currentWords = overlapTotal;
      overlapCount = overlap.length;
    }
    current.push(unit);
    currentWords += unit.words;
  }
  if (current.length > overlapCount) {
    chunks.push(joinUnits(current));
  }
  return chunks;
}

/**
 * The context line every chunk starts with, so the chunk's vector carries
 * which project/source/section it's about even when its body never names
 * them (e.g. an amenities list). Unknown parts are omitted.
 */
export function buildChunkHeader(parts: {
  subject?: string | null;
  source?: string | null;
  section?: string | null;
}): string {
  return [
    parts.subject && `Subject: ${parts.subject}`,
    parts.source && `Source: ${parts.source}`,
    parts.section && `Section: ${parts.section}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Turns a source's content into headed chunks: one set per formatted
 * section (a chunk never spans two sections), or, when formatting fell
 * back (`formatted` is null), the raw text split the same way.
 */
export function buildChunks(
  formatted: FormattedSalesDocument | null,
  rawText: string,
  sourceLabel: string,
  options?: ChunkingOptions,
): TextChunk[] {
  const withHeader = (header: string, body: string) =>
    header ? `${header}\n${body}` : body;

  if (!formatted) {
    const header = buildChunkHeader({ source: sourceLabel });
    return splitText(rawText, options).map((body) => ({
      section: RAW_SECTION,
      text: withHeader(header, body),
    }));
  }

  return formatted.sections.flatMap(({ key, heading, text }) => {
    const header = buildChunkHeader({
      subject: formatted.subjectName,
      source: sourceLabel,
      section: heading,
    });
    return splitText(text, options).map((body) => ({
      section: key,
      text: withHeader(header, body),
    }));
  });
}
