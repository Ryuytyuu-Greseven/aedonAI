/**
 * Short acknowledgements callers make while the agent is "thinking"
 * ("okay", "haan", "సరే"). They aren't a new question, so while only a
 * filler has played they must not barge in and cancel the pending reply.
 *
 * One merged list rather than per language: language detection on a
 * one-word utterance is unreliable, and none of these mean anything else
 * in the other supported languages. Deliberately excludes "yes"/"no" and
 * their translations — those can be real answers.
 */
const ACKNOWLEDGEMENTS = new Set([
  // English
  'ok', 'okay', 'k', 'okey', 'alright', 'sure', 'fine', 'right', 'cool',
  'hmm', 'hm', 'mm', 'mhm', 'mmhmm', 'uh-huh', 'uhhuh', 'ah', 'oh', 'got', 'it',
  // Hindi (romanised and Devanagari)
  'haan', 'han', 'ha', 'haanji', 'ji', 'achha', 'acha', 'accha', 'theek', 'thik', 'hai',
  'हाँ', 'हां', 'हा', 'जी', 'अच्छा', 'ठीक', 'है', 'ओके',
  // Telugu
  'sare', 'sari', 'alage', 'సరే', 'సరి', 'అలాగే', 'ఓకే', 'హా', 'ఊ',
  // Tamil
  'சரி', 'ஓகே', 'ம்', 'ம்ம்',
  // Kannada
  'ಸರಿ', 'ಓಕೆ', 'ಹೂ', 'ಹಾ', 'ಹೂಂ',
]);

const MAX_WORDS = 2;

/**
 * True when the utterance is only an acknowledgement of at most two words,
 * e.g. "okay", "theek hai", "got it", "సరే సరే". Punctuation and case are
 * ignored.
 */
export function isBackchannel(transcript: string | null | undefined): boolean {
  const words = (transcript ?? '')
    .toLowerCase()
    .replace(/[.,!?।;:"'…]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return (
    words.length > 0 &&
    words.length <= MAX_WORDS &&
    words.every((word) => ACKNOWLEDGEMENTS.has(word))
  );
}
