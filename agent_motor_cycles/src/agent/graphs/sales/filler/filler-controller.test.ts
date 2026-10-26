import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  CONVERSATION_START,
  FILLER_LANGUAGES,
  FillerController,
  FillerControllerOptions,
  FillerMemory,
  resolveFillerLanguage,
} from './filler-controller.js';
import { FILLER_PHRASES, SLOW_NODE_FILLERS } from './sales.fillers.js';

// Run with: npm test

describe('sales.fillers phrase data', () => {
  it('has at least one phrase per language for every kind', () => {
    for (const [kind, byLanguage] of Object.entries(FILLER_PHRASES)) {
      for (const language of FILLER_LANGUAGES) {
        const phrases = byLanguage[language];
        assert.ok(phrases?.length, `${kind} has no ${language} phrase`);
        for (const phrase of phrases) {
          assert.ok(phrase.trim().length > 0, `${kind}/${language} has an empty phrase`);
        }
      }
    }
  });

  it('maps every slow node to a kind that has phrases', () => {
    for (const [node, kind] of Object.entries(SLOW_NODE_FILLERS)) {
      assert.ok(FILLER_PHRASES[kind], `${node} maps to missing kind ${kind}`);
    }
    assert.ok(FILLER_PHRASES.generic && FILLER_PHRASES.still_working);
  });
});

describe('resolveFillerLanguage', () => {
  it('accepts codes, locales and names', () => {
    assert.equal(resolveFillerLanguage('te'), 'te');
    assert.equal(resolveFillerLanguage('hi-IN'), 'hi');
    assert.equal(resolveFillerLanguage('Kannada'), 'kn');
  });

  it('falls back to the next candidate, then English', () => {
    assert.equal(resolveFillerLanguage('bn', 'ta'), 'ta');
    assert.equal(resolveFillerLanguage('bn', undefined, ''), 'en');
  });
});

describe('FillerController', () => {
  const slowNode = Object.keys(SLOW_NODE_FILLERS)[0];
  let sent: string[];
  let memory: FillerMemory;

  const controller = (overrides: Partial<FillerControllerOptions> = {}) => {
    const c = new FillerController({
      send: (text) => sent.push(text),
      language: 'en',
      memory,
      isConversationStart: false,
      genericAfterMs: 3000,
      stillWorkingAfterMs: 5000,
      random: () => 0,
      ...overrides,
    });
    c.start();
    return c;
  };

  beforeEach(() => {
    sent = [];
    memory = { lastPhrase: null };
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('speaks the mapped filler as soon as the router picks a slow node', () => {
    const c = controller();
    mock.timers.tick(1200);
    c.onRoute(slowNode);

    assert.deepEqual(sent, [FILLER_PHRASES[SLOW_NODE_FILLERS[slowNode]].en[0]]);
    assert.equal(c.sent[0].atMs, 1200);
    c.dispose();
  });

  it('says nothing on route to a fast node until the generic threshold', () => {
    const c = controller();
    c.onRoute('Objection_Handling_Node');
    mock.timers.tick(2999);
    assert.deepEqual(sent, []);

    mock.timers.tick(1);
    assert.deepEqual(sent, [FILLER_PHRASES.generic.en[0]]);
    assert.equal(c.sent[0].kind, 'generic');
    c.dispose();
  });

  it('skips the route filler when the generic one already played', () => {
    const c = controller();
    mock.timers.tick(3200);
    c.onRoute(slowNode);

    assert.equal(sent.length, 1);
    assert.equal(c.sent[0].kind, 'generic');
    c.dispose();
  });

  it('adds one still-working line, and never a third filler', () => {
    const c = controller();
    mock.timers.tick(1000);
    c.onRoute(slowNode);
    mock.timers.tick(5000);
    mock.timers.tick(60_000);

    assert.deepEqual(
      c.sent.map((s) => [s.kind, s.atMs]),
      [
        [SLOW_NODE_FILLERS[slowNode], 1000],
        ['still_working', 6000],
      ],
    );
    c.dispose();
  });

  it('stops all pending fillers once the reply starts', () => {
    const c = controller();
    c.onRoute(slowNode);
    mock.timers.tick(2000);
    c.onReply();
    mock.timers.tick(60_000);

    assert.equal(sent.length, 1);
  });

  it('never speaks on the greeting turn', () => {
    const c = controller({ isConversationStart: true });
    c.onRoute(slowNode);
    mock.timers.tick(60_000);

    assert.deepEqual(sent, []);
    assert.equal(CONVERSATION_START, 'SYSTEM_START_CONVERSATION');
  });

  it('does not repeat the previous phrase of the call', () => {
    const kind = SLOW_NODE_FILLERS[slowNode];
    memory.lastPhrase = FILLER_PHRASES[kind].en[0];
    const c = controller();
    c.onRoute(slowNode);

    assert.notEqual(sent[0], FILLER_PHRASES[kind].en[0]);
    assert.equal(memory.lastPhrase, sent[0]);
    c.dispose();
  });

  it('speaks in the turn language', () => {
    const c = controller({ language: 'te' });
    c.onRoute(slowNode);

    assert.ok(FILLER_PHRASES[SLOW_NODE_FILLERS[slowNode]].te.includes(sent[0]));
    c.dispose();
  });

  it('dispose cancels timers', () => {
    const c = controller();
    c.dispose();
    mock.timers.tick(60_000);
    assert.deepEqual(sent, []);
  });
});
