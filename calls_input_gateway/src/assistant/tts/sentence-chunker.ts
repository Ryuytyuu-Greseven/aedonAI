const MAX_BUFFER_CHARS = 100;

/**
 * Where to cut the buffered LLM text into something speakable: the first
 * sentence end, a clause break once the buffer is long enough, or a word
 * boundary near MAX_BUFFER_CHARS so a run-on reply still starts speaking.
 */
export function findFlushBoundary(buffer: string): number {
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') return i;
    if (buffer.length >= 60 && (ch === ',' || ch === ';' || ch === ':')) {
      return i;
    }
  }
  if (buffer.length >= MAX_BUFFER_CHARS) {
    const space = buffer.lastIndexOf(' ', MAX_BUFFER_CHARS);
    return space > 0 ? space : MAX_BUFFER_CHARS - 1;
  }
  return -1;
}

/**
 * Re-chunks a streamed LLM reply into sentences for TTS. Strips a leading
 * `[lang]:` tag if the agent emits one. Stops (and closes the source) as soon
 * as `isActive()` turns false — i.e. on barge-in.
 *
 * `onChunk` fires for every source chunk, before any sentence is complete, so
 * a TTS provider can start connecting while the first sentence is still
 * being generated.
 */
export async function* splitIntoSentences(
  textStream: AsyncIterable<{ text?: string }>,
  isActive: () => boolean,
  onChunk?: () => void,
): AsyncGenerator<string> {
  let buffer = '';
  let prefixHandled = false;

  for await (const chunk of textStream) {
    if (!isActive()) return;
    onChunk?.();
    buffer += chunk.text || '';

    if (!prefixHandled) {
      if (buffer.includes(']:')) {
        buffer = buffer.substring(buffer.indexOf(']:') + 2);
        prefixHandled = true;
      } else if (buffer.length > 20) {
        prefixHandled = true;
      }
    }

    while (isActive()) {
      const boundaryIndex = findFlushBoundary(buffer);
      if (boundaryIndex === -1) break;
      const sentence = buffer.substring(0, boundaryIndex + 1).trim();
      buffer = buffer.substring(boundaryIndex + 1);
      if (sentence) yield sentence;
    }
  }

  if (isActive() && buffer.trim().length > 0) yield buffer.trim();
}
