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
const MARKER = '';
const PLACEHOLDER_PATTERN = new RegExp(`${MARKER}(\\d+)${MARKER}`, 'g');

function toDigitByDigit(digits: string): string {
  return digits
    .split('')
    .map((d) => DIGIT_WORDS[Number(d)])
    .join(' ');
}

export function normalizeNumbersForSpeech(text: string): string {
  if (!text) return text;

  const protectedMatches: string[] = [];
  const withPlaceholders = text.replace(PROTECTED_NUMBER_PATTERN, (match) => {
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
