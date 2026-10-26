import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dedupeMatches } from './knowledge-base.store.js';

// Run with: npm test

describe('dedupeMatches', () => {
  const chunk = (source: string, body: string) =>
    `Subject: The Sky View Grand | Source: ${source} | Section: Amenities\n${body}`;

  it('keeps one copy of a chunk uploaded in several files, the best-scoring one', () => {
    const matches = [
      { text: chunk('brochure.pdf', '- Rooftop infinity pool'), score: 0.78 },
      { text: chunk('brochure-a.pdf', '- Rooftop infinity pool'), score: 0.77 },
      { text: chunk('brochure-b.pdf', '- Rooftop infinity pool'), score: 0.76 },
      { text: chunk('brochure.pdf', '- Gym and clubhouse'), score: 0.7 },
    ];

    assert.deepEqual(dedupeMatches(matches), [matches[0], matches[3]]);
  });

  it('treats raw (source-only header) and header-less chunks the same way', () => {
    const matches = [
      { text: 'Source: site-a\nSame text.', score: 0.8 },
      { text: 'Source: site-b\nSame text.', score: 0.79 },
      { text: 'Same text.', score: 0.78 },
      { text: 'Different text.', score: 0.7 },
    ];

    assert.deepEqual(dedupeMatches(matches), [matches[0], matches[3]]);
  });
});
