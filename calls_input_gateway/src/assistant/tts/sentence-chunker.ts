const MAX_BUFFER_CHARS = 100;

const SENTENCE_END = new Set(['.', '?', '!', '…']);

/**
 * True if TTS has anything to say in `text` — at least one letter or digit.
 * Sarvam rejects punctuation-only input outright (422 "Text must contain at
 * least one character from the allowed languages"), and other providers
 * would just spend a round trip on silence.
 */
export function isSpeakable(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/**
 * Where to cut the buffered LLM text into something speakable: the first
 * sentence end, a clause break once the buffer is long enough, or a word
 * boundary near MAX_BUFFER_CHARS so a run-on reply still starts speaking.
 */
export function findFlushBoundary(buffer: string): number {
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '\n') return i;
    if (SENTENCE_END.has(ch)) {
      // A run like "..." or "?!" ends the sentence once, at its last mark —
      // cutting at the first would leave the rest as bare-dot "sentences".
      let end = i;
      while (end + 1 < buffer.length && SENTENCE_END.has(buffer[end + 1])) {
        end++;
      }
      // The run may continue in the next streamed chunk ("హ్మ్." + "..").
      if (end === buffer.length - 1) return -1;
      return end;
    }
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
 * `[lang]:` tag if the agent emits one. Filler chunks are yielded whole and
 * immediately. Stops (and closes the source) as soon
 * as `isActive()` turns false — i.e. on barge-in.
 *
 * `onChunk` fires for every source chunk, before any sentence is complete, so
 * a TTS provider can start connecting while the first sentence is still
 * being generated.
 */
export async function* splitIntoSentences(
  textStream: AsyncIterable<{ text?: string; filler?: boolean }>,
  isActive: () => boolean,
  onChunk?: () => void,
): AsyncGenerator<string> {
  let buffer = '';
  let prefixHandled = false;

  for await (const chunk of textStream) {
    if (!isActive()) return;
    onChunk?.();

    // A filler is a complete line meant to be heard right now: speak it as
    // its own sentence instead of waiting for punctuation or more text.
    if (chunk.filler) {
      if (isSpeakable(buffer)) yield buffer.trim();
      buffer = '';
      if (chunk.text && isSpeakable(chunk.text)) yield chunk.text.trim();
      continue;
    }

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
      if (isSpeakable(sentence)) yield sentence;
    }
  }

  if (isActive() && isSpeakable(buffer)) yield buffer.trim();
}
