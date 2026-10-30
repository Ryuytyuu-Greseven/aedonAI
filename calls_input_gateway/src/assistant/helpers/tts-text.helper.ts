const DIGIT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];

// Technical & realty acronyms that TTS engines should pronounce as abbreviations,
// not converted to lowercase.
const PRESERVED_ACRONYMS = new Set([
  'BHK',
  'RK',
  'SQFT',
  'EMI',
  'CRM',
  'RERA',
  'DLF',
  'ORR',
  'OTP',
  'AI',
  'SMS',
  'IVR',
  'VIP',
  'GST',
  'TDS',
  'PAN',
  'PIN',
  'NCR',
  'MMR',
  'PMR',
]);

// Numbers formatted with a currency symbol, thousands-separator commas, or a
// decimal point (₹12,500 / 1,200.50 / Rs. 500 / 99.99) are real quantities —
// keep them intact so TTS reads them as a cardinal number, not digit-by-digit.
const PROTECTED_NUMBER_PATTERN =
  /(?:[₹$€£]\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?)|(?:\bRs\.?\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?)|(?:\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)|(?:\b\d+\.\d+\b)/gi;

// Anything else that's a run of 4+ bare digits looks like a code — phone
// number, OTP, order/account id — and reads better spoken digit-by-digit.
const CODE_LIKE_NUMBER_PATTERN = /\b\d{4,}\b/g;

// Marker built from a literal control character escape — this sequence can
// never occur in real LLM text, so restoring placeholders can't collide with
// digits already present in the sentence.
const MARKER = '\x01';
const PLACEHOLDER_PATTERN = new RegExp(`${MARKER}(\\d+)${MARKER}`, 'g');

function toDigitByDigit(digits: string): string {
  return digits
    .split('')
    .map((d) => DIGIT_WORDS[Number(d)])
    .join(' ');
}

/**
 * Normalizes punctuation, formatting, and casing so speech synthesis models
 * maintain a steady, consistent vocal delivery without sudden shouting or pitch spikes:
 * - Replaces exclamation marks with calm sentence/clause terminators (. or ,).
 * - Converts shouty ALL-CAPS words (outside standard acronyms) to lowercase.
 * - Strips asterisks, markdown syntax, and collapses duplicate punctuation.
 */
export function sanitizeTextForSpeech(text: string): string {
  if (!text) return text;

  let s = text.replace(/[*_#`~]/g, '');
  // Clause-internal exclamation (e.g. "Hi! I am...") -> "Hi, I am..."
  s = s.replace(/!\s+(?=[a-z])/g, ', ');
  // Sentence-ending exclamation marks -> period
  s = s.replace(/!+/g, '.');
  // Collapse duplicate punctuation
  s = s.replace(/\.{2,}/g, '.');
  s = s.replace(/\?{2,}/g, '?');
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/([.,?])\s*\./g, '$1');
  // Lowercase shouty all-caps words unless they are domain acronyms (e.g. BHK, EMI, CRM)
  s = s.replace(/\b[A-Z]{2,}\b/g, (w) =>
    PRESERVED_ACRONYMS.has(w) ? w : w.toLowerCase(),
  );

  return s.trim();
}

export function normalizeNumbersForSpeech(text: string): string {
  if (!text) return text;

  const sanitized = sanitizeTextForSpeech(text);

  const protectedMatches: string[] = [];
  const withPlaceholders = sanitized.replace(PROTECTED_NUMBER_PATTERN, (match) => {
    protectedMatches.push(match);
    return `${MARKER}${protectedMatches.length - 1}${MARKER}`;
  });

  const withCodesExpanded = withPlaceholders.replace(
    CODE_LIKE_NUMBER_PATTERN,
    (match) => toDigitByDigit(match),
  );

  return withCodesExpanded.replace(
    PLACEHOLDER_PATTERN,
    (_, idx: string) => protectedMatches[Number(idx)],
  );
}
