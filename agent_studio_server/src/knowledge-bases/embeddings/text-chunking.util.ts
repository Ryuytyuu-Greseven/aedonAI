const DEFAULT_CHUNK_SIZE_WORDS = 1000;
const DEFAULT_CHUNK_OVERLAP_WORDS = 200;

/**
 * Splits text into overlapping fixed-size chunks (measured in words, not
 * characters) so each chunk stays within embedding model input limits while
 * preserving context across boundaries.
 */
export function chunkText(
  text: string,
  chunkSizeWords = DEFAULT_CHUNK_SIZE_WORDS,
  overlapWords = DEFAULT_CHUNK_OVERLAP_WORDS,
): string[] {
  if (overlapWords >= chunkSizeWords) {
    throw new Error(
      'chunkText: overlapWords must be smaller than chunkSizeWords',
    );
  }

  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSizeWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) {
      break;
    }
    start = end - overlapWords;
  }
  return chunks;
}
